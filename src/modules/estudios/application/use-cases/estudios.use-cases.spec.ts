import { describe, it, expect, beforeEach } from 'vitest';
import {
  CrearLaboratorioUseCase,
} from './laboratorios.use-cases.js';
import {
  CrearTipoEstudioUseCase,
} from './tipos-estudio.use-cases.js';
import {
  CrearSolicitudEstudioUseCase,
  RegistrarResultadoEstudioUseCase,
  ListarSolicitudesPorHistoriaUseCase,
} from './solicitudes-estudio.use-cases.js';
import { Laboratorio } from '../../domain/entities/laboratorio.entity.js';
import { TipoEstudio } from '../../domain/entities/tipo-estudio.entity.js';
import { SolicitudEstudio } from '../../domain/entities/solicitud-estudio.entity.js';
import { CategoriaEstudio } from '../../domain/enums/categoria-estudio.enum.js';
import { LaboratorioDuplicadoError, TipoEstudioDuplicadoError, ResultadoYaRegistradoError } from '../../domain/errors/conflict-estudios.errors.js';
import { ConsultaInvalidaParaEstudioError } from '../../domain/errors/unprocessable-estudios.errors.js';
import type { ILaboratorioRepositoryPort } from '../../domain/ports/laboratorio.repository.port.js';
import type { ITipoEstudioRepositoryPort } from '../../domain/ports/tipo-estudio.repository.port.js';
import type { ISolicitudEstudioRepositoryPort } from '../../domain/ports/solicitud-estudio.repository.port.js';
import type { IConsultaContextPort } from '../../domain/ports/consulta-context.port.js';
import type { IOdontologoContextPort } from '../../domain/ports/odontologo-context.port.js';

// Mocks en memoria
class InMemoryLaboratorioRepo implements ILaboratorioRepositoryPort {
  labs: Laboratorio[] = [];
  async guardar(lab: Laboratorio): Promise<Laboratorio> {
    const idx = this.labs.findIndex((l) => l.id === lab.id);
    if (idx >= 0) this.labs[idx] = lab;
    else this.labs.push(lab);
    return lab;
  }
  async buscarPorId(id: string): Promise<Laboratorio | null> {
    return this.labs.find((l) => l.id === id) || null;
  }
  async buscarPorNombre(nombre: string): Promise<Laboratorio | null> {
    return this.labs.find((l) => l.nombre.toLowerCase() === nombre.toLowerCase()) || null;
  }
  async listar(): Promise<Laboratorio[]> {
    return [...this.labs];
  }
  async existe(id: string): Promise<boolean> {
    return this.labs.some((l) => l.id === id);
  }
}

class InMemoryTipoEstudioRepo implements ITipoEstudioRepositoryPort {
  tipos: TipoEstudio[] = [];
  async guardar(tipo: TipoEstudio): Promise<TipoEstudio> {
    const idx = this.tipos.findIndex((t) => t.id === tipo.id);
    if (idx >= 0) this.tipos[idx] = tipo;
    else this.tipos.push(tipo);
    return tipo;
  }
  async buscarPorId(id: string): Promise<TipoEstudio | null> {
    return this.tipos.find((t) => t.id === id) || null;
  }
  async buscarPorCodigo(codigo: string): Promise<TipoEstudio | null> {
    return this.tipos.find((t) => t.codigo === codigo) || null;
  }
  async buscarPorNombre(nombre: string): Promise<TipoEstudio | null> {
    return this.tipos.find((t) => t.nombre.toLowerCase() === nombre.toLowerCase()) || null;
  }
  async listar(): Promise<TipoEstudio[]> {
    return [...this.tipos];
  }
  async existe(id: string): Promise<boolean> {
    return this.tipos.some((t) => t.id === id);
  }
}

class InMemorySolicitudRepo implements ISolicitudEstudioRepositoryPort {
  solicitudes: SolicitudEstudio[] = [];
  async guardar(sol: SolicitudEstudio): Promise<SolicitudEstudio> {
    const idx = this.solicitudes.findIndex((s) => s.id === sol.id);
    if (idx >= 0) this.solicitudes[idx] = sol;
    else this.solicitudes.push(sol);
    return sol;
  }
  async buscarPorId(id: string): Promise<SolicitudEstudio | null> {
    return this.solicitudes.find((s) => s.id === id) || null;
  }
  async listarPorConsulta(consultaId: string): Promise<SolicitudEstudio[]> {
    return this.solicitudes.filter((s) => s.consultaId === consultaId);
  }
  async listarPorHistoriaClinica(hcId: string): Promise<SolicitudEstudio[]> {
    return this.solicitudes.filter((s) => s.historiaClinicaId === hcId);
  }
  async contarPorLaboratorio(labId: string): Promise<number> {
    return this.solicitudes.filter((s) => s.resultado?.laboratorioId === labId).length;
  }
}

