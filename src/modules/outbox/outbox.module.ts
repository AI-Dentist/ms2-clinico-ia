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
import { AmqpRabbitMqPublisherAdapter } from './infrastructure/messaging/amqp-rabbitmq-publisher.adapter.js';
import { RABBITMQ_PUBLISHER_PORT } from './domain/ports/rabbitmq-publisher.port.js';
import { OutboxRelayWorker } from './infrastructure/workers/outbox-relay.worker.js';
import { OutboxController } from './infrastructure/http/outbox.controller.js';
import { AuthModule } from '../../infrastructure/auth/auth.module.js';
import { OdontologoAuthGuard } from './infrastructure/http/guards/odontologo-auth.guard.js';

@Module({
  imports: [
    ConfigModule,
    AuthModule,
    MongooseModule.forFeature([
      { name: OutboxEventDocument.name, schema: OutboxEventSchema },
    ]),
  ],
  controllers: [OutboxController],
  providers: [
    MongoOutboxRepository,
    {
      provide: OUTBOX_REPOSITORY_PORT,
      useClass: MongoOutboxRepository,
    },
    MockRabbitMqPublisherAdapter,
    AmqpRabbitMqPublisherAdapter,
    {
      provide: RABBITMQ_PUBLISHER_PORT,
      useFactory: (
        mockAdapter: MockRabbitMqPublisherAdapter,
        amqpAdapter: AmqpRabbitMqPublisherAdapter,
        configService?: ConfigService,
      ) => {
        const adapterType =
          configService?.get<string>('RABBITMQ_PUBLISHER_ADAPTER') ??
          process.env.RABBITMQ_PUBLISHER_ADAPTER ??
          'mock';

        if (adapterType === 'amqp') {
          return amqpAdapter;
        }
        return mockAdapter;
      },
      inject: [
        MockRabbitMqPublisherAdapter,
        AmqpRabbitMqPublisherAdapter,
        { token: ConfigService, optional: true },
      ],
    },
    OutboxRelayWorker,
    OdontologoAuthGuard,
  ],
  exports: [
    OUTBOX_REPOSITORY_PORT,
    RABBITMQ_PUBLISHER_PORT,
    MockRabbitMqPublisherAdapter,
    AmqpRabbitMqPublisherAdapter,
    OutboxRelayWorker,
    OdontologoAuthGuard,
  ],
})
export class OutboxModule {}


