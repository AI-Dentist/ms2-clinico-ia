import { describe, it, expect } from 'vitest';
import { Laboratorio } from './laboratorio.entity.js';
import { TipoEstudio } from './tipo-estudio.entity.js';
import { SolicitudEstudio } from './solicitud-estudio.entity.js';
import { ResultadoEstudio } from './resultado-estudio.entity.js';
import { CategoriaEstudio } from '../enums/categoria-estudio.enum.js';
import { EstadoCatalogo } from '../enums/estado-catalogo.enum.js';
import { EstadoSolicitudEstudio } from '../enums/estado-solicitud-estudio.enum.js';
import { PrioridadEstudio } from '../enums/prioridad-estudio.enum.js';

describe('Entidades del Módulo Estudios', () => {
  describe('Laboratorio', () => {
    it('debe crear un laboratorio activo con datos válidos', () => {
      const lab = Laboratorio.crear({
        id: 'lab_test_1',
        nombre: 'Laboratorio Dental Maxilar',
        descripcion: 'Especialista en prótesis y coronas',
        contacto: 'contacto@maxilar.com',
      });

      expect(lab.id).toBe('lab_test_1');
      expect(lab.nombre).toBe('Laboratorio Dental Maxilar');
      expect(lab.estado).toBe(EstadoCatalogo.ACTIVO);
      expect(lab.estaActivo).toBe(true);
    });

    it('debe rechazar un nombre vacío o menor a 3 caracteres', () => {
      expect(() => {
        Laboratorio.crear({
          id: 'lab_test_2',
          nombre: '  ',
          descripcion: '',
        });
      }).toThrow('El nombre del laboratorio es obligatorio');

      expect(() => {
        Laboratorio.crear({
          id: 'lab_test_3',
          nombre: 'ab',
          descripcion: '',
        });
      }).toThrow('al menos 3 caracteres');
    });

    it('debe poder actualizar datos y desactivarse', () => {
      const lab = Laboratorio.crear({
        id: 'lab_test_4',
        nombre: 'Laboratorio Inicial',
        descripcion: 'Desc',
      });

      lab.actualizarDatos({ nombre: 'Laboratorio Actualizado' });
      expect(lab.nombre).toBe('Laboratorio Actualizado');

      lab.desactivar();
      expect(lab.estado).toBe(EstadoCatalogo.INACTIVO);
      expect(lab.estaActivo).toBe(false);

      lab.activar();
      expect(lab.estaActivo).toBe(true);
    });
  });

  describe('TipoEstudio', () => {
    it('debe crear un tipo de estudio de laboratorio o imagenología', () => {
      const tipoLab = TipoEstudio.crear({
        id: 'test_1',
        codigo: 'hem-01',
        nombre: 'Hemograma Completo',
        categoria: CategoriaEstudio.LABORATORIO,
        descripcion: 'Conteo sanguíneo completo',
      });

      expect(tipoLab.codigo).toBe('HEM-01');
      expect(tipoLab.categoria).toBe(CategoriaEstudio.LABORATORIO);
      expect(tipoLab.estaActivo).toBe(true);

      const tipoImg = TipoEstudio.crear({
        id: 'test_2',
        codigo: 'RAD-PAN',
        nombre: 'Radiografía Panorámica',
        categoria: CategoriaEstudio.IMAGENOLOGIA,
        descripcion: 'Ortopantomografía digital',
      });

      expect(tipoImg.codigo).toBe('RAD-PAN');
      expect(tipoImg.categoria).toBe(CategoriaEstudio.IMAGENOLOGIA);
    });
  });

  describe('SolicitudEstudio y ResultadoEstudio', () => {
    it('debe crear una solicitud en estado SOLICITADO', () => {
      const sol = SolicitudEstudio.crear({
        id: 'sol_1',
        historiaClinicaId: 'hc_123',
        consultaId: 'cons_123',
        pacienteId: 'pac_123',
        odontologoId: 'od_123',
        tipoEstudioId: 'test_1',
        motivo: 'Evaluación prequirúrgica de terceros molares',
        prioridad: PrioridadEstudio.RUTINA,
      });

      expect(sol.estado).toBe(EstadoSolicitudEstudio.SOLICITADO);
      expect(sol.tieneResultado).toBe(false);
      expect(sol.resultado).toBeNull();
    });

    it('debe transicionar a EN_PROCESO', () => {
      const sol = SolicitudEstudio.crear({
        id: 'sol_2',
        historiaClinicaId: 'hc_123',
        consultaId: 'cons_123',
        pacienteId: 'pac_123',
        odontologoId: 'od_123',
        tipoEstudioId: 'test_1',
        motivo: 'Control de glucosa',
      });

      sol.iniciarProceso();
      expect(sol.estado).toBe(EstadoSolicitudEstudio.EN_PROCESO);

      // No puede pasar a EN_PROCESO nuevamente
      expect(() => sol.iniciarProceso()).toThrow('No es posible pasar a EN_PROCESO');
    });

    it('debe registrar resultado, pasando a COMPLETADO', () => {
      const sol = SolicitudEstudio.crear({
        id: 'sol_3',
        historiaClinicaId: 'hc_123',
        consultaId: 'cons_123',
        pacienteId: 'pac_123',
        odontologoId: 'od_123',
        tipoEstudioId: 'test_1',
        motivo: 'Evaluación ósea',
      });

      const res = ResultadoEstudio.crear({
        id: 'res_1',
        solicitudEstudioId: sol.id,
        laboratorioId: 'lab_1',
        registradoPor: 'od_123',
        resumen: 'Estructura ósea conservada sin radiolucidez apical.',
        observaciones: 'Piezas 38 y 48 en retención mesioangular.',
        valoresReferencia: [{ parametro: 'Densidad', valor: 'Normal' }],
      });

      sol.registrarResultado(res);
      expect(sol.estado).toBe(EstadoSolicitudEstudio.COMPLETADO);
      expect(sol.tieneResultado).toBe(true);
      expect(sol.resultado?.resumen).toBe('Estructura ósea conservada sin radiolucidez apical.');

      // Prohibir sobrescritura silenciosa
      const resDuplicado = ResultadoEstudio.crear({
        id: 'res_2',
        solicitudEstudioId: sol.id,
        registradoPor: 'od_123',
        resumen: 'Otro resultado',
      });
      expect(() => sol.registrarResultado(resDuplicado)).toThrow('ya cuenta con un resultado');
    });

    it('debe permitir cancelar una solicitud con motivo y prohibir cancelar una completada', () => {
      const sol = SolicitudEstudio.crear({
        id: 'sol_4',
        historiaClinicaId: 'hc_123',
        consultaId: 'cons_123',
        pacienteId: 'pac_123',
        odontologoId: 'od_123',
        tipoEstudioId: 'test_1',
        motivo: 'Motivo prueba',
      });

      sol.cancelar('Paciente optó por no realizarse el examen');
      expect(sol.estado).toBe(EstadoSolicitudEstudio.CANCELADO);
      expect(sol.motivoCancelacion).toBe('Paciente optó por no realizarse el examen');

      // No se puede registrar resultado en cancelada
      const res = ResultadoEstudio.crear({
        id: 'res_x',
        solicitudEstudioId: sol.id,
        registradoPor: 'od_123',
        resumen: 'Resumen',
      });
      expect(() => sol.registrarResultado(res)).toThrow('No es posible registrar resultados en una solicitud CANCELADA');
    });
  });
});