describe('Casos de Uso de Estudios e Imagenología', () => {
  let labRepo: InMemoryLaboratorioRepo;
  let tipoRepo: InMemoryTipoEstudioRepo;
  let solRepo: InMemorySolicitudRepo;
  let mockConsultaContext: IConsultaContextPort;
  let mockOdontologoContext: IOdontologoContextPort;

  beforeEach(() => {
    labRepo = new InMemoryLaboratorioRepo();
    tipoRepo = new InMemoryTipoEstudioRepo();
    solRepo = new InMemorySolicitudRepo();

    mockConsultaContext = {
      obtenerResumenConsulta: async (id: string) => {
        if (id === 'cons_valida') {
          return {
            existe: true,
            historiaClinicaId: 'hc_123',
            pacienteId: 'pac_123',
            estado: 'EN_CURSO',
            odontologoId: 'od_principal',
          };
        }
        if (id === 'cons_cerrada') {
          return {
            existe: true,
            historiaClinicaId: 'hc_123',
            pacienteId: 'pac_123',
            estado: 'COMPLETADA',
            odontologoId: 'od_principal',
          };
        }
        return null;
      },
    };

    mockOdontologoContext = {
      obtenerOdontologoActual: async () => ({ odontologoId: 'od_principal' }),
    };
  });

  describe('Laboratorios', () => {
    it('debe crear un laboratorio e impedir duplicados de nombre', async () => {
      const useCase = new CrearLaboratorioUseCase(labRepo);
      const creado = await useCase.execute({
        nombre: 'Laboratorio Alfa Dental',
        descripcion: 'Especialista en prótesis fija',
      });

      expect(creado.nombre).toBe('Laboratorio Alfa Dental');
      expect(creado.estado).toBe('ACTIVO');

      await expect(
        useCase.execute({
          nombre: 'laboratorio alfa dental',
        })
      ).rejects.toThrow(LaboratorioDuplicadoError);
    });
  });

  describe('Tipos de Estudio', () => {
    it('debe registrar un tipo de estudio e impedir duplicados de código o nombre', async () => {
      const useCase = new CrearTipoEstudioUseCase(tipoRepo);
      const creado = await useCase.execute({
        codigo: 'pan-01',
        nombre: 'Panorámica Digital',
        categoria: CategoriaEstudio.IMAGENOLOGIA,
        descripcion: 'Ortopantomografía',
      });

      expect(creado.codigo).toBe('PAN-01');
      expect(creado.categoria).toBe('IMAGENOLOGIA');

      await expect(
        useCase.execute({
          codigo: 'PAN-01',
          nombre: 'Otra Panorámica',
          categoria: CategoriaEstudio.IMAGENOLOGIA,
        })
      ).rejects.toThrow(TipoEstudioDuplicadoError);
    });
  });

  describe('Solicitudes y Resultados', () => {
    it('debe crear una solicitud vinculada a la consulta y a la historia clínica', async () => {
      // Registrar tipo de estudio
      const tipo = TipoEstudio.crear({
        id: 'test_pan',
        codigo: 'PAN-01',
        nombre: 'Radiografía Panorámica',
        categoria: CategoriaEstudio.IMAGENOLOGIA,
        descripcion: 'Desc',
      });
      await tipoRepo.guardar(tipo);

      const useCase = new CrearSolicitudEstudioUseCase(
        solRepo,
        tipoRepo,
        mockConsultaContext,
        mockOdontologoContext
      );

      const sol = await useCase.execute({
        consultaId: 'cons_valida',
        tipoEstudioId: 'test_pan',
        motivo: 'Evaluación de apiñamiento dental',
        tokenOdontologo: 'token_valido',
      });

      expect(sol.id).toBeDefined();
      expect(sol.historiaClinicaId).toBe('hc_123');
      expect(sol.pacienteId).toBe('pac_123');
      expect(sol.estado).toBe('SOLICITADO');
      expect(sol.tipoEstudio?.codigo).toBe('PAN-01');
    });

    it('debe rechazar solicitudes en consultas cerradas o inexistentes', async () => {
      const tipo = TipoEstudio.crear({
        id: 'test_pan',
        codigo: 'PAN-01',
        nombre: 'Radiografía Panorámica',
        categoria: CategoriaEstudio.IMAGENOLOGIA,
        descripcion: 'Desc',
      });
      await tipoRepo.guardar(tipo);

      const useCase = new CrearSolicitudEstudioUseCase(
        solRepo,
        tipoRepo,
        mockConsultaContext,
        mockOdontologoContext
      );

      await expect(
        useCase.execute({
          consultaId: 'cons_cerrada',
          tipoEstudioId: 'test_pan',
          motivo: 'Motivo',
          tokenOdontologo: 'token_valido',
        })
      ).rejects.toThrow(ConsultaInvalidaParaEstudioError);

      await expect(
        useCase.execute({
          consultaId: 'cons_inexistente',
          tipoEstudioId: 'test_pan',
          motivo: 'Motivo',
          tokenOdontologo: 'token_valido',
        })
      ).rejects.toThrow(ConsultaInvalidaParaEstudioError);
    });

    it('debe registrar resultado clínico e impedir sobrescritura silenciosa', async () => {
      const tipo = TipoEstudio.crear({
        id: 'test_glu',
        codigo: 'GLU-01',
        nombre: 'Glucosa en Ayunas',
        categoria: CategoriaEstudio.LABORATORIO,
        descripcion: 'Glicemia',
      });
      await tipoRepo.guardar(tipo);

      const lab = Laboratorio.crear({
        id: 'lab_bio',
        nombre: 'Biolab Central',
        descripcion: 'Análisis clínicos',
      });
      await labRepo.guardar(lab);

      const crearSolUseCase = new CrearSolicitudEstudioUseCase(
        solRepo,
        tipoRepo,
        mockConsultaContext,
        mockOdontologoContext
      );

      const sol = await crearSolUseCase.execute({
        consultaId: 'cons_valida',
        tipoEstudioId: 'test_glu',
        motivo: 'Sospecha de diabetes no controlada',
        tokenOdontologo: 'token_valido',
      });

      const resUseCase = new RegistrarResultadoEstudioUseCase(
        solRepo,
        tipoRepo,
        labRepo,
        mockOdontologoContext
      );

      const solConResultado = await resUseCase.execute({
        solicitudId: sol.id,
        laboratorioId: 'lab_bio',
        resumen: 'Glucosa: 98 mg/dL (Dentro de rango normal).',
        valoresReferencia: [{ parametro: 'Glucosa', valor: '98', unidad: 'mg/dL', estado: 'NORMAL' }],
        tokenOdontologo: 'token_valido',
      });

      expect(solConResultado.estado).toBe('COMPLETADO');
      expect(solConResultado.resultado?.resumen).toContain('98 mg/dL');
      expect(solConResultado.resultado?.laboratorioNombre).toBe('Biolab Central');

      // Intentar sobrescribir resultado debe fallar
      await expect(
        resUseCase.execute({
          solicitudId: sol.id,
          resumen: 'Sobrescribiendo resultado...',
          tokenOdontologo: 'token_valido',
        })
      ).rejects.toThrow(ResultadoYaRegistradoError);
    });

    it('debe consultar el historial de estudios por historia clínica', async () => {
      const tipo = TipoEstudio.crear({
        id: 'test_hem',
        codigo: 'HEM-01',
        nombre: 'Hemograma',
        categoria: CategoriaEstudio.LABORATORIO,
        descripcion: '',
      });
      await tipoRepo.guardar(tipo);

      const crearSolUseCase = new CrearSolicitudEstudioUseCase(
        solRepo,
        tipoRepo,
        mockConsultaContext,
        mockOdontologoContext
      );

      await crearSolUseCase.execute({
        consultaId: 'cons_valida',
        tipoEstudioId: 'test_hem',
        motivo: 'Control 1',
        tokenOdontologo: 'token_valido',
      });

      const listarHistorialUseCase = new ListarSolicitudesPorHistoriaUseCase(
        solRepo,
        tipoRepo,
        labRepo
      );

      const historial = await listarHistorialUseCase.execute('hc_123');
      expect(historial.length).toBe(1);
      expect(historial[0].historiaClinicaId).toBe('hc_123');
      expect(historial[0].tipoEstudio?.codigo).toBe('HEM-01');
    });
  });
});
