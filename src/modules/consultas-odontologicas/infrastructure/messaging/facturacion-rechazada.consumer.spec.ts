import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Channel, ConsumeMessage } from 'amqplib';
import { FacturacionRechazadaConsumer } from './facturacion-rechazada.consumer.js';
import type { RevertirCierrePorRechazoUseCase } from '../../application/use-cases/revertir-cierre-por-rechazo.use-case.js';

describe('FacturacionRechazadaConsumer', () => {
  let mockUseCase: { execute: ReturnType<typeof vi.fn> };
  let mockChannel: {
    ack: ReturnType<typeof vi.fn>;
    nack: ReturnType<typeof vi.fn>;
    assertExchange: ReturnType<typeof vi.fn>;
    assertQueue: ReturnType<typeof vi.fn>;
    bindQueue: ReturnType<typeof vi.fn>;
    consume: ReturnType<typeof vi.fn>;
  };
  let consumer: FacturacionRechazadaConsumer;

  beforeEach(() => {
    mockUseCase = {
      execute: vi.fn().mockResolvedValue({ revertida: true }),
    };

    mockChannel = {
      ack: vi.fn(),
      nack: vi.fn(),
      assertExchange: vi.fn().mockResolvedValue({}),
      assertQueue: vi.fn().mockResolvedValue({}),
      bindQueue: vi.fn().mockResolvedValue({}),
      consume: vi.fn().mockResolvedValue({ consumerTag: 'tag-123' }),
    };

    consumer = new FacturacionRechazadaConsumer(
      mockUseCase as unknown as RevertirCierrePorRechazoUseCase,
      undefined,
      { enabled: false, initialBackoffMs: 0, maxBackoffMs: 0, sleepFn: vi.fn() },
    );
  });

  const validPayload = {
    eventId: '11111111-1111-4111-8111-111111111111',
    consultaId: '22222222-2222-4222-8222-222222222222',
    consultaFinalizadaEventId: '33333333-3333-4333-8333-333333333333',
    motivoCodigo: 'SERVICIO_INACTIVO',
    motivo: 'El servicio ENDO-01 se encuentra inactivo en el ERP',
    rechazadaEn: '2026-11-05T09:10:00.000Z',
  };

  it('1. Debe procesar payload válido, ejecutar el caso de uso y hacer ACK', async () => {
    const rawContent = JSON.stringify(validPayload);
    const mockMsg = {
      content: Buffer.from(rawContent),
      properties: {},
      fields: {},
    } as unknown as ConsumeMessage;

    await consumer.procesarMensaje(mockMsg, mockChannel as unknown as Channel);

    expect(mockUseCase.execute).toHaveBeenCalledWith({
      eventId: validPayload.eventId,
      consultaId: validPayload.consultaId,
      consultaFinalizadaEventId: validPayload.consultaFinalizadaEventId,
      motivoCodigo: validPayload.motivoCodigo,
      motivo: validPayload.motivo,
      rechazadaEn: new Date(validPayload.rechazadaEn),
    });
    expect(mockChannel.ack).toHaveBeenCalledWith(mockMsg);
    expect(mockChannel.nack).not.toHaveBeenCalled();
  });

  it('2. Debe enviar a DLQ (nack sin requeue) cuando el JSON es inválido o corrupto', async () => {
    const mockMsg = {
      content: Buffer.from('{ corrupt json...'),
      properties: {},
      fields: {},
    } as unknown as ConsumeMessage;

    await consumer.procesarMensaje(mockMsg, mockChannel as unknown as Channel);

    expect(mockChannel.nack).toHaveBeenCalledWith(mockMsg, false, false);
    expect(mockChannel.ack).not.toHaveBeenCalled();
    expect(mockUseCase.execute).not.toHaveBeenCalled();
  });

  it('3. Debe enviar a DLQ (nack sin requeue) cuando faltan campos requeridos por el contrato', async () => {
    const invalidPayload = {
      eventId: '11111111-1111-4111-8111-111111111111',
      consultaId: '22222222-2222-4222-8222-222222222222',
      // Falta consultaFinalizadaEventId
      motivoCodigo: 'SERVICIO_INACTIVO',
      motivo: 'Falta campo requerido',
      rechazadaEn: '2026-11-05T09:10:00.000Z',
    };
    const mockMsg = {
      content: Buffer.from(JSON.stringify(invalidPayload)),
      properties: {},
      fields: {},
    } as unknown as ConsumeMessage;

    await consumer.procesarMensaje(mockMsg, mockChannel as unknown as Channel);

    expect(mockChannel.nack).toHaveBeenCalledWith(mockMsg, false, false);
    expect(mockChannel.ack).not.toHaveBeenCalled();
    expect(mockUseCase.execute).not.toHaveBeenCalled();
  });

  it('4. Debe enviar a DLQ (nack sin requeue) cuando un UUID tiene formato inválido', async () => {
    const invalidUuidPayload = {
      ...validPayload,
      consultaId: 'no-es-un-uuid',
    };
    const mockMsg = {
      content: Buffer.from(JSON.stringify(invalidUuidPayload)),
      properties: {},
      fields: {},
    } as unknown as ConsumeMessage;

    await consumer.procesarMensaje(mockMsg, mockChannel as unknown as Channel);

    expect(mockChannel.nack).toHaveBeenCalledWith(mockMsg, false, false);
    expect(mockChannel.ack).not.toHaveBeenCalled();
    expect(mockUseCase.execute).not.toHaveBeenCalled();
  });

  it('5. Debe reintentar con backoff ante fallo transitorio y hacer ACK si un reintento tiene éxito', async () => {
    // Falla en el intento 1 pero tiene éxito en el intento 2
    mockUseCase.execute
      .mockRejectedValueOnce(new Error('MongoNetworkTimeoutException'))
      .mockResolvedValueOnce({ revertido: true, motivo: 'EXITO' });

    const mockMsg = {
      content: Buffer.from(JSON.stringify(validPayload)),
      properties: {},
      fields: {},
    } as unknown as ConsumeMessage;

    await consumer.procesarMensaje(mockMsg, mockChannel as unknown as Channel);

    expect(mockUseCase.execute).toHaveBeenCalledTimes(2);
    expect(mockChannel.ack).toHaveBeenCalledWith(mockMsg);
    expect(mockChannel.nack).not.toHaveBeenCalled();
  });

  it('6. Debe enviar a DLQ (nack sin requeue) y log estructurado al agotar reintentos por fallo transitorio', async () => {
    mockUseCase.execute.mockRejectedValue(new Error('MongoClusterUnavailableException'));

    const loggerErrorSpy = vi.spyOn((consumer as any).logger, 'error');

    const mockMsg = {
      content: Buffer.from(JSON.stringify(validPayload)),
      properties: {},
      fields: {},
    } as unknown as ConsumeMessage;

    await consumer.procesarMensaje(mockMsg, mockChannel as unknown as Channel);

    expect(mockUseCase.execute).toHaveBeenCalledTimes(4); // default 4 intentos
    expect(mockChannel.nack).toHaveBeenCalledWith(mockMsg, false, false); // DLQ
    expect(mockChannel.ack).not.toHaveBeenCalled();
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Reintentos agotados'),
        eventId: validPayload.eventId,
        consultaId: validPayload.consultaId,
        intentos: 4,
        maxIntentos: 4,
        error: 'MongoClusterUnavailableException',
      }),
    );
  });

  it('7. Debe hacer ACK (no DLQ) cuando la consulta no existe o no está completada (manejado por el use case)', async () => {
    // El caso de uso retorna revertido: false sin lanzar excepción
    mockUseCase.execute.mockResolvedValueOnce({ revertido: false, motivo: 'CONSULTA_NO_COMPLETADA' });

    const mockMsg = {
      content: Buffer.from(JSON.stringify(validPayload)),
      properties: {},
      fields: {},
    } as unknown as ConsumeMessage;

    await consumer.procesarMensaje(mockMsg, mockChannel as unknown as Channel);

    expect(mockChannel.ack).toHaveBeenCalledWith(mockMsg);
    expect(mockChannel.nack).not.toHaveBeenCalled();
  });
});
