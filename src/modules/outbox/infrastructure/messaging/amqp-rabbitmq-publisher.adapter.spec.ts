import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import amqp, { type ChannelModel, type ConfirmChannel, type ConsumeMessage } from 'amqplib';
import { EventEmitter } from 'node:events';
import { AmqpRabbitMqPublisherAdapter } from './amqp-rabbitmq-publisher.adapter.js';

vi.mock('amqplib');

class MockConfirmChannel extends EventEmitter {
  publish = vi.fn();
  close = vi.fn().mockResolvedValue(undefined);
}

class MockConnection extends EventEmitter {
  createConfirmChannel = vi.fn();
  close = vi.fn().mockResolvedValue(undefined);
}

describe('AmqpRabbitMqPublisherAdapter (Isolated Unit Tests)', () => {
  let adapter: AmqpRabbitMqPublisherAdapter;
  let mockConn: MockConnection;
  let mockChannel: MockConfirmChannel;

  const validPayload = {
    consultaId: '70000000-0000-0000-0000-000000000001',
    pacienteId: '60000000-0000-0000-0000-000000000001',
    odontologoId: '80000000-0000-0000-0000-000000000001',
    serviciosRealizados: [
      {
        servicioId: '90000000-0000-0000-0000-000000000001',
        cantidad: 1,
        precioUnitarioBs: '150.00',
        piezaDental: '16',
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockChannel = new MockConfirmChannel();
    mockConn = new MockConnection();
    mockConn.createConfirmChannel.mockResolvedValue(mockChannel as unknown as ConfirmChannel);

    vi.mocked(amqp.connect).mockResolvedValue(mockConn as unknown as ChannelModel);

    adapter = new AmqpRabbitMqPublisherAdapter(undefined, {
      url: 'amqp://user:pass@localhost:5672/',
      exchange: 'dental.topic.exchange',
      routingKey: 'clinica.consulta.finalizada',
      defaultTimeoutMs: 1000,
    });
  });

  afterEach(async () => {
    await adapter.onApplicationShutdown();
  });

  it('1. no debe conectar a RabbitMQ al instanciar el adaptador (lazy connection)', () => {
    expect(amqp.connect).not.toHaveBeenCalled();
    expect(adapter.isConnected()).toBe(false);
  });

  it('2. debe publicar con Publisher Confirms, mandatory=true, persistent=true y resolver al recibir ACK', async () => {
    mockChannel.publish.mockImplementation(
      (
        _exchange: string,
        _routingKey: string,
        _content: Buffer,
        _options: unknown,
        callback: (err: Error | null) => void,
      ) => {
        // Simular respuesta ACK inmediata del broker RabbitMQ
        callback(null);
        return true;
      },
    );

    await expect(
      adapter.publicar(
        'dental.topic.exchange',
        'clinica.consulta.finalizada',
        validPayload,
        { messageId: 'msg-001', correlationId: 'corr-001' },
      ),
    ).resolves.toBeUndefined();

    expect(amqp.connect).toHaveBeenCalledWith('amqp://user:pass@localhost:5672/');
    expect(mockConn.createConfirmChannel).toHaveBeenCalledTimes(1);
    expect(mockChannel.publish).toHaveBeenCalledWith(
      'dental.topic.exchange',
      'clinica.consulta.finalizada',
      expect.any(Buffer),
      expect.objectContaining({
        persistent: true,
        mandatory: true,
        contentType: 'application/json',
        messageId: 'msg-001',
        correlationId: 'corr-001',
      }),
      expect.any(Function),
    );
    expect(adapter.isConnected()).toBe(true);
  });

  it('3. debe rechazar si el broker responde NACK (error en confirmación)', async () => {
    mockChannel.publish.mockImplementation(
      (
        _exchange: string,
        _routingKey: string,
        _content: Buffer,
        _options: unknown,
        callback: (err: Error | null) => void,
      ) => {
        callback(new Error('Queue disk full / internal broker nack'));
        return true;
      },
    );

    await expect(
      adapter.publicar(
        'dental.topic.exchange',
        'clinica.consulta.finalizada',
        validPayload,
        { messageId: 'msg-nack-01' },
      ),
    ).rejects.toThrow(/\[RabbitMQ NACK\] El broker rechazó el mensaje msg-nack-01/);
  });

  it('4. debe rechazar con [RabbitMQ NO_ROUTE] si el mensaje es devuelto por falta de ruta (evento return)', async () => {
    mockChannel.publish.mockImplementation(
      (
        exchange: string,
        routingKey: string,
        _content: Buffer,
        _options: unknown,
        callback: (err: Error | null) => void,
      ) => {
        // Simular evento 'return' antes del callback de confirmación
        const returnMsg: ConsumeMessage = {
          fields: {
            replyCode: 312,
            replyText: 'NO_ROUTE',
            exchange,
            routingKey,
          } as unknown,
          properties: {
            messageId: 'msg-unroutable-01',
          },
          content: Buffer.from('{}'),
        } as unknown as ConsumeMessage;

        mockChannel.emit('return', returnMsg);

        // RabbitMQ entrega un ACK tras emitir el return
        callback(null);
        return true;
      },
    );

    await expect(
      adapter.publicar(
        'dental.topic.exchange',
        'ruta.inexistente',
        validPayload,
        { messageId: 'msg-unroutable-01' },
      ),
    ).rejects.toThrow(/\[RabbitMQ NO_ROUTE\] Mensaje msg-unroutable-01 no enrutable/);
  });

  it('5. debe rechazar por timeout si el broker no responde dentro del tiempo límite', async () => {
    mockChannel.publish.mockImplementation(() => {
      // No llamar al callback para simular timeout de red o broker colgado
      return true;
    });

    await expect(
      adapter.publicar(
        'dental.topic.exchange',
        'clinica.consulta.finalizada',
        validPayload,
        { messageId: 'msg-timeout-01', timeoutMs: 50 },
      ),
    ).rejects.toThrow(/\[RabbitMQ Timeout\] Se superó el tiempo límite \(50ms\)/);
  });

  it('6. debe auto-recuperarse y reconectar si la conexión se cierra por error', async () => {
    // 1. Establecer conexión inicial
    mockChannel.publish.mockImplementation(
      (
        _e: string,
        _r: string,
        _c: Buffer,
        _o: unknown,
        callback: (err: Error | null) => void,
      ) => {
        callback(null);
        return true;
      },
    );

    await adapter.publicar('ex', 'rk', validPayload);
    expect(adapter.isConnected()).toBe(true);

    // 2. Simular desconexión por evento 'close' en la conexión
    mockConn.emit('close');
    expect(adapter.isConnected()).toBe(false);

    // 3. La siguiente publicación debe invocar connect nuevamente (reconexión transparente)
    await adapter.publicar('ex', 'rk', validPayload);
    expect(amqp.connect).toHaveBeenCalledTimes(2);
    expect(adapter.isConnected()).toBe(true);
  });

  it('7. debe cerrar canal y conexión ordenadamente en onApplicationShutdown', async () => {
    mockChannel.publish.mockImplementation(
      (
        _e: string,
        _r: string,
        _c: Buffer,
        _o: unknown,
        callback: (err: Error | null) => void,
      ) => {
        callback(null);
        return true;
      },
    );

    await adapter.publicar('ex', 'rk', validPayload);
    expect(adapter.isConnected()).toBe(true);

    await adapter.onApplicationShutdown();

    expect(mockChannel.close).toHaveBeenCalledTimes(1);
    expect(mockConn.close).toHaveBeenCalledTimes(1);
    expect(adapter.isConnected()).toBe(false);
  });

  it('8. debe rechazar mensajes que violan el contrato plano de MS1 antes de enviar a RabbitMQ', async () => {
    // A. Payload anidado
    await expect(
      adapter.publicar('ex', 'rk', { payload: validPayload }),
    ).rejects.toThrow('el mensaje NO debe contener el envoltorio anidado "payload"');

    // B. Prefijo cons_
    await expect(
      adapter.publicar('ex', 'rk', {
        ...validPayload,
        consultaId: 'cons_70000000-0000-0000-0000-000000000001',
      }),
    ).rejects.toThrow("no debe tener el prefijo 'cons_'");

    // C. Servicios vacíos
    await expect(
      adapter.publicar('ex', 'rk', {
        ...validPayload,
        serviciosRealizados: [],
      }),
    ).rejects.toThrow('requiere al menos un servicioRealizado');

    // D. Pieza dental como número en lugar de string o null
    await expect(
      adapter.publicar('ex', 'rk', {
        ...validPayload,
        serviciosRealizados: [
          {
            servicioId: '90000000-0000-0000-0000-000000000001',
            cantidad: 1,
            precioUnitarioBs: '150.00',
            piezaDental: 16 as unknown as string,
          },
        ],
      }),
    ).rejects.toThrow('La piezaDental debe ser string o null');

    // Ninguna llamada debió llegar a amqp.connect()
    expect(amqp.connect).not.toHaveBeenCalled();
  });
});

