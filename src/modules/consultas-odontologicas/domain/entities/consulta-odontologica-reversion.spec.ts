import { describe, it, expect, beforeEach } from 'vitest';
import { ConsultaOdontologica } from './consulta-odontologica.entity.js';
import { ConsultaId } from '../value-objects/consulta-id.vo.js';
import { HistoriaClinicaId } from '../value-objects/historia-clinica-id.vo.js';
import { PacienteId } from '../value-objects/paciente-id.vo.js';
import { OdontologoId } from '../value-objects/odontologo-id.vo.js';
import { EstadoConsulta } from '../value-objects/estado-consulta.enum.js';
import { MotivoConsulta } from '../value-objects/motivo-consulta.vo.js';
import { AnamnesisActual } from '../value-objects/anamnesis-actual.vo.js';
import { ExploracionFisica } from '../value-objects/exploracion-fisica.vo.js';
import { DiagnosticoItem } from '../value-objects/diagnostico-item.vo.js';
import { ProcedimientoRealizado } from '../value-objects/procedimiento-realizado.vo.js';
import { EvolucionSOAP } from '../value-objects/evolucion-soap.vo.js';
import { SnapshotRiesgoClinico } from '../value-objects/snapshot-riesgo-clinico.vo.js';
import { ServicioFacturableConsulta } from '../value-objects/servicio-facturable-consulta.vo.js';
import { TransicionEstadoConsultaInvalidaError } from '../errors/transicion-estado-consulta-invalida.error.js';

