import { describe, it, expect } from 'vitest';
import { ConsultaOdontologicaMongoMapper } from './consulta-odontologica-mongo.mapper.js';
import { ConsultaOdontologicaMapper } from '../../../../application/mappers/consulta-odontologica.mapper.js';
import { ConsultaOdontologica } from '../../../../domain/entities/consulta-odontologica.entity.js';
import { HistoriaClinicaId } from '../../../../domain/value-objects/historia-clinica-id.vo.js';
import { PacienteId } from '../../../../domain/value-objects/paciente-id.vo.js';
import { OdontologoId } from '../../../../domain/value-objects/odontologo-id.vo.js';
import { MotivoConsulta } from '../../../../domain/value-objects/motivo-consulta.vo.js';
import { SnapshotRiesgoClinico } from '../../../../domain/value-objects/snapshot-riesgo-clinico.vo.js';
import { ExploracionFisica } from '../../../../domain/value-objects/exploracion-fisica.vo.js';
import { DiagnosticoItem } from '../../../../domain/value-objects/diagnostico-item.vo.js';
import { TipoDiagnostico } from '../../../../domain/value-objects/tipo-diagnostico.enum.js';
import { ServicioFacturableConsulta } from '../../../../domain/value-objects/servicio-facturable-consulta.vo.js';
import type { ConsultaOdontologicaDocument } from '../schemas/consulta-odontologica.schema.js';

describe('ConsultaOdontologica Mongo & Response Mappers - Rechazo Facturación y Outbox ID (Saga T3)', () => {
  const odontologoId = OdontologoId.crear('od_70000000-0000-0000-0000-000000000001');
  const pacienteId = PacienteId.crear('60000000-0000-0000-0000-000000000001');
  const historiaClinicaId = HistoriaClinicaId.crear('hc_50000000-0000-0000-0000-000000000001');
  const fechaAtencion = new Date('2026-11-05T08:00:00.000Z');

  function crearConsulta(): ConsultaOdontologica {
    const consulta = ConsultaOdontologica.abrir({
      historiaClinicaId,
      pacienteId,
      odontologoId,
      versionHistoriaReferenciada: 1,
      snapshotRiesgoClinico: SnapshotRiesgoClinico.vacio(),
      motivoConsulta: MotivoConsulta.crear('Control dental anual'),
      exploracionFisica: ExploracionFisica.crear({
        inspeccionIntraoral: 'Sin lesiones aparentes en cavidad bucal',
      }),
      diagnosticos: [
        DiagnosticoItem.crear({
          codigoCIE: 'Z01.2',
          descripcion: 'Examen odontológico',
          tipo: TipoDiagnostico.DEFINITIVO,
        }),
      ],
      fechaAtencion,
    });

    consulta.completar(odontologoId, {
      serviciosFacturables: [
        ServicioFacturableConsulta.crear({
          servicioId: '550e8400-e29b-41d4-a716-446655440001',
          codigo: 'CTRL-01',
          nombre: 'Control General',
          precioUnitarioBs: '80.00',
          cantidad: 1,
        }),
      ],
      ahora: new Date('2026-11-05T09:00:00.000Z'),
    });

    consulta.asignarUltimoOutboxEventId('outbox-evt-789');
    return consulta;
  }

  it('1. toPersistence debe mapear ultimoOutboxEventId y rechazoFacturacion al documento MongoDB', () => {
    const consulta = crearConsulta();
    consulta.revertirCierrePorRechazoFacturacion({
      motivoCodigo: 'PACIENTE_INEXISTENTE',
      motivo: 'Paciente no encontrado en ERP',
      rechazadaEn: new Date('2026-11-05T09:15:00.000Z'),
    });

    const doc = ConsultaOdontologicaMongoMapper.toPersistence(consulta);

    expect(doc.ultimoOutboxEventId).toBe('outbox-evt-789');
    expect(doc.rechazoFacturacion).toEqual({
      motivoCodigo: 'PACIENTE_INEXISTENTE',
      motivo: 'Paciente no encontrado en ERP',
      rechazadaEn: new Date('2026-11-05T09:15:00.000Z'),
    });
  });

  it('2. toDomain debe reconstituir ultimoOutboxEventId y rechazoFacturacion desde el documento MongoDB', () => {
    const rawDoc = {
      _id: 'cons_12345678-aaaa-bbbb-cccc-123456789abc',
      historiaClinicaId: 'hc_12345678-aaaa-bbbb-cccc-123456789abc',
      pacienteId: '60000000-0000-0000-0000-000000000001',
      odontologoId: 'od_70000000-0000-0000-0000-000000000001',
      citaId: null,
      versionHistoriaReferenciada: 1,
      snapshotRiesgoClinico: { alergiasCriticas: [], condicionesMedicas: [], medicacionHabitual: [], capturadoEn: fechaAtencion },
      fechaAtencion,
      cerradaEn: null,
      estado: 'EN_CURSO',
      motivoConsulta: 'Control dental',
      anamnesisActual: { descripcion: 'Sin quejas' },
      exploracionFisica: { inspeccionIntraoral: 'Normal' },
      diagnosticos: [],
      procedimientosRealizados: [],
      serviciosFacturables: [],
      observacionesCobro: null,
      evolucionSOAP: {},
      recomendaciones: null,
      motivoCancelacion: null,
      ultimoOutboxEventId: 'outbox-evt-456',
      rechazoFacturacion: {
        motivoCodigo: 'SERVICIO_INACTIVO',
        motivo: 'Servicio inactivo en catálogo',
        rechazadaEn: new Date('2026-11-05T09:20:00.000Z'),
      },
      version: 2,
      creadoEn: fechaAtencion,
      actualizadoEn: fechaAtencion,
      creadoPor: 'od_70000000-0000-0000-0000-000000000001',
      actualizadoPor: 'od_70000000-0000-0000-0000-000000000001',
    } as unknown as ConsultaOdontologicaDocument;

    const consulta = ConsultaOdontologicaMongoMapper.toDomain(rawDoc);

    expect(consulta.ultimoOutboxEventId).toBe('outbox-evt-456');
    expect(consulta.rechazoFacturacion).toEqual({
      motivoCodigo: 'SERVICIO_INACTIVO',
      motivo: 'Servicio inactivo en catálogo',
      rechazadaEn: new Date('2026-11-05T09:20:00.000Z'),
    });
  });

  it('3. toResponseDto debe exponer rechazoFacturacion estructurado para el frontend', () => {
    const consulta = crearConsulta();
    consulta.revertirCierrePorRechazoFacturacion({
      motivoCodigo: 'MONTO_INVALIDO',
      motivo: 'El precio total no coincide',
      rechazadaEn: new Date('2026-11-05T09:25:00.000Z'),
    });

    const dto = ConsultaOdontologicaMapper.toResponseDto(consulta);

    expect(dto.rechazoFacturacion).toEqual({
      motivoCodigo: 'MONTO_INVALIDO',
      motivo: 'El precio total no coincide',
      rechazadaEn: '2026-11-05T09:25:00.000Z',
    });
  });
});
