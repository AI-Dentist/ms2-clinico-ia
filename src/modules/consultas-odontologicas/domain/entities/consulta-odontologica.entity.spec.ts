import { describe, it, expect } from 'vitest';
import { ConsultaOdontologica } from './consulta-odontologica.entity.js';
import { ConsultaId } from '../value-objects/consulta-id.vo.js';
import { HistoriaClinicaId } from '../value-objects/historia-clinica-id.vo.js';
import { PacienteId } from '../value-objects/paciente-id.vo.js';
import { OdontologoId } from '../value-objects/odontologo-id.vo.js';
import { CitaId } from '../value-objects/cita-id.vo.js';
import { EstadoConsulta } from '../value-objects/estado-consulta.enum.js';
import { MotivoConsulta } from '../value-objects/motivo-consulta.vo.js';
import { AnamnesisActual } from '../value-objects/anamnesis-actual.vo.js';
import { ExploracionFisica } from '../value-objects/exploracion-fisica.vo.js';
import { DiagnosticoItem } from '../value-objects/diagnostico-item.vo.js';
import { TipoDiagnostico } from '../value-objects/tipo-diagnostico.enum.js';
import { ProcedimientoRealizado } from '../value-objects/procedimiento-realizado.vo.js';
import { ServicioFacturableConsulta } from '../value-objects/servicio-facturable-consulta.vo.js';
import { PiezaDentalFDI } from '../value-objects/pieza-dental-fdi.vo.js';
import { EvolucionSOAP } from '../value-objects/evolucion-soap.vo.js';
import { SnapshotRiesgoClinico } from '../value-objects/snapshot-riesgo-clinico.vo.js';
import { ConsultaNoEditableError } from '../errors/consulta-no-editable.error.js';
import { RequisitosCierreConsultaIncumplidosError } from '../errors/requisitos-cierre-consulta-incumplidos.error.js';
import { JustificacionCancelacionRequeridaError } from '../errors/justificacion-cancelacion-requerida.error.js';
import { TransicionEstadoConsultaInvalidaError } from '../errors/transicion-estado-consulta-invalida.error.js';

