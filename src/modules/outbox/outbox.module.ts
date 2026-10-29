import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import {
  OutboxEventDocument,
  OutboxEventSchema,
} from './infrastructure/persistence/mongo/schemas/outbox-event.schema.js';
import { MongoOutboxRepository } from './infrastructure/persistence/mongo/repositories/mongo-outbox.repository.js';
import { OUTBOX_REPOSITORY_PORT } from './domain/ports/outbox-repository.port.js';
import { MockRabbitMqPublisherAdapter } from './infrastructure/messaging/mock-rabbitmq-publisher.adapter.js';
import { RABBITMQ_PUBLISHER_PORT } from './domain/ports/rabbitmq-publisher.port.js';
import { OutboxRelayWorker } from './infrastructure/workers/outbox-relay.worker.js';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: OutboxEventDocument.name, schema: OutboxEventSchema },
    ]),
  ],
  providers: [
    MongoOutboxRepository,
    {
      provide: OUTBOX_REPOSITORY_PORT,
      useClass: MongoOutboxRepository,
    },
    MockRabbitMqPublisherAdapter,
    {
      provide: RABBITMQ_PUBLISHER_PORT,
      useFactory: (
        mockAdapter: MockRabbitMqPublisherAdapter,
        configService?: ConfigService,
      ) => {
        const adapterType =
          configService?.get<string>('RABBITMQ_PUBLISHER_ADAPTER') ??
          process.env.RABBITMQ_PUBLISHER_ADAPTER ??
          'mock';

        if (adapterType === 'amqp') {
          // El adaptador real AMQP se conectará cuando el usuario lo habilite explícitamente
          return mockAdapter;
        }
        return mockAdapter;
      },
      inject: [
        MockRabbitMqPublisherAdapter,
        { token: ConfigService, optional: true },
      ],
    },
    OutboxRelayWorker,
  ],
  exports: [
    OUTBOX_REPOSITORY_PORT,
    RABBITMQ_PUBLISHER_PORT,
    OutboxRelayWorker,
  ],
})
export class OutboxModule {}

