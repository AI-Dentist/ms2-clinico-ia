import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OutboxRelayWorker } from './outbox-relay.worker.js';
import type { IOutboxRepositoryPort } from '../../domain/ports/outbox-repository.port.js';
import type { IRabbitMqPublisherPort } from '../../domain/ports/rabbitmq-publisher.port.js';
import { OutboxEvent } from '../../domain/entities/outbox-event.entity.js';

describe('OutboxRelayWorker', () => {
  let mockRepository: {
    guardar: ReturnType<typeof vi.fn>;
    buscarPorId: ReturnType<typeof vi.fn>;
    reclamarLote: ReturnType<typeof vi.fn>;
    actualizar: ReturnType<typeof vi.fn>;
    limpiarLeasesExpirados: ReturnType<typeof vi.fn>;
  };

  let mockPublisher: {
    publicar: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockRepository = {
      guardar: vi.fn(),
      buscarPorId: vi.fn(),
      reclamarLote: vi.fn(),
      actualizar: vi.fn().mockResolvedValue(undefined),
      limpiarLeasesExpirados: vi.fn(),
    };

    mockPublisher = {
      publicar: vi.fn().mockResolvedValue(undefined),
    };
  });

  it('no debe activar el timer de polling si enabled es false', () => {
    const worker = new OutboxRelayWorker(
      mockRepository as unknown as IOutboxRepositoryPort,
      mockPublisher as unknown as IRabbitMqPublisherPort,
      undefined,
      { enabled: false },
    );

    worker.onApplicationBootstrap();
    expect(worker.isActivo()).toBe(false);
    worker.onApplicationShutdown();
  });

  it('debe activar y detener el timer si enabled es true', () => {
    const worker = new OutboxRelayWorker(
      mockRepository as unknown as IOutboxRepositoryPort,
      mockPublisher as unknown as IRabbitMqPublisherPort,
      undefined,
      { enabled: true, pollIntervalMs: 10000 },
    );

    worker.onApplicationBootstrap();
    expect(worker.isActivo()).toBe(true);

    worker.onApplicationShutdown();
    expect(worker.isActivo()).toBe(false);
  });

  it('debe retornar 0 si no hay eventos pendientes para reclamar', async () => {
    mockRepository.reclamarLote.mockResolvedValue([]);

    const worker = new OutboxRelayWorker(
      mockRepository as unknown as IOutboxRepositoryPort,
      mockPublisher as unknown as IRabbitMqPublisherPort,
      undefined,
      { enabled: false },
    );

    const publicados = await worker.procesarLotePendientes();
    expect(publicados).toBe(0);
    expect(mockPublisher.publicar).not.toHaveBeenCalled();
  });

  it('debe publicar eventos reclamados y marcarlos como PUBLICADO al recibir confirmación', async () => {
    const evento = OutboxEvent.crear({
      aggregateId: '70000000-0000-0000-0000-000000000001',
      aggregateType: 'ConsultaOdontologica',
      eventType: 'clinica.consulta.finalizada',
      payload: {
        consultaId: '70000000-0000-0000-0000-000000000001',
        pacienteId: '60000000-0000-0000-0000-000000000001',
        serviciosRealizados: [
          {
            servicioId: '90000000-0000-0000-0000-000000000001',
            cantidad: 1,
            precioUnitarioBs: '150.00',
            piezaDental: '16',
          },
        ],
      },
    });

    // Simulamos que el repositorio lo reclamó asignándole el workerId
    const worker = new OutboxRelayWorker(
      mockRepository as unknown as IOutboxRepositoryPort,
      mockPublisher as unknown as IRabbitMqPublisherPort,
      undefined,
      { enabled: false, exchange: 'dental.topic.exchange', routingKey: 'clinica.consulta.finalizada' },
    );
    evento.reclamar(worker.getWorkerId(), 30000);

    mockRepository.reclamarLote.mockResolvedValue([evento]);

    const publicados = await worker.procesarLotePendientes();

    expect(publicados).toBe(1);
    expect(mockPublisher.publicar).toHaveBeenCalledWith(
      'dental.topic.exchange',
      'clinica.consulta.finalizada',
      evento.payload,
      {
        messageId: evento.id,
        correlationId: evento.aggregateId,
      },
    );
    expect(evento.status).toBe('PUBLICADO');
    expect(evento.publishedAt).toBeInstanceOf(Date);
    expect(mockRepository.actualizar).toHaveBeenCalledWith(evento);
  });

  it('debe registrar fallo con backoff si el publisher lanza un error', async () => {
    const evento = OutboxEvent.crear({
      aggregateId: '70000000-0000-0000-0000-000000000001',
      aggregateType: 'ConsultaOdontologica',
      eventType: 'clinica.consulta.finalizada',
      payload: { test: true },
      maxAttempts: 3,
    });

    const worker = new OutboxRelayWorker(
      mockRepository as unknown as IOutboxRepositoryPort,
      mockPublisher as unknown as IRabbitMqPublisherPort,
      undefined,
      { enabled: false, maxAttempts: 3 },
    );
    evento.reclamar(worker.getWorkerId(), 30000);

    mockRepository.reclamarLote.mockResolvedValue([evento]);
    mockPublisher.publicar.mockRejectedValue(new Error('Broker connection refused'));

    const publicados = await worker.procesarLotePendientes();

    expect(publicados).toBe(0);
    expect(evento.status).toBe('PENDIENTE');
    expect(evento.attempts).toBe(1);
    expect(evento.lastError).toBe('Broker connection refused');
    expect(evento.nextRetryAt).toBeInstanceOf(Date);
    expect(mockRepository.actualizar).toHaveBeenCalledWith(evento);
  });

  it('debe pasar a ERROR_FATAL si los intentos alcanzan maxAttempts', async () => {
    const evento = OutboxEvent.crear({
      aggregateId: '70000000-0000-0000-0000-000000000001',
      aggregateType: 'ConsultaOdontologica',
      eventType: 'clinica.consulta.finalizada',
      payload: { test: true },
      maxAttempts: 1,
    });

    const worker = new OutboxRelayWorker(
      mockRepository as unknown as IOutboxRepositoryPort,
      mockPublisher as unknown as IRabbitMqPublisherPort,
      undefined,
      { enabled: false, maxAttempts: 1 },
    );
    evento.reclamar(worker.getWorkerId(), 30000);

    mockRepository.reclamarLote.mockResolvedValue([evento]);
    mockPublisher.publicar.mockRejectedValue(new Error('Mensaje no enrutable (NO_ROUTE)'));

    const publicados = await worker.procesarLotePendientes();

    expect(publicados).toBe(0);
    expect(evento.status).toBe('ERROR_FATAL');
    expect(evento.attempts).toBe(1);
    expect(evento.lastError).toBe('Mensaje no enrutable (NO_ROUTE)');
    expect(mockRepository.actualizar).toHaveBeenCalledWith(evento);
  });
});