describe('ConsultaOdontologica Aggregate Root (Invariantes y Máquina de Estados)', () => {
  const historiaClinicaId = HistoriaClinicaId.crear('hc_12345678-abcd-1111-2222-333344445555');
  const pacienteId = PacienteId.crear('pac_dennis_001');
  const odontologoId = OdontologoId.crear('od_henry_001');
  const citaId = CitaId.crear('cita_dev_001');
  const relojBase = new Date('2026-10-22T10:00:00.000Z');

  const crearConsultaEnCurso = (reloj = relojBase): ConsultaOdontologica => {
    return ConsultaOdontologica.abrir(
      {
        historiaClinicaId,
        pacienteId,
        odontologoId,
        citaId,
        versionHistoriaReferenciada: 2,
        snapshotRiesgoClinico: SnapshotRiesgoClinico.capturar({
          alergiasCriticas: [{ sustancia: 'Lidocaína', severidad: 'GRAVE' }],
          condicionesMedicas: ['Hipertensión arterial'],
        }),
        motivoConsulta: MotivoConsulta.crear('Dolor pulsátil en pieza 36'),
      },
      reloj
    );
  };

  describe('Apertura de Consulta (abrir)', () => {
    it('debe crear la consulta en estado EN_CURSO con versión 1 e identificador canónico', () => {
      const consulta = crearConsultaEnCurso();

      expect(consulta.id.valor.startsWith('cons_')).toBe(true);
      expect(consulta.estado).toBe(EstadoConsulta.EN_CURSO);
      expect(consulta.estaEnCurso).toBe(true);
      expect(consulta.estaCompletada).toBe(false);
      expect(consulta.estaCancelada).toBe(false);
      expect(consulta.version).toBe(1);
      expect(consulta.cerradaEn).toBeNull();
      expect(consulta.creadoEn.toISOString()).toBe(relojBase.toISOString());
      expect(consulta.actualizadoEn.toISOString()).toBe(relojBase.toISOString());
      expect(consulta.creadoPor.equals(odontologoId)).toBe(true);
      expect(consulta.citaId?.valor).toBe('cita_dev_001');
      expect(consulta.snapshotRiesgoClinico.tieneAlergiasRegistradas).toBe(true);
    });

    it('debe permitir apertura sin citaId (urgencia ambulatoria)', () => {
      const consulta = ConsultaOdontologica.abrir(
        {
          historiaClinicaId,
          pacienteId,
          odontologoId,
          citaId: null,
          versionHistoriaReferenciada: 1,
          snapshotRiesgoClinico: SnapshotRiesgoClinico.vacio(),
          motivoConsulta: MotivoConsulta.crear('Fractura coronal traumática pieza 11'),
        },
        relojBase
      );

      expect(consulta.citaId).toBeNull();
    });

    it('debe rechazar apertura con fecha de atención futura más allá de 60 segundos (INV-CONS-03)', () => {
      const fechaFutura = new Date(relojBase.getTime() + 120_000); // 2 minutos en el futuro
      expect(() =>
        ConsultaOdontologica.abrir(
          {
            historiaClinicaId,
            pacienteId,
            odontologoId,
            versionHistoriaReferenciada: 1,
            snapshotRiesgoClinico: SnapshotRiesgoClinico.vacio(),
            fechaAtencion: fechaFutura,
            motivoConsulta: MotivoConsulta.crear('Control de ortodoncia'),
          },
          relojBase
        )
      ).toThrow('no puede ser posterior a la hora actual');
    });

    it('debe rechazar versión de historia referenciada menor a 1', () => {
      expect(() =>
        ConsultaOdontologica.abrir(
          {
            historiaClinicaId,
            pacienteId,
            odontologoId,
            versionHistoriaReferenciada: 0,
            snapshotRiesgoClinico: SnapshotRiesgoClinico.vacio(),
            motivoConsulta: MotivoConsulta.crear('Control de ortodoncia'),
          },
          relojBase
        )
      ).toThrow('debe ser un entero positivo mayor o igual a 1');
    });
  });

  describe('Actualización de Atención en Sillón (actualizarAtencion)', () => {
    it('debe actualizar los datos clínicos mientras la consulta está EN_CURSO e incrementar la versión', () => {
      const consulta = crearConsultaEnCurso();
      const relojPaso2 = new Date('2026-10-22T10:15:00.000Z');

      const anamnesis = AnamnesisActual.crear({
        descripcion: 'Dolor continuo de 48 horas tras estímulo térmico',
        escalaDolorEVA: 8,
      });
      const exploracion = ExploracionFisica.crear({
        inspeccionIntraoral: 'Cavidad ocluso-distal profunda con exposición pulpar en 36.',
      });
      const diag = DiagnosticoItem.crear({
        codigoCIE10: 'K04.0',
        descripcion: 'Pulpitis irreversible sintomática',
        tipo: TipoDiagnostico.DEFINITIVO,
      });
      const proc = ProcedimientoRealizado.crear({
        codigo: 'END-01',
        descripcion: 'Pulpectomía cameral de urgencia',
        piezaDental: PiezaDentalFDI.crear(36),
      });
      const soap = EvolucionSOAP.crear({
        subjetivo: 'Paciente con dolor punzante',
        analisis: 'Pulpitis aguda',
      });

      consulta.actualizarAtencion(
        {
          anamnesisActual: anamnesis,
          exploracionFisica: exploracion,
          diagnosticos: [diag],
          procedimientosRealizados: [proc],
          evolucionSOAP: soap,
          recomendaciones: 'AINEs por 3 días',
          actualizadoPor: odontologoId,
        },
        relojPaso2
      );

      expect(consulta.version).toBe(2);
      expect(consulta.actualizadoEn.toISOString()).toBe(relojPaso2.toISOString());
      expect(consulta.anamnesisActual.escalaDolorEVA).toBe(8);
      expect(consulta.exploracionFisica.inspeccionIntraoral).toContain('Cavidad ocluso-distal');
      expect(consulta.diagnosticos.length).toBe(1);
      expect(consulta.diagnosticos[0].codigoCIE10).toBe('K04.0');
      expect(consulta.procedimientosRealizados.length).toBe(1);
      expect(consulta.procedimientosRealizados[0].piezaDental?.valor).toBe(36);
      expect(consulta.recomendaciones).toBe('AINEs por 3 días');
    });

    it('debe rechazar actualizarAtencion si la consulta está en estado COMPLETADA (INV-CONS-04)', () => {
      const consulta = crearConsultaEnCurso();
      // Completar la consulta primero
      consulta.actualizarAtencion({
        exploracionFisica: ExploracionFisica.crear({
          inspeccionIntraoral: 'Mucosa sana, cavidad dental en 36 evaluada.',
        }),
        diagnosticos: [
          DiagnosticoItem.crear({ descripcion: 'Caries de dentina', tipo: TipoDiagnostico.DEFINITIVO }),
        ],
        actualizadoPor: odontologoId,
      });
      consulta.completar(odontologoId);

      expect(() =>
        consulta.actualizarAtencion({
          recomendaciones: 'Cambio posterior',
          actualizadoPor: odontologoId,
        })
      ).toThrow(ConsultaNoEditableError);
    });

    it('debe rechazar actualizarAtencion si la consulta está en estado CANCELADA (INV-CONS-04)', () => {
      const consulta = crearConsultaEnCurso();
      consulta.cancelar('Paciente se retira voluntariamente del consultorio', odontologoId);

      expect(() =>
        consulta.actualizarAtencion({
          recomendaciones: 'Intento de edición',
          actualizadoPor: odontologoId,
        })
      ).toThrow(ConsultaNoEditableError);
    });
  });

  describe('Completar Consulta (completar)', () => {
    it('debe transicionar a COMPLETADA si se satisfacen todos los requisitos mínimos clínicos', () => {
      const consulta = crearConsultaEnCurso();
      const relojCierre = new Date('2026-10-22T10:45:00.000Z');

      consulta.actualizarAtencion({
        exploracionFisica: ExploracionFisica.crear({
          inspeccionIntraoral: 'Exploración completa sin anomalías en tejidos blandos.',
        }),
        diagnosticos: [
          DiagnosticoItem.crear({
            codigoCIE10: 'K02.1',
            descripcion: 'Caries de dentina pieza 36',
            tipo: TipoDiagnostico.DEFINITIVO,
          }),
        ],
        actualizadoPor: odontologoId,
      });

      consulta.completar(odontologoId, relojCierre);

      expect(consulta.estado).toBe(EstadoConsulta.COMPLETADA);
      expect(consulta.estaCompletada).toBe(true);
      expect(consulta.estaEnCurso).toBe(false);
      expect(consulta.cerradaEn?.toISOString()).toBe(relojCierre.toISOString());
      expect(consulta.version).toBe(3); // 1 apertura + 1 actualizacion + 1 completar
    });

    it('debe rechazar completar si la exploración intraoral no está documentada (INV-CONS-05)', () => {
      const consulta = crearConsultaEnCurso();
      consulta.actualizarAtencion({
        diagnosticos: [
          DiagnosticoItem.crear({ descripcion: 'Gingivitis marginal', tipo: TipoDiagnostico.DEFINITIVO }),
        ],
        actualizadoPor: odontologoId,
      });

      expect(() => consulta.completar(odontologoId)).toThrow(RequisitosCierreConsultaIncumplidosError);
    });

    it('debe rechazar completar si no existe al menos un diagnóstico registrado (INV-CONS-05)', () => {
      const consulta = crearConsultaEnCurso();
      consulta.actualizarAtencion({
        exploracionFisica: ExploracionFisica.crear({
          inspeccionIntraoral: 'Exploración intraoral documentada con hallazgos.',
        }),
        diagnosticos: [],
        actualizadoPor: odontologoId,
      });

      expect(() => consulta.completar(odontologoId)).toThrow(RequisitosCierreConsultaIncumplidosError);
    });

    it('debe rechazar completar si ya fue completada previamente', () => {
      const consulta = crearConsultaEnCurso();
      consulta.actualizarAtencion({
        exploracionFisica: ExploracionFisica.crear({
          inspeccionIntraoral: 'Exploración intraoral satisfactoria.',
        }),
        diagnosticos: [
          DiagnosticoItem.crear({ descripcion: 'Caries dental', tipo: TipoDiagnostico.DEFINITIVO }),
        ],
        actualizadoPor: odontologoId,
      });
      consulta.completar(odontologoId);

      expect(() => consulta.completar(odontologoId)).toThrow(TransicionEstadoConsultaInvalidaError);
    });
  });

  describe('Cancelar Consulta (cancelar)', () => {
    it('debe transicionar a CANCELADA registrando la justificación obligatoria (INV-CONS-06)', () => {
      const consulta = crearConsultaEnCurso();
      const relojCancelacion = new Date('2026-10-22T10:20:00.000Z');
      const justificacion = 'Paciente experimenta mareos severos y se suspende atención';

      consulta.cancelar(justificacion, odontologoId, relojCancelacion);

      expect(consulta.estado).toBe(EstadoConsulta.CANCELADA);
      expect(consulta.estaCancelada).toBe(true);
      expect(consulta.estaEnCurso).toBe(false);
      expect(consulta.motivoCancelacion).toBe(justificacion);
      expect(consulta.cerradaEn?.toISOString()).toBe(relojCancelacion.toISOString());
      expect(consulta.version).toBe(2);
    });

    it('debe rechazar cancelación con justificación vacía o menor a 10 caracteres (INV-CONS-06)', () => {
      const consulta = crearConsultaEnCurso();

      expect(() => consulta.cancelar('', odontologoId)).toThrow(JustificacionCancelacionRequeridaError);
      expect(() => consulta.cancelar('   ', odontologoId)).toThrow(JustificacionCancelacionRequeridaError);
      expect(() => consulta.cancelar('Cancelo', odontologoId)).toThrow(JustificacionCancelacionRequeridaError);
    });

    it('debe rechazar cancelar una consulta que ya fue completada', () => {
      const consulta = crearConsultaEnCurso();
      consulta.actualizarAtencion({
        exploracionFisica: ExploracionFisica.crear({
          inspeccionIntraoral: 'Exploración intraoral documentada.',
        }),
        diagnosticos: [
          DiagnosticoItem.crear({ descripcion: 'Caries dental', tipo: TipoDiagnostico.DEFINITIVO }),
        ],
        actualizadoPor: odontologoId,
      });
      consulta.completar(odontologoId);

      expect(() =>
        consulta.cancelar('Intento de cancelar una consulta completada', odontologoId)
      ).toThrow(TransicionEstadoConsultaInvalidaError);
    });
  });

  describe('Reconstitución de Persistencia (reconstituir)', () => {
    it('debe reconstituir fielmente el estado almacenado en MongoDB', () => {
      const id = ConsultaId.reconstituir('cons_a1b2c3d4-e5f6-7890-1234-567890abcdef');
      const consulta = ConsultaOdontologica.reconstituir({
        id,
        historiaClinicaId,
        pacienteId,
        odontologoId,
        citaId,
        versionHistoriaReferenciada: 3,
        snapshotRiesgoClinico: SnapshotRiesgoClinico.capturar({
          condicionesMedicas: ['Diabetes Tipo 2'],
        }),
        fechaAtencion: relojBase,
        cerradaEn: new Date('2026-10-22T10:40:00.000Z'),
        estado: EstadoConsulta.COMPLETADA,
        motivoConsulta: MotivoConsulta.crear('Dolor molar persistente'),
        anamnesisActual: AnamnesisActual.vacia(),
        exploracionFisica: ExploracionFisica.crear({ inspeccionIntraoral: 'Diente 36 con lesión' }),
        diagnosticos: [DiagnosticoItem.crear({ descripcion: 'Pulpitis', tipo: TipoDiagnostico.DEFINITIVO })],
        procedimientosRealizados: [],
        evolucionSOAP: EvolucionSOAP.vacia(),
        recomendaciones: 'Control post-operatorio',
        motivoCancelacion: null,
        version: 5,
        creadoEn: relojBase,
        actualizadoEn: new Date('2026-10-22T10:40:00.000Z'),
        creadoPor: odontologoId,
        actualizadoPor: odontologoId,
      });

      expect(consulta.id.valor).toBe('cons_a1b2c3d4-e5f6-7890-1234-567890abcdef');
      expect(consulta.estado).toBe(EstadoConsulta.COMPLETADA);
      expect(consulta.version).toBe(5);
      expect(consulta.cerradaEn).not.toBeNull();
      expect(consulta.estaCompletada).toBe(true);
    });

    it('debe aislarse de referencias mutables compartidas en fechas y arreglos', () => {
      const fechaAtencionMut = new Date('2026-10-22T08:00:00.000Z');
      const cerradaEnMut = new Date('2026-10-22T08:30:00.000Z');
      const diagnosticosInput = [
        DiagnosticoItem.crear({ descripcion: 'Gingivitis', tipo: TipoDiagnostico.DEFINITIVO }),
      ];

      const consulta = ConsultaOdontologica.reconstituir({
        id: ConsultaId.generar(),
        historiaClinicaId,
        pacienteId,
        odontologoId,
        citaId: null,
        versionHistoriaReferenciada: 1,
        snapshotRiesgoClinico: SnapshotRiesgoClinico.vacio(),
        fechaAtencion: fechaAtencionMut,
        cerradaEn: cerradaEnMut,
        estado: EstadoConsulta.COMPLETADA,
        motivoConsulta: MotivoConsulta.crear('Limpieza periódica'),
        anamnesisActual: AnamnesisActual.vacia(),
        exploracionFisica: ExploracionFisica.crear({ inspeccionIntraoral: 'Exploración normal' }),
        diagnosticos: diagnosticosInput,
        procedimientosRealizados: [],
        evolucionSOAP: EvolucionSOAP.vacia(),
        recomendaciones: null,
        motivoCancelacion: null,
        version: 1,
        creadoEn: fechaAtencionMut,
        actualizadoEn: cerradaEnMut,
        creadoPor: odontologoId,
        actualizadoPor: odontologoId,
      });

      // Muta las fechas externas
      fechaAtencionMut.setFullYear(2000);
      cerradaEnMut.setFullYear(2000);
      diagnosticosInput.push(
        DiagnosticoItem.crear({ descripcion: 'Diagnóstico espurio externo', tipo: TipoDiagnostico.DEFINITIVO })
      );

      // La entidad preserva sus valores inmutables
      expect(consulta.fechaAtencion.getFullYear()).toBe(2026);
      expect(consulta.cerradaEn?.getFullYear()).toBe(2026);
      expect(consulta.diagnosticos.length).toBe(1);

      // Muta las fechas devueltas por getters
      const fechaObtenida = consulta.fechaAtencion;
      fechaObtenida.setFullYear(1999);
      expect(consulta.fechaAtencion.getFullYear()).toBe(2026);
    });

    it('debe rechazar reconstitución con estados inconsistentes', () => {
      const id = ConsultaId.generar();
      const baseProps = {
        id,
        historiaClinicaId,
        pacienteId,
        odontologoId,
        citaId: null,
        versionHistoriaReferenciada: 1,
        snapshotRiesgoClinico: SnapshotRiesgoClinico.vacio(),
        fechaAtencion: relojBase,
        motivoConsulta: MotivoConsulta.crear('Control rutinario'),
        anamnesisActual: AnamnesisActual.vacia(),
        exploracionFisica: ExploracionFisica.vacia(),
        diagnosticos: [],
        procedimientosRealizados: [],
        evolucionSOAP: EvolucionSOAP.vacia(),
        recomendaciones: null,
        creadoEn: relojBase,
        actualizadoEn: relojBase,
        creadoPor: odontologoId,
        actualizadoPor: odontologoId,
      };

      // 1. COMPLETADA sin cerradaEn
      expect(() =>
        ConsultaOdontologica.reconstituir({
          ...baseProps,
          estado: EstadoConsulta.COMPLETADA,
          cerradaEn: null,
          motivoCancelacion: null,
          version: 1,
        })
      ).toThrow('Una consulta en estado COMPLETADA debe registrar una fecha de cierre');

      // 2. CANCELADA sin cerradaEn
      expect(() =>
        ConsultaOdontologica.reconstituir({
          ...baseProps,
          estado: EstadoConsulta.CANCELADA,
          cerradaEn: null,
          motivoCancelacion: 'Justificación médica válida de cancelación',
          version: 1,
        })
      ).toThrow('Una consulta en estado CANCELADA debe registrar una fecha de cierre');

      // 3. CANCELADA sin motivoCancelacion válido
      expect(() =>
        ConsultaOdontologica.reconstituir({
          ...baseProps,
          estado: EstadoConsulta.CANCELADA,
          cerradaEn: relojBase,
          motivoCancelacion: null,
          version: 1,
        })
      ).toThrow('Una consulta en estado CANCELADA debe registrar un motivo de cancelación');

      // 4. EN_CURSO con cerradaEn no nulo
      expect(() =>
        ConsultaOdontologica.reconstituir({
          ...baseProps,
          estado: EstadoConsulta.EN_CURSO,
          cerradaEn: relojBase,
          motivoCancelacion: null,
          version: 1,
        })
      ).toThrow('Una consulta en estado EN_CURSO no puede tener fecha de cierre');

      // 5. EN_CURSO con motivoCancelacion no nulo
      expect(() =>
        ConsultaOdontologica.reconstituir({
          ...baseProps,
          estado: EstadoConsulta.EN_CURSO,
          cerradaEn: null,
          motivoCancelacion: 'Motivo cancelacion',
          version: 1,
        })
      ).toThrow('Una consulta en estado EN_CURSO no puede tener motivo de cancelación');

      // 6. version < 1
      expect(() =>
        ConsultaOdontologica.reconstituir({
          ...baseProps,
          estado: EstadoConsulta.EN_CURSO,
          cerradaEn: null,
          motivoCancelacion: null,
          version: 0,
        })
      ).toThrow('La versión de la consulta debe ser mayor o igual a 1');

      // 7. versionHistoriaReferenciada < 1
      expect(() =>
        ConsultaOdontologica.reconstituir({
          ...baseProps,
          versionHistoriaReferenciada: 0,
          estado: EstadoConsulta.EN_CURSO,
          cerradaEn: null,
          motivoCancelacion: null,
          version: 1,
        })
      ).toThrow('La versión de historia referenciada debe ser mayor o igual a 1');
    });
  });

  describe('Servicios Facturables y Cierre Económico (MS1)', () => {
    it('1. Debe completar la consulta sin servicios facturables (consulta sin cobro)', () => {
      const consulta = ConsultaOdontologica.abrir({
        historiaClinicaId,
        pacienteId,
        odontologoId,
        versionHistoriaReferenciada: 1,
        snapshotRiesgoClinico: SnapshotRiesgoClinico.vacio(),
        motivoConsulta: MotivoConsulta.crear('Control posoperatorio'),
        exploracionFisica: ExploracionFisica.crear({
          inspeccionIntraoral: 'Cicatrización adecuada sin signos de infección.',
        }),
        diagnosticos: [
          DiagnosticoItem.crear({
            codigoCIE10: 'Z09.0',
            descripcion: 'Examen de seguimiento posquirúrgico',
            tipo: TipoDiagnostico.DEFINITIVO,
          }),
        ],
      });

      consulta.completar(odontologoId);

      expect(consulta.estado).toBe(EstadoConsulta.COMPLETADA);
      expect(consulta.serviciosFacturables).toEqual([]);
      expect(consulta.tieneServiciosFacturables).toBe(false);
      expect(consulta.calcularTotalFacturableBs()).toBe('0.00');
    });

    it('2. Debe registrar servicios facturables y calcular el total en bolivianos', () => {
      const consulta = ConsultaOdontologica.abrir({
        historiaClinicaId,
        pacienteId,
        odontologoId,
        versionHistoriaReferenciada: 1,
        snapshotRiesgoClinico: SnapshotRiesgoClinico.vacio(),
        motivoConsulta: MotivoConsulta.crear('Profilaxis y restauración'),
        exploracionFisica: ExploracionFisica.crear({
          inspeccionIntraoral: 'Exploración completa.',
        }),
        diagnosticos: [
          DiagnosticoItem.crear({
            descripcion: 'Caries y placa bacteriana',
            tipo: TipoDiagnostico.DEFINITIVO,
          }),
        ],
      });

      const s1 = ServicioFacturableConsulta.crear({
        servicioId: '550e8400-e29b-41d4-a716-446655440001',
        nombre: 'Limpieza Ultrasonido',
        cantidad: 1,
        precioUnitarioBs: '150.00',
      });

      const s2 = ServicioFacturableConsulta.crear({
        servicioId: '550e8400-e29b-41d4-a716-446655440002',
        nombre: 'Resina Fotocurable',
        cantidad: 2,
        precioUnitarioBs: '200.50',
        piezaDental: 16,
      });

      consulta.completar(odontologoId, {
        serviciosFacturables: [s1, s2],
        observacionesCobro: 'Cobro en cuotas autorizado',
      });

      expect(consulta.serviciosFacturables).toHaveLength(2);
      expect(consulta.tieneServiciosFacturables).toBe(true);
      expect(consulta.observacionesCobro).toBe('Cobro en cuotas autorizado');
      // 150.00 + (200.50 * 2) = 150.00 + 401.00 = 551.00
      expect(consulta.calcularTotalFacturableBs()).toBe('551.00');
    });

    it('3. Debe mantener completa independencia entre ProcedimientoRealizado y ServicioFacturableConsulta', () => {
      const procClinico = ProcedimientoRealizado.crear({
        codigo: 'PROC-01',
        descripcion: 'Apertura cameral y desinfección con hipoclorito',
        piezaDental: PiezaDentalFDI.crear(16),
      });

      const consulta = ConsultaOdontologica.abrir({
        historiaClinicaId,
        pacienteId,
        odontologoId,
        versionHistoriaReferenciada: 1,
        snapshotRiesgoClinico: SnapshotRiesgoClinico.vacio(),
        motivoConsulta: MotivoConsulta.crear('Tratamiento de conductos'),
        exploracionFisica: ExploracionFisica.crear({
          inspeccionIntraoral: 'Exploración endodóntica.',
        }),
        diagnosticos: [
          DiagnosticoItem.crear({
            descripcion: 'Pulpitis irreversible',
            tipo: TipoDiagnostico.DEFINITIVO,
          }),
        ],
        procedimientosRealizados: [procClinico],
      });

      // El procedimiento clínico existe en sillón sin requerir servicio facturable
      expect(consulta.procedimientosRealizados).toHaveLength(1);
      expect(consulta.serviciosFacturables).toHaveLength(0);

      // Ahora se completa facturando un servicio diferente o global
      const servFacturable = ServicioFacturableConsulta.crear({
        servicioId: '550e8400-e29b-41d4-a716-446655440003',
        nombre: 'Endodoncia Molar Unirradicular',
        cantidad: 1,
        precioUnitarioBs: '500.00',
        piezaDental: 16,
      });

      consulta.completar(odontologoId, {
        serviciosFacturables: [servFacturable],
      });

      expect(consulta.procedimientosRealizados[0].descripcion).toBe(
        'Apertura cameral y desinfección con hipoclorito',
      );
      expect(consulta.serviciosFacturables[0].nombre).toBe('Endodoncia Molar Unirradicular');
      expect(consulta.calcularTotalFacturableBs()).toBe('500.00');
    });

    it('4. Debe reconstituir consultas antiguas de MongoDB sin serviciosFacturables de forma retrocompatible', () => {
      const consultaAntigua = ConsultaOdontologica.reconstituir({
        id: ConsultaId.generar(),
        historiaClinicaId,
        pacienteId,
        odontologoId,
        citaId: null,
        versionHistoriaReferenciada: 1,
        snapshotRiesgoClinico: SnapshotRiesgoClinico.vacio(),
        fechaAtencion: new Date('2026-09-01T10:00:00.000Z'),
        cerradaEn: new Date('2026-09-01T10:45:00.000Z'),
        estado: EstadoConsulta.COMPLETADA,
        motivoConsulta: MotivoConsulta.crear('Atención histórica'),
        anamnesisActual: AnamnesisActual.vacia(),
        exploracionFisica: ExploracionFisica.crear({
          inspeccionIntraoral: 'Inspección realizada',
        }),
        diagnosticos: [
          DiagnosticoItem.crear({
            descripcion: 'Diagnóstico histórico',
            tipo: TipoDiagnostico.DEFINITIVO,
          }),
        ],
        procedimientosRealizados: [],
        // serviciosFacturables y observacionesCobro omitidos intencionalmente
        evolucionSOAP: EvolucionSOAP.vacia(),
        recomendaciones: null,
        motivoCancelacion: null,
        version: 2,
        creadoEn: new Date('2026-09-01T10:00:00.000Z'),
        actualizadoEn: new Date('2026-09-01T10:45:00.000Z'),
        creadoPor: odontologoId,
        actualizadoPor: odontologoId,
      });

      expect(consultaAntigua.serviciosFacturables).toEqual([]);
      expect(consultaAntigua.observacionesCobro).toBeNull();
      expect(consultaAntigua.tieneServiciosFacturables).toBe(false);
      expect(consultaAntigua.calcularTotalFacturableBs()).toBe('0.00');
    });
  });
});
