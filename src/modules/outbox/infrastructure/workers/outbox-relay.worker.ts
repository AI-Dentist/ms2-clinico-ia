import {
  Injectable,
  Inject,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import {
  OUTBOX_REPOSITORY_PORT,
  type IOutboxRepositoryPort,
} from '../../domain/ports/outbox-repository.port.js';
import {
  RABBITMQ_PUBLISHER_PORT,
  type IRabbitMqPublisherPort,
} from '../../domain/ports/rabbitmq-publisher.port.js';

export interface OutboxRelayWorkerOptions {
  enabled?: boolean;
  pollIntervalMs?: number;
  batchSize?: number;
  maxAttempts?: number;
  leaseDurationMs?: number;
  exchange?: string;
  routingKey?: string;
}

@Injectable()
export class OutboxRelayWorker
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(OutboxRelayWorker.name);
  private timer: NodeJS.Timeout | null = null;
  private ejecutando = false;
  private readonly workerId: string;

  private readonly enabled: boolean;
  private readonly pollIntervalMs: number;
  private readonly batchSize: number;
  private readonly maxAttempts: number;
  private readonly leaseDurationMs: number;
  private readonly exchange: string;
  private readonly routingKey: string;

  constructor(
    @Inject(OUTBOX_REPOSITORY_PORT)
    private readonly repository: IOutboxRepositoryPort,
    @Inject(RABBITMQ_PUBLISHER_PORT)
    private readonly publisher: IRabbitMqPublisherPort,
    @Optional()
    configService?: ConfigService,
    @Optional()
    opcionesManuales?: OutboxRelayWorkerOptions,
  ) {
    this.workerId = `worker-${randomUUID().slice(0, 8)}`;

    const relayEnabled =
      opcionesManuales?.enabled ??
      (configService?.get<boolean>('OUTBOX_RELAY_ENABLED') ??
        process.env.OUTBOX_RELAY_ENABLED === 'true');
    this.enabled = relayEnabled;

    const pollInterval =
      opcionesManuales?.pollIntervalMs ??
      Number(
        configService?.get<number>('OUTBOX_POLL_INTERVAL_MS') ??
          process.env.OUTBOX_POLL_INTERVAL_MS ??
          3000,
      );
    this.pollIntervalMs = pollInterval > 0 ? pollInterval : 3000;

    const batch =
      opcionesManuales?.batchSize ??
      Number(
        configService?.get<number>('OUTBOX_BATCH_SIZE') ??
          process.env.OUTBOX_BATCH_SIZE ??
          10,
      );
    this.batchSize = batch > 0 ? batch : 10;

    const maxAtt =
      opcionesManuales?.maxAttempts ??
      Number(
        configService?.get<number>('OUTBOX_MAX_ATTEMPTS') ??
          process.env.OUTBOX_MAX_ATTEMPTS ??
          5,
      );
    this.maxAttempts = maxAtt > 0 ? maxAtt : 5;

    this.leaseDurationMs = opcionesManuales?.leaseDurationMs ?? 30000;

    this.exchange =
      opcionesManuales?.exchange ??
      configService?.get<string>('RABBITMQ_EXCHANGE') ??
      process.env.RABBITMQ_EXCHANGE ??
      'dental.topic.exchange';

    this.routingKey =
      opcionesManuales?.routingKey ??
      configService?.get<string>('RABBITMQ_ROUTING_KEY') ??
      process.env.RABBITMQ_ROUTING_KEY ??
      'clinica.consulta.finalizada';
  }

  onApplicationBootstrap(): void {
    if (!this.enabled) {
      this.logger.log(
        `[OutboxRelayWorker] Deshabilitado por configuración (OUTBOX_RELAY_ENABLED=false). No se publicarán mensajes automáticamente a RabbitMQ.`,
      );
      return;
    }

    this.logger.log(
      `[OutboxRelayWorker] Iniciado (workerId: ${this.workerId}, intervalo: ${this.pollIntervalMs}ms, lote: ${this.batchSize}, exchange: '${this.exchange}', routingKey: '${this.routingKey}').`,
    );

    this.timer = setInterval(() => {
      void this.procesarLotePendientes().catch((err: unknown) => {
        this.logger.error(
          `[OutboxRelayWorker] Error no controlado en ciclo de polling: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
    }, this.pollIntervalMs);
  }

  onApplicationShutdown(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.logger.log(`[OutboxRelayWorker] Timer de polling detenido.`);
    }
  }

  /**
   * Ejecuta un ciclo de procesamiento de eventos pendientes en el Outbox.
   * Reclama un lote de forma atómica y publica cada evento en RabbitMQ.
   * Garantiza semántica at-least-once con Publisher Confirms.
   * Retorna el número de eventos publicados exitosamente.
   */
  async procesarLotePendientes(): Promise<number> {
    if (this.ejecutando) {
      this.logger.debug(
        `[OutboxRelayWorker] Ciclo anterior todavía en ejecución. Omitiendo invocación recurrente.`,
      );
      return 0;
    }

    this.ejecutando = true;
    let publicadosExitosos = 0;

    try {
      const eventos = await this.repository.reclamarLote(
        this.batchSize,
        this.leaseDurationMs,
        this.workerId,
      );

      if (eventos.length === 0) {
        return 0;
      }

      this.logger.debug(
        `[OutboxRelayWorker] Lote de ${eventos.length} evento(s) reclamado por ${this.workerId}.`,
      );

      for (const evento of eventos) {
        try {
          await this.publisher.publicar(
            this.exchange,
            this.routingKey,
            evento.payload,
            {
              messageId: evento.id,
              correlationId: evento.aggregateId,
            },
          );

          evento.marcarPublicado(this.workerId);
          await this.repository.actualizar(evento);
          publicadosExitosos++;

          this.logger.debug(
            `[OutboxRelayWorker] Evento outbox ${evento.id} (${evento.aggregateType} ${evento.aggregateId}) publicado y confirmado por broker.`,
          );
        } catch (error) {
          const mensajeError =
            error instanceof Error ? error.message : String(error);

          this.logger.warn(
            `[OutboxRelayWorker] Fallo al publicar evento outbox ${evento.id}: ${mensajeError}`,
          );

          evento.registrarFallo(this.workerId, mensajeError);
          await this.repository.actualizar(evento);
        }
      }
    } finally {
      this.ejecutando = false;
    }

    return publicadosExitosos;
  }

  getWorkerId(): string {
    return this.workerId;
  }

  isActivo(): boolean {
    return this.enabled && this.timer !== null;
  }
}
