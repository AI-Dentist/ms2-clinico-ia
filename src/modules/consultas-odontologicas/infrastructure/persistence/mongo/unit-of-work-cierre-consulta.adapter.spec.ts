import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Connection, ClientSession } from 'mongoose';
import { MongoUnitOfWorkCierreConsultaAdapter } from './unit-of-work-cierre-consulta.adapter.js';
import type { IConsultaOdontologicaRepositoryPort } from '../../../domain/ports/consulta-odontologica.repository.port.js';
import type { IOutboxRepositoryPort } from '../../../../outbox/domain/ports/outbox-repository.port.js';
import { ConsultaOdontologica } from '../../../domain/entities/consulta-odontologica.entity.js';
import { HistoriaClinicaId } from '../../../domain/value-objects/historia-clinica-id.vo.js';
import { PacienteId } from '../../../domain/value-objects/paciente-id.vo.js';
import { OdontologoId } from '../../../domain/value-objects/odontologo-id.vo.js';
import { SnapshotRiesgoClinico } from '../../../domain/value-objects/snapshot-riesgo-clinico.vo.js';
import { MotivoConsulta } from '../../../domain/value-objects/motivo-consulta.vo.js';
import { OutboxEvent } from '../../../../outbox/domain/entities/outbox-event.entity.js';
import { TransaccionesNoSoportadasError } from '../../../domain/errors/transacciones-no-soportadas.error.js';
import { ConflictoConcurrenteConsultaError } from '../../../domain/errors/conflicto-concurrente-consulta.error.js';

describe('MongoUnitOfWorkCierreConsultaAdapter', () => {
  let adapter: MongoUnitOfWorkCierreConsultaAdapter;
  let mockConnection: Partial<Connection>;
  let mockSession: Partial<ClientSession>;
  let mockConsultaRepository: Partial<IConsultaOdontologicaRepositoryPort>;
  let mockOutboxRepository: Partial<IOutboxRepositoryPort>;

  const consulta = ConsultaOdontologica.abrir({
    historiaClinicaId: HistoriaClinicaId.crear('hc_123'),
    pacienteId: PacienteId.crear('pac_123'),
    odontologoId: OdontologoId.crear('od_001'),
    versionHistoriaReferenciada: 1,
    snapshotRiesgoClinico: SnapshotRiesgoClinico.vacio(),
    motivoConsulta: MotivoConsulta.crear('Dolor molar'),
  });

  const eventoOutbox = OutboxEvent.crear({
    aggregateId: '70000000-0000-0000-0000-000000000001',
    aggregateType: 'ConsultaOdontologica',
    eventType: 'clinica.consulta.finalizada',
    payload: { consultaId: '70000000-0000-0000-0000-000000000001' },
  });

  beforeEach(() => {
    mockSession = {
      withTransaction: vi.fn().mockImplementation(async (callback: () => Promise<void>) => {
        return callback();
      }),
      endSession: vi.fn().mockResolvedValue(undefined),
    };

    mockConnection = {
      getClient: vi.fn().mockReturnValue({
        topology: {
          description: {
            type: 'ReplicaSetWithPrimary',
          },
        },
      }),
      startSession: vi.fn().mockResolvedValue(mockSession as ClientSession),
    };

    mockConsultaRepository = {
      actualizar: vi.fn().mockResolvedValue(undefined),
    };

    mockOutboxRepository = {
      guardar: vi.fn().mockResolvedValue(undefined),
    };

    adapter = new MongoUnitOfWorkCierreConsultaAdapter(
      mockConnection as Connection,
      mockConsultaRepository as IConsultaOdontologicaRepositoryPort,
      mockOutboxRepository as IOutboxRepositoryPort,
    );
  });

  it('1. debe ejecutar commit atómico coordinando la actualización de la consulta y el outbox en la misma sesión', async () => {
    await adapter.ejecutarCierreConOutbox(consulta, 1, eventoOutbox);

    expect(mockConnection.startSession).toHaveBeenCalledTimes(1);
    expect(mockSession.withTransaction).toHaveBeenCalledTimes(1);
    expect(mockConsultaRepository.actualizar).toHaveBeenCalledWith(consulta, 1, mockSession);
    expect(mockOutboxRepository.guardar).toHaveBeenCalledWith(eventoOutbox, mockSession);
    expect(mockSession.endSession).toHaveBeenCalledTimes(1);
  });

  it('2. debe rechazar de forma inmediata si la topología del cliente es Single (MongoDB Standalone)', async () => {
    (mockConnection.getClient as ReturnType<typeof vi.fn>).mockReturnValue({
      topology: {
        description: {
          type: 'Single',
        },
      },
    });

    await expect(
      adapter.ejecutarCierreConOutbox(consulta, 1, eventoOutbox),
    ).rejects.toThrow(TransaccionesNoSoportadasError);

    expect(mockConnection.startSession).not.toHaveBeenCalled();
    expect(mockConsultaRepository.actualizar).not.toHaveBeenCalled();
    expect(mockOutboxRepository.guardar).not.toHaveBeenCalled();
  });

  it('3. debe hacer rollback y propagar ConflictoConcurrenteConsultaError si falla la concurrencia optimista', async () => {
    const errorConcurrencia = new ConflictoConcurrenteConsultaError(consulta.id.valor, 1);
    mockConsultaRepository.actualizar = vi.fn().mockRejectedValue(errorConcurrencia);

    await expect(
      adapter.ejecutarCierreConOutbox(consulta, 1, eventoOutbox),
    ).rejects.toThrow(ConflictoConcurrenteConsultaError);

    expect(mockOutboxRepository.guardar).not.toHaveBeenCalled();
    expect(mockSession.endSession).toHaveBeenCalledTimes(1);
  });

  it('4. debe hacer rollback y propagar error si outboxRepository falla durante la transacción', async () => {
    mockOutboxRepository.guardar = vi.fn().mockRejectedValue(new Error('Fallo de disco o red en MongoDB'));

    await expect(
      adapter.ejecutarCierreConOutbox(consulta, 1, eventoOutbox),
    ).rejects.toThrow('Fallo de disco o red en MongoDB');

    expect(mockConsultaRepository.actualizar).toHaveBeenCalledTimes(1);
    expect(mockSession.endSession).toHaveBeenCalledTimes(1);
  });

  it('5. debe transformar errores de MongoDB código 20 (IllegalOperation / Standalone) en TransaccionesNoSoportadasError', async () => {
    mockSession.withTransaction = vi.fn().mockRejectedValue({
      code: 20,
      message: 'Transaction numbers are only allowed on a replica set member or mongos',
    });

    await expect(
      adapter.ejecutarCierreConOutbox(consulta, 1, eventoOutbox),
    ).rejects.toThrow(TransaccionesNoSoportadasError);

    expect(mockSession.endSession).toHaveBeenCalledTimes(1);
  });

  it('6. debe transformar error de inicio de sesión sin soporte de transacciones en TransaccionesNoSoportadasError', async () => {
    mockConnection.startSession = vi.fn().mockRejectedValue({
      code: 20,
      message: 'Cannot start transaction: transactions are not supported by this server',
    });

    await expect(
      adapter.ejecutarCierreConOutbox(consulta, 1, eventoOutbox),
    ).rejects.toThrow(TransaccionesNoSoportadasError);
  });
});