describe('ConsultaOdontologica - Reversión por Rechazo de Facturación (Saga T3)', () => {
  const odontologoId = OdontologoId.crear('od_70000000-0000-0000-0000-000000000001');
  const pacienteId = PacienteId.crear('60000000-0000-0000-0000-000000000001');
  const historiaClinicaId = HistoriaClinicaId.crear('hc_50000000-0000-0000-0000-000000000001');
  const fechaAtencion = new Date('2026-11-05T08:00:00.000Z');

  function crearConsultaEnCurso(): ConsultaOdontologica {
    return ConsultaOdontologica.abrir({
      id: ConsultaId.generar(),
      historiaClinicaId,
      pacienteId,
      odontologoId,
      versionHistoriaReferenciada: 1,
      snapshotRiesgoClinico: SnapshotRiesgoClinico.capturar({
        alergiasCriticas: [{ sustancia: 'Penicilina', severidad: 'ALTA' }],
        condicionesMedicas: ['Hipertensión'],
        medicacionHabitual: ['Enalapril'],
        capturadoEn: fechaAtencion,
      }),
      motivoConsulta: MotivoConsulta.crear('Dolor agudo en molar superior derecho'),
      anamnesisActual: AnamnesisActual.crear({
        descripcion: 'Paciente refiere dolor pulsátil desde hace 48 horas',
        tiempoEvolucion: '48 horas',
        escalaDolorEVA: 8,
      }),
      exploracionFisica: ExploracionFisica.crear({
        inspeccionExtraoral: 'Sin asimetrías faciales ni adenopatías palpables',
        inspeccionIntraoral: 'Caries profunda oclusal en pieza 16 con compromiso cameral',
        palpacion: 'Dolor a la percusión vertical',
        percursion: 'Percusión positiva severa',
      }),
      diagnosticos: [
        DiagnosticoItem.crear({
          codigoCIE: 'K04.0',
          descripcion: 'Pulpitis irreversible aguda',
          esDefinitivo: true,
        }),
      ],
      procedimientosRealizados: [
        ProcedimientoRealizado.crear({
          codigoProcedimiento: 'PROC-ENDO-01',
          descripcion: 'Apertura cameral y pulpectomía de urgencia',
          piezaDental: '16',
        }),
      ],
      evolucionSOAP: EvolucionSOAP.crear({
        subjetivo: 'Dolor severo',
        objetivo: 'Pieza 16 cavitada',
        analisis: 'Pulpitis irreversible',
        plan: 'Endodoncia multirradicular',
      }),
      fechaAtencion,
    });
  }

  function crearConsultaCompletada(): ConsultaOdontologica {
    const consulta = crearConsultaEnCurso();
    const fechaCierre = new Date('2026-11-05T09:30:00.000Z');
    consulta.completar(
      odontologoId,
      {
        serviciosFacturables: [
          ServicioFacturableConsulta.crear({
            servicioId: '80000000-0000-0000-0000-000000000001',
            codigo: 'ENDO-01',
            nombre: 'Endodoncia Molar',
            precioUnitarioBs: '350.00',
            cantidad: 1,
            piezaDental: 16,
          }),
        ],
        observacionesCobro: 'Cobro de urgencia',
        ahora: fechaCierre,
      },
      fechaCierre,
    );
    return consulta;
  }

  it('1. debe verificar que cancelar() sobre una consulta COMPLETADA falla con TransicionEstadoConsultaInvalidaError (guard existente)', () => {
    const consulta = crearConsultaCompletada();
    expect(consulta.estado).toBe(EstadoConsulta.COMPLETADA);

    expect(() => {
      consulta.cancelar('Cancelación posterior al cierre', odontologoId);
    }).toThrow(TransicionEstadoConsultaInvalidaError);
  });

  it('2. debe revertir exitosamente una consulta COMPLETADA a EN_CURSO guardando el motivo de rechazo', () => {
    const consulta = crearConsultaCompletada();
    const versionAntes = consulta.version;
    const rechazadaEn = new Date('2026-11-05T09:35:00.000Z');

    consulta.revertirCierrePorRechazoFacturacion({
      motivoCodigo: 'SERVICIO_INACTIVO',
      motivo: 'El servicio ENDO-01 se encuentra inactivo en el ERP',
      rechazadaEn,
    });

    expect(consulta.estado).toBe(EstadoConsulta.EN_CURSO);
    expect(consulta.cerradaEn).toBeNull();
    expect(consulta.version).toBe(versionAntes + 1);
    expect(consulta.rechazoFacturacion).toBeDefined();
    expect(consulta.rechazoFacturacion?.motivoCodigo).toBe('SERVICIO_INACTIVO');
    expect(consulta.rechazoFacturacion?.motivo).toBe('El servicio ENDO-01 se encuentra inactivo en el ERP');
    expect(consulta.rechazoFacturacion?.rechazadaEn).toEqual(rechazadaEn);
  });

  it('3. debe rechazar la reversión si la consulta no está en estado COMPLETADA', () => {
    const consulta = crearConsultaEnCurso();
    expect(consulta.estado).toBe(EstadoConsulta.EN_CURSO);

    expect(() => {
      consulta.revertirCierrePorRechazoFacturacion({
        motivoCodigo: 'REINTENTOS_AGOTADOS',
        motivo: 'Reintentos agotados en ERP',
        rechazadaEn: new Date(),
      });
    }).toThrow(TransicionEstadoConsultaInvalidaError);
  });

  it('4. debe preservar todos los datos clínicos intactos al revertir el cierre (no borra nada clínico)', () => {
    const consulta = crearConsultaCompletada();
    const motivoOriginal = consulta.motivoConsulta.valor;
    const anamnesisOriginal = consulta.anamnesisActual.descripcion;
    const exploracionOriginal = consulta.exploracionFisica.inspeccionIntraoral;
    const diagnosticosOriginal = consulta.diagnosticos.length;
    const procedimientosOriginal = consulta.procedimientosRealizados.length;
    const evolucionOriginal = consulta.evolucionSOAP.plan;

    consulta.revertirCierrePorRechazoFacturacion({
      motivoCodigo: 'MONTO_INVALIDO',
      motivo: 'Monto fuera de rango',
      rechazadaEn: new Date(),
    });

    expect(consulta.motivoConsulta.valor).toBe(motivoOriginal);
    expect(consulta.anamnesisActual.descripcion).toBe(anamnesisOriginal);
    expect(consulta.exploracionFisica.inspeccionIntraoral).toBe(exploracionOriginal);
    expect(consulta.diagnosticos.length).toBe(diagnosticosOriginal);
    expect(consulta.procedimientosRealizados.length).toBe(procedimientosOriginal);
    expect(consulta.evolucionSOAP.plan).toBe(evolucionOriginal);
  });

  it('5. debe permitir re-completar una consulta revertida, limpiando el motivo de rechazo de facturación', () => {
    const consulta = crearConsultaCompletada();
    consulta.revertirCierrePorRechazoFacturacion({
      motivoCodigo: 'SERVICIO_INACTIVO',
      motivo: 'Servicio inactivo',
      rechazadaEn: new Date(),
    });
    expect(consulta.estado).toBe(EstadoConsulta.EN_CURSO);
    expect(consulta.rechazoFacturacion).not.toBeNull();

    // El odontólogo corrige y vuelve a cerrar
    const nuevaFechaCierre = new Date('2026-11-05T10:00:00.000Z');
    consulta.completar(
      odontologoId,
      {
        serviciosFacturables: [
          ServicioFacturableConsulta.crear({
            servicioId: '80000000-0000-0000-0000-000000000002',
            codigo: 'ENDO-02',
            nombre: 'Endodoncia Molar Activa',
            precioUnitarioBs: '400.00',
            cantidad: 1,
            piezaDental: 16,
          }),
        ],
        observacionesCobro: 'Servicio corregido',
        ahora: nuevaFechaCierre,
      },
      nuevaFechaCierre,
    );

    expect(consulta.estado).toBe(EstadoConsulta.COMPLETADA);
    expect(consulta.cerradaEn).toEqual(nuevaFechaCierre);
    expect(consulta.rechazoFacturacion).toBeNull();
  });

  it('6. debe soportar asignar y consultar ultimoOutboxEventId para la guardia de versión de cierre', () => {
    const consulta = crearConsultaCompletada();
    const eventId = 'outbox-evt-12345';

    consulta.asignarUltimoOutboxEventId(eventId);
    expect(consulta.ultimoOutboxEventId).toBe(eventId);
  });
});
