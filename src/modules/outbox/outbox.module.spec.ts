import { describe, it, expect, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { OutboxModule } from './outbox.module.js';
import { OutboxEventDocument } from './infrastructure/persistence/mongo/schemas/outbox-event.schema.js';
import { RABBITMQ_PUBLISHER_PORT } from './domain/ports/rabbitmq-publisher.port.js';
import { MockRabbitMqPublisherAdapter } from './infrastructure/messaging/mock-rabbitmq-publisher.adapter.js';
import { AmqpRabbitMqPublisherAdapter } from './infrastructure/messaging/amqp-rabbitmq-publisher.adapter.js';

describe('OutboxModule DI Resolution', () => {
  const mockModel = {
    create: vi.fn(),
    findById: vi.fn(),
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    updateMany: vi.fn(),
  };

  const crearModulo = async (adapterType?: string): Promise<TestingModule> => {
    return Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              RABBITMQ_PUBLISHER_ADAPTER: adapterType,
            }),
          ],
        }),
        OutboxModule,
      ],
    })
      .overrideProvider(getModelToken(OutboxEventDocument.name))
      .useValue(mockModel)
      .compile();
  };

  it('1. debe resolver MockRabbitMqPublisherAdapter por defecto cuando RABBITMQ_PUBLISHER_ADAPTER es mock o indefinido', async () => {
    const moduleRef = await crearModulo('mock');
    const publisher = moduleRef.get(RABBITMQ_PUBLISHER_PORT);

    expect(publisher).toBeInstanceOf(MockRabbitMqPublisherAdapter);
    await moduleRef.close();
  });

  it('2. debe resolver AmqpRabbitMqPublisherAdapter cuando RABBITMQ_PUBLISHER_ADAPTER es amqp', async () => {
    const moduleRef = await crearModulo('amqp');
    const publisher = moduleRef.get(RABBITMQ_PUBLISHER_PORT);

    expect(publisher).toBeInstanceOf(AmqpRabbitMqPublisherAdapter);
    // Verificar que no se conecta en el arranque
    expect((publisher as AmqpRabbitMqPublisherAdapter).isConnected()).toBe(false);
    await moduleRef.close();
  });
});
