import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import amqp, {
  type ChannelModel,
  type Channel,
  type ConsumeMessage,
} from 'amqplib';
import { RevertirCierrePorRechazoUseCase } from '../../application/use-cases/revertir-cierre-por-rechazo.use-case.js';

export interface FacturacionRechazadaConsumerOptions {
  enabled?: boolean;
  url?: string;
  exchange?: string;
  routingKey?: string;
  queue?: string;
  dlxExchange?: string;
  dlqQueue?: string;
  maxRetries?: number;
  initialBackoffMs?: number;
  maxBackoffMs?: number;
  sleepFn?: (ms: number) => Promise<void>;
}

const UUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const MOTIVOS_VALIDOS = new Set([
  'PACIENTE_INEXISTENTE',
  'ODONTOLOGO_INEXISTENTE',
  'SERVICIO_INEXISTENTE',
  'SERVICIO_INACTIVO',
  'MONTO_INVALIDO',
  'PAYLOAD_INVALIDO',
  'REINTENTOS_AGOTADOS',
]);

interface FacturacionRechazadaPayload {
  eventId: string;
  consultaId: string;
  consultaFinalizadaEventId: string;
  motivoCodigo: string;
  motivo: string;
  rechazadaEn: string;
}

@Injectable()
export class FacturacionRechazadaConsumer
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(FacturacionRechazadaConsumer.name);
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  private consumerTag: string | null = null;

  private readonly enabled: boolean;
  private readonly url: string;
  private readonly exchange: string;
  private readonly routingKey: string;
  private readonly queue: string;
  private readonly dlxExchange: string;
  private readonly dlqQueue: string;
  private readonly maxRetries: number;
  private readonly initialBackoffMs: number;
  private readonly maxBackoffMs: number;
  private readonly sleepFn: (ms: number) => Promise<void>;

  constructor(
    private readonly revertirCierrePorRechazoUseCase: RevertirCierrePorRechazoUseCase,
    @Optional()
    configService?: ConfigService,
    @Optional()
    opcionesManuales?: FacturacionRechazadaConsumerOptions,
  ) {
    this.enabled =
      opcionesManuales?.enabled ??
      (configService?.get<boolean>('FACTURACION_RECHAZADA_CONSUMER_ENABLED') ??
        process.env.FACTURACION_RECHAZADA_CONSUMER_ENABLED === 'true');

    this.url =
      opcionesManuales?.url ??
      configService?.get<string>('RABBITMQ_URL') ??
      process.env.RABBITMQ_URL ??
      'amqp://guest:guest@localhost:5672';

    this.exchange =
      opcionesManuales?.exchange ??
      configService?.get<string>('RABBITMQ_EXCHANGE') ??
      process.env.RABBITMQ_EXCHANGE ??
      'dental.topic.exchange';

    this.routingKey =
      opcionesManuales?.routingKey ??
      'facturacion.consulta.rechazada';

    this.queue =
      opcionesManuales?.queue ??
      'ms2.facturacion.consulta.rechazada.queue';

    this.dlxExchange =
      opcionesManuales?.dlxExchange ??
      'dental.dlx.exchange';

    this.dlqQueue =
      opcionesManuales?.dlqQueue ??
      'ms2.facturacion.consulta.rechazada.dlq';

    const maxRet =
      opcionesManuales?.maxRetries ??
      Number(
        configService?.get<number>('FACTURACION_RECHAZADA_MAX_RETRIES') ??
          process.env.FACTURACION_RECHAZADA_MAX_RETRIES ??
          4,
      );
    this.maxRetries = maxRet > 0 ? maxRet : 4;

    const initBackoff =
      opcionesManuales?.initialBackoffMs ??
      Number(
        configService?.get<number>('FACTURACION_RECHAZADA_BACKOFF_MS') ??
          process.env.FACTURACION_RECHAZADA_BACKOFF_MS ??
          200,
      );
    this.initialBackoffMs = initBackoff >= 0 ? initBackoff : 200;

    const maxBack =
      opcionesManuales?.maxBackoffMs ??
      Number(
        configService?.get<number>('FACTURACION_RECHAZADA_MAX_BACKOFF_MS') ??
          process.env.FACTURACION_RECHAZADA_MAX_BACKOFF_MS ??
          5000,
      );
    this.maxBackoffMs = maxBack >= this.initialBackoffMs ? maxBack : 5000;

    this.sleepFn =
      opcionesManuales?.sleepFn ??
      ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!this.enabled) {
      this.logger.log(
        '[FacturacionRechazadaConsumer] Deshabilitado por configuración (FACTURACION_RECHAZADA_CONSUMER_ENABLED!=true).',
      );
      return;
    }

    try {
      await this.iniciarConsumidor();
    } catch (err: unknown) {
      this.logger.error(
        `[FacturacionRechazadaConsumer] Error al iniciar consumidor RabbitMQ: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.detenerConsumidor();
  }

  async iniciarConsumidor(): Promise<void> {
    this.logger.log(
      `[FacturacionRechazadaConsumer] Conectando a RabbitMQ en '${this.sanitizarUrl(this.url)}'...`,
    );

    const conn = await amqp.connect(this.url);
    this.connection = conn;

    conn.on('error', (err: Error) => {
      this.logger.error(
        `[FacturacionRechazadaConsumer] Error de conexión: ${err.message}`,
      );
    });

    conn.on('close', () => {
      this.logger.warn(
        '[FacturacionRechazadaConsumer] Conexión cerrada por el broker.',
      );
    });

    const ch = await conn.createChannel();
    this.channel = ch;

    // Configurar topología asegurando DLX y colas
    await ch.assertExchange(this.exchange, 'topic', { durable: true });
    await ch.assertExchange(this.dlxExchange, 'direct', { durable: true });

    await ch.assertQueue(this.dlqQueue, { durable: true });
    await ch.bindQueue(this.dlqQueue, this.dlxExchange, this.dlqQueue);

    await ch.assertQueue(this.queue, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': this.dlxExchange,
        'x-dead-letter-routing-key': this.dlqQueue,
      },
    });

    await ch.bindQueue(this.queue, this.exchange, this.routingKey);
    await ch.prefetch(10);

    const consumeResult = await ch.consume(
      this.queue,
      (msg: ConsumeMessage | null) => {
        if (!msg) return;
        void this.procesarMensaje(msg, ch);
      },
      { noAck: false },
    );

    this.consumerTag = consumeResult.consumerTag;
    this.logger.log(
      `[FacturacionRechazadaConsumer] Escuchando en cola '${this.queue}' con routing key '${this.routingKey}'.`,
    );
  }

  async detenerConsumidor(): Promise<void> {
    if (this.channel && this.consumerTag) {
      try {
        await this.channel.cancel(this.consumerTag);
      } catch {
        // Ignorar error al cancelar
      }
    }

    if (this.channel) {
      try {
        await this.channel.close();
      } catch {
        // Ignorar
      }
      this.channel = null;
    }

    if (this.connection) {
      try {
        await this.connection.close();
      } catch {
        // Ignorar
      }
      this.connection = null;
    }

    this.consumerTag = null;
  }

  /**
   * Procesa un mensaje individual recibido de la cola AMQP.
   * Maneja el parseo, la validación contra el contrato y la invocación del caso de uso.
   */
  async procesarMensaje(msg: ConsumeMessage, ch: Channel): Promise<void> {
    let payload: FacturacionRechazadaPayload;

    try {
      const rawText = msg.content.toString('utf-8');
      payload = JSON.parse(rawText) as FacturacionRechazadaPayload;
    } catch {
      this.logger.error(
        '[FacturacionRechazadaConsumer] Mensaje no parseable (JSON corrupto). Enviando a DLQ.',
      );
      ch.nack(msg, false, false);
      return;
    }

    const errorValidacion = this.validarPayload(payload);
    if (errorValidacion) {
      this.logger.error(
        `[FacturacionRechazadaConsumer] Mensaje inválido según contrato (${errorValidacion}). Enviando a DLQ.`,
      );
      ch.nack(msg, false, false);
      return;
    }

    let intento = 0;
    let ultimoError: unknown = null;

    while (intento < this.maxRetries) {
      intento++;
      try {
        const fechaRechazada = new Date(payload.rechazadaEn);

        await this.revertirCierrePorRechazoUseCase.execute({
          eventId: payload.eventId,
          consultaId: payload.consultaId,
          consultaFinalizadaEventId: payload.consultaFinalizadaEventId,
          motivoCodigo: payload.motivoCodigo,
          motivo: payload.motivo,
          rechazadaEn: fechaRechazada,
        });

        ch.ack(msg);
        return;
      } catch (err: unknown) {
        ultimoError = err;
        const mensajeError = err instanceof Error ? err.message : String(err);

        if (intento < this.maxRetries) {
          const delayMs = Math.min(
            this.initialBackoffMs * Math.pow(2, intento - 1),
            this.maxBackoffMs,
          );
          this.logger.warn(
            `[FacturacionRechazadaConsumer] Reintento transitorio ${intento}/${this.maxRetries} para consulta '${payload.consultaId}' tras error: ${mensajeError}. Esperando ${delayMs}ms...`,
          );
          await this.sleepFn(delayMs);
        }
      }
    }

    // Reintentos agotados: enviar a DLQ con nack sin requeue y log estructurado
    const mensajeErrorFinal =
      ultimoError instanceof Error ? ultimoError.message : String(ultimoError);

    this.logger.error({
      message:
        '[FacturacionRechazadaConsumer] Reintentos agotados ante fallo de persistencia/transitorio. Enviando a DLQ.',
      eventId: payload.eventId,
      consultaId: payload.consultaId,
      intentos: intento,
      maxIntentos: this.maxRetries,
      error: mensajeErrorFinal,
    });

    ch.nack(msg, false, false);
  }

  private validarPayload(payload: unknown): string | null {
    if (!payload || typeof payload !== 'object') {
      return 'Payload debe ser un objeto JSON';
    }

    const p = payload as Record<string, unknown>;

    if (typeof p.eventId !== 'string' || !UUID_REGEX.test(p.eventId)) {
      return "Campo 'eventId' debe ser un UUID canónico";
    }

    if (typeof p.consultaId !== 'string' || !UUID_REGEX.test(p.consultaId)) {
      return "Campo 'consultaId' debe ser un UUID canónico";
    }

    if (
      typeof p.consultaFinalizadaEventId !== 'string' ||
      !UUID_REGEX.test(p.consultaFinalizadaEventId)
    ) {
      return "Campo 'consultaFinalizadaEventId' debe ser un UUID canónico";
    }

    if (typeof p.motivoCodigo !== 'string' || !MOTIVOS_VALIDOS.has(p.motivoCodigo)) {
      return `Campo 'motivoCodigo' inválido (${String(p.motivoCodigo)})`;
    }

    if (
      typeof p.motivo !== 'string' ||
      p.motivo.trim().length === 0 ||
      p.motivo.length > 500
    ) {
      return "Campo 'motivo' debe tener entre 1 y 500 caracteres";
    }

    if (typeof p.rechazadaEn !== 'string' || Number.isNaN(Date.parse(p.rechazadaEn))) {
      return "Campo 'rechazadaEn' debe ser una fecha ISO 8601 válida";
    }

    return null;
  }

  private sanitizarUrl(url: string): string {
    return url.replace(/:\/\/[^:]+:[^@]+@/, '://***:***@');
  }
}
