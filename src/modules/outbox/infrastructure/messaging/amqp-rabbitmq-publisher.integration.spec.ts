import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import amqp, { type ChannelModel, type Channel } from 'amqplib';
import { randomUUID } from 'node:crypto';
import { AmqpRabbitMqPublisherAdapter } from './amqp-rabbitmq-publisher.adapter.js';

describe('AmqpRabbitMqPublisherAdapter (Isolated Real Integration Tests)', () => {
  const RABBITMQ_URL =
    process.env.RABBITMQ_URL || 'amqp://erp_user:erp_password@localhost:5672/';

  const TEST_EXCHANGE = 'ms2.test.isolated.exchange';
  const TEST_QUEUE = 'ms2.test.isolated.queue';
  const ROUTING_KEY_VALIDA = 'ms2.test.consulta.finalizada';
  const ROUTING_KEY_SIN_RUTA = 'ms2.test.ruta.inexistente';

  let rawConnection: ChannelModel;
  let rawChannel: Channel;
  let adapter: AmqpRabbitMqPublisherAdapter;

  const validPayload = {
    consultaId: '99000000-0000-0000-0000-000000000001',
    pacienteId: '60000000-0000-0000-0000-000000000001',
    odontologoId: '80000000-0000-0000-0000-000000000001',
    serviciosRealizados: [
      {
        servicioId: '90000000-0000-0000-0000-000000000001',
        cantidad: 2,
        precioUnitarioBs: '250.50',
        piezaDental: '18',
      },
    ],
  };

  beforeAll(async () => {
    // 1. Conectar con cliente amqplib auxiliar para aprovisionar exclusivamente los recursos temporales de prueba
    rawConnection = await amqp.connect(RABBITMQ_URL);
    rawChannel = await rawConnection.createChannel();

    // 2. Crear exchange temporal aislado (topic, autoDelete: true, durable: false)
    await rawChannel.assertExchange(TEST_EXCHANGE, 'topic', {
      durable: false,
      autoDelete: true,
    });

    // 3. Crear cola temporal aislada (durable: true, autoDelete: true para compatibilidad con RabbitMQ 4.x)
    await rawChannel.assertQueue(TEST_QUEUE, {
      durable: true,
      autoDelete: true,
    });

    // 4. Vincular cola al exchange temporal con la routing key de prueba
    await rawChannel.bindQueue(TEST_QUEUE, TEST_EXCHANGE, ROUTING_KEY_VALIDA);

    // 5. Instanciar el adaptador real apuntando a los recursos temporales aislados
    adapter = new AmqpRabbitMqPublisherAdapter(undefined, {
      url: RABBITMQ_URL,
      exchange: TEST_EXCHANGE,
      routingKey: ROUTING_KEY_VALIDA,
      defaultTimeoutMs: 5000,
    });
  });

  afterAll(async () => {
    // 1. Cerrar recursos del adaptador
    if (adapter) {
      await adapter.onApplicationShutdown();
    }

    // 2. Limpieza determinista de recursos temporales en RabbitMQ
    if (rawChannel) {
      try {
        await rawChannel.unbindQueue(TEST_QUEUE, TEST_EXCHANGE, ROUTING_KEY_VALIDA).catch(() => {});
        await rawChannel.deleteQueue(TEST_QUEUE).catch(() => {});
        await rawChannel.deleteExchange(TEST_EXCHANGE).catch(() => {});
        await rawChannel.close().catch(() => {});
      } catch {
        // Ignorar errores en cleanup
      }
    }

    if (rawConnection) {
      try {
        await rawConnection.close().catch(() => {});
      } catch {
        // Ignorar errores en cleanup
      }
    }
  });

  it('1. debe conectar con el broker RabbitMQ real y obtener ConfirmChannel bajo demanda', async () => {
    expect(adapter.isConnected()).toBe(false);

    const confirmChannel = await adapter.obtenerCanalConfirmacion();
    expect(confirmChannel).toBeDefined();
    expect(adapter.isConnected()).toBe(true);
  });

  it('2. debe publicar un mensaje con Publisher Confirms (ACK), mandatory=true y persistent=true hacia el exchange temporal', async () => {
    const testMessageId = randomUUID();
    const testCorrelationId = randomUUID();

    // Publicar hacia el exchange temporal aislado
    await expect(
      adapter.publicar(TEST_EXCHANGE, ROUTING_KEY_VALIDA, validPayload, {
        messageId: testMessageId,
        correlationId: testCorrelationId,
        timeoutMs: 3000,
      }),
    ).resolves.toBeUndefined();

    // Consumir el mensaje directamente desde la cola temporal aislada con el canal auxiliar
    const msg = await rawChannel.get(TEST_QUEUE, { noAck: true });
    expect(msg).not.toBe(false);

    if (msg) {
      expect(msg.properties.messageId).toBe(testMessageId);
      expect(msg.properties.correlationId).toBe(testCorrelationId);
      expect(msg.properties.deliveryMode).toBe(2); // persistent: true
      expect(msg.properties.contentType).toBe('application/json');
      expect(msg.properties.contentEncoding).toBe('utf-8');

      const body = JSON.parse(msg.content.toString('utf8'));
      expect(body.consultaId).toBe(validPayload.consultaId);
      expect(body.pacienteId).toBe(validPayload.pacienteId);
      expect(body.odontologoId).toBe(validPayload.odontologoId);
      expect(body.serviciosRealizados).toHaveLength(1);
      expect(body.serviciosRealizados[0].servicioId).toBe(
        validPayload.serviciosRealizados[0].servicioId,
      );
      expect(body.serviciosRealizados[0].cantidad).toBe(2);
      expect(body.serviciosRealizados[0].precioUnitarioBs).toBe('250.50');
      expect(body.serviciosRealizados[0].piezaDental).toBe('18');
      expect(body).not.toHaveProperty('payload'); // Formato plano sin wrapper
    }
  });

  it('3. debe detectar NO_ROUTE y rechazar con error cuando routing key no tiene enlace (mandatory=true)', async () => {
    const unroutableMsgId = randomUUID();

    // Intentar publicar con una routing key no enlazada
    await expect(
      adapter.publicar(TEST_EXCHANGE, ROUTING_KEY_SIN_RUTA, validPayload, {
        messageId: unroutableMsgId,
        timeoutMs: 3000,
      }),
    ).rejects.toThrow(/\[RabbitMQ NO_ROUTE\]/);
  });

  it('4. debe recuperarse automáticamente si el canal se cierra y permitir publicar en la siguiente llamada', async () => {
    // 1. Obtener el canal de confirmación actual y forzar su cierre
    const canalActual = await adapter.obtenerCanalConfirmacion();
    await canalActual.close();

    // 2. La siguiente publicación debe detectar que el canal no está disponible, reconectar y completar exitosamente
    const recoveryMsgId = randomUUID();
    await expect(
      adapter.publicar(TEST_EXCHANGE, ROUTING_KEY_VALIDA, validPayload, {
        messageId: recoveryMsgId,
        timeoutMs: 3000,
      }),
    ).resolves.toBeUndefined();

    // 3. Verificar que el mensaje llegó a la cola temporal
    const msg = await rawChannel.get(TEST_QUEUE, { noAck: true });
    expect(msg).not.toBe(false);
    if (msg) {
      expect(msg.properties.messageId).toBe(recoveryMsgId);
    }
  });
});

