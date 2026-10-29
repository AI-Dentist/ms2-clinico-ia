import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import net from 'node:net';
import mongoose, { Connection, Model } from 'mongoose';
import { MongoUnitOfWorkCierreConsultaAdapter } from './unit-of-work-cierre-consulta.adapter.js';
import { MongoConsultaOdontologicaRepository } from './repositories/mongo-consulta-odontologica.repository.js';
import { MongoOutboxRepository } from '../../../../outbox/infrastructure/persistence/mongo/repositories/mongo-outbox.repository.js';
import {
  ConsultaOdontologicaDocument,
  ConsultaOdontologicaSchema,
} from './schemas/consulta-odontologica.schema.js';
import {
  OutboxEventDocument,
  OutboxEventSchema,
} from '../../../../outbox/infrastructure/persistence/mongo/schemas/outbox-event.schema.js';
import { ConsultaOdontologica } from '../../../domain/entities/consulta-odontologica.entity.js';
import { HistoriaClinicaId } from '../../../domain/value-objects/historia-clinica-id.vo.js';
import { PacienteId } from '../../../domain/value-objects/paciente-id.vo.js';
import { OdontologoId } from '../../../domain/value-objects/odontologo-id.vo.js';
import { SnapshotRiesgoClinico } from '../../../domain/value-objects/snapshot-riesgo-clinico.vo.js';
import { MotivoConsulta } from '../../../domain/value-objects/motivo-consulta.vo.js';
import { ExploracionFisica } from '../../../domain/value-objects/exploracion-fisica.vo.js';
import { DiagnosticoItem } from '../../../domain/value-objects/diagnostico-item.vo.js';
import { TipoDiagnostico } from '../../../domain/value-objects/tipo-diagnostico.enum.js';
import { ServicioFacturableConsulta } from '../../../domain/value-objects/servicio-facturable-consulta.vo.js';
import { OutboxEvent } from '../../../../outbox/domain/entities/outbox-event.entity.js';
import { ConflictoConcurrenteConsultaError } from '../../../domain/errors/conflicto-concurrente-consulta.error.js';
import { TransaccionesNoSoportadasError } from '../../../domain/errors/transacciones-no-soportadas.error.js';

function isPortReachable(port: number, timeoutMs = 800): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, '127.0.0.1');
  });
}

describe('MongoUnitOfWorkCierreConsultaAdapter (Integration Tests)', () => {
  let isRsActive = false;
  let connection: Connection;
  let consultaModel: Model<ConsultaOdontologicaDocument>;
  let outboxModel: Model<OutboxEventDocument>;
  let unitOfWork: MongoUnitOfWorkCierreConsultaAdapter;
  let consultaRepo: MongoConsultaOdontologicaRepository;
  let outboxRepo: MongoOutboxRepository;

  beforeAll(async () => {
    isRsActive = await isPortReachable(27018);
    if (!isRsActive) {
      console.warn(
        'Servidor replica set de pruebas en puerto 27018 no activo. Omitiendo suite de integración transaccional real.',
      );
      return;
    }

    const uri =
      'mongodb://127.0.0.1:27018/test_cierre_consulta_db?replicaSet=rs_odontograma_test';
    connection = mongoose.createConnection(uri);
    await connection.asPromise();

    consultaModel = connection.model<ConsultaOdontologicaDocument>(
      ConsultaOdontologicaDocument.name,
      ConsultaOdontologicaSchema,
      'consultas_odontologicas',
    );
    outboxModel = connection.model<OutboxEventDocument>(
      OutboxEventDocument.name,
      OutboxEventSchema,
      'outbox_events',
    );

    consultaRepo = new MongoConsultaOdontologicaRepository(consultaModel);
    outboxRepo = new MongoOutboxRepository(outboxModel);
    unitOfWork = new MongoUnitOfWorkCierreConsultaAdapter(
      connection,
      consultaRepo,
      outboxRepo,
    );
  }, 10000);

  afterAll(async () => {
    if (connection) {
      try {
        await consultaModel.deleteMany({});
        await outboxModel.deleteMany({});
      } catch {
        // Ignorar limpieza si se cerró antes
      }
      await connection.close();
    }
  });

  const crearConsultaValida = async (): Promise<ConsultaOdontologica> => {
    const consulta = ConsultaOdontologica.abrir({
      historiaClinicaId: HistoriaClinicaId.crear('hc_12345678-0000-0000-0000-000000000001'),
      pacienteId: PacienteId.crear('pac_12345678-0000-0000-0000-000000000001'),
      odontologoId: OdontologoId.crear('od_12345678-0000-0000-0000-000000000001'),
      versionHistoriaReferenciada: 1,
      snapshotRiesgoClinico: SnapshotRiesgoClinico.vacio(),
      motivoConsulta: MotivoConsulta.crear('Atención de prueba transaccional'),
    });

    consulta.actualizarAtencion({
      exploracionFisica: ExploracionFisica.crear({
        inspeccionIntraoral: 'Exploración completa sin anomalías.',
      }),
      diagnosticos: [
        DiagnosticoItem.crear({
          descripcion: 'Caries simple',
          tipo: TipoDiagnostico.DEFINITIVO,
        }),
      ],
      actualizadoPor: OdontologoId.crear('od_12345678-0000-0000-0000-000000000001'),
    });

    await consultaRepo.guardar(consulta);
    return consulta;
  };

  it('1. debe persistir atómicamente la consulta y el evento Outbox en el Replica Set', async () => {
    if (!isRsActive) return;

    const consulta = await crearConsultaValida();
    const versionInicial = consulta.version;

    consulta.completar(
      OdontologoId.crear('od_12345678-0000-0000-0000-000000000001'),
      {
        serviciosFacturables: [
          ServicioFacturableConsulta.crear({
            servicioId: '90000000-0000-0000-0000-000000000001',
            codigo: 'LIM-01',
            nombre: 'Profilaxis',
            cantidad: 1,
            precioUnitarioBs: '150.00',
            piezaDental: null,
          }),
        ],
      },
    );

    const eventoOutbox = OutboxEvent.crear({
      aggregateId: consulta.id.toCanonicalUuid(),
      aggregateType: 'ConsultaOdontologica',
      eventType: 'clinica.consulta.finalizada',
      payload: {
        consultaId: consulta.id.toCanonicalUuid(),
        pacienteId: '60000000-0000-0000-0000-000000000001',
        serviciosRealizados: [
          {
            servicioId: '90000000-0000-0000-0000-000000000001',
            cantidad: 1,
            precioUnitarioBs: '150.00',
            piezaDental: null,
          },
        ],
      },
    });

    await unitOfWork.ejecutarCierreConOutbox(
      consulta,
      versionInicial,
      eventoOutbox,
    );

    // Verificar en BD que la consulta se actualizó a estado COMPLETADA
    const docConsulta = await consultaModel.findById(consulta.id.valor).lean();
    expect(docConsulta).not.toBeNull();
    expect(docConsulta?.estado).toBe('COMPLETADA');
    expect(docConsulta?.version).toBe(versionInicial + 1);

    // Verificar en BD que el evento Outbox se insertó en estado PENDIENTE
    const docOutbox = await outboxModel.findOne({ eventId: eventoOutbox.eventId }).lean();
    expect(docOutbox).not.toBeNull();
    expect(docOutbox?.status).toBe('PENDIENTE');
    expect(docOutbox?.aggregateId).toBe(consulta.id.toCanonicalUuid());
  });

  it('2. debe hacer rollback atómico si hay conflicto de concurrencia optimista (sin insertar Outbox)', async () => {
    if (!isRsActive) return;

    const consulta = await crearConsultaValida();
    const versionIncorrecta = 999;

    consulta.completar(OdontologoId.crear('od_12345678-0000-0000-0000-000000000001'), {
      serviciosFacturables: [
        ServicioFacturableConsulta.crear({
          servicioId: '90000000-0000-0000-0000-000000000001',
          codigo: 'LIM-01',
          nombre: 'Profilaxis',
          cantidad: 1,
          precioUnitarioBs: '150.00',
        }),
      ],
    });

    const eventoOutbox = OutboxEvent.crear({
      aggregateId: consulta.id.toCanonicalUuid(),
      payload: { test: true },
    });

    await expect(
      unitOfWork.ejecutarCierreConOutbox(consulta, versionIncorrecta, eventoOutbox),
    ).rejects.toThrow(ConflictoConcurrenteConsultaError);

    // Verificar que la consulta NO cambió en BD (permanece EN_CURSO)
    const docConsulta = await consultaModel.findById(consulta.id.valor).lean();
    expect(docConsulta?.estado).toBe('EN_CURSO');

    // Verificar que NO se insertó el evento Outbox (rollback total)
    const docOutbox = await outboxModel.findOne({ eventId: eventoOutbox.eventId }).lean();
    expect(docOutbox).toBeNull();
  });

  it('3. debe rechazar con TransaccionesNoSoportadasError si se conecta a MongoDB Standalone (puerto 27017)', async () => {
    const isStandaloneActive = await isPortReachable(27017);
    if (!isStandaloneActive) return;

    const uriStandalone = 'mongodb://127.0.0.1:27017/clinica-dentalDB?directConnection=true';
    const standaloneConn = mongoose.createConnection(uriStandalone);
    await standaloneConn.asPromise();

    try {
      const uowStandalone = new MongoUnitOfWorkCierreConsultaAdapter(
        standaloneConn,
        consultaRepo,
        outboxRepo,
      );

      const dummyConsulta = ConsultaOdontologica.abrir({
        historiaClinicaId: HistoriaClinicaId.crear('hc_dummy_123'),
        pacienteId: PacienteId.crear('pac_dummy_123'),
        odontologoId: OdontologoId.crear('od_dummy_123'),
        versionHistoriaReferenciada: 1,
        snapshotRiesgoClinico: SnapshotRiesgoClinico.vacio(),
        motivoConsulta: MotivoConsulta.crear('Prueba Standalone'),
      });

      const dummyEvent = OutboxEvent.crear({
        aggregateId: '70000000-0000-0000-0000-000000000099',
        payload: { test: true },
      });

      await expect(
        uowStandalone.ejecutarCierreConOutbox(dummyConsulta, 1, dummyEvent),
      ).rejects.toThrow(TransaccionesNoSoportadasError);
    } finally {
      await standaloneConn.close();
    }
  });
});
