import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import amqp, {
  type ChannelModel,
  type ConfirmChannel,
  type ConsumeMessage,
} from 'amqplib';
import { randomUUID } from 'node:crypto';
import type {
  IRabbitMqPublisherPort,
  OpcionesPublicacion,
} from '../../domain/ports/rabbitmq-publisher.port.js';

export interface AmqpPublisherConfig {
  url?: string;
  exchange?: string;
  routingKey?: string;
  defaultTimeoutMs?: number;
}

interface MensajeRetornadoInfo {
  replyCode: number;
  replyText: string;
  exchange: string;
  routingKey: string;
}

const UUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * Adaptador de infraestructura AMQP real para RabbitMQ utilizando amqplib.
 *
 * Características de confiabilidad:
 * 1. Publisher Confirms (ConfirmChannel) con espera determinista de ACK del broker.
 * 2. Mensajes persistentes (deliveryMode: 2 / persistent: true).
 * 3. Enrutamiento obligatorio (mandatory: true) con captura del evento 'return' para mensajes no enrutables.
 * 4. Conexión diferida (lazy connection) bajo demanda: no conecta en el arranque si el adaptador no publica.
 * 5. Manejo defensivo de eventos 'close' y 'error' en conexión y canal para auto-recuperación en el siguiente ciclo.
 * 6. Timeout configurable por mensaje para evitar bloqueos del worker de relay ante particiones de red.
 * 7. Cierre controlado y limpio de recursos mediante OnApplicationShutdown.
 * 8. Validación estricta del contrato plano de MS1 antes del envío a la red.
 */
@Injectable()
export class AmqpRabbitMqPublisherAdapter
  implements IRabbitMqPublisherPort, OnApplicationShutdown
{
  private readonly logger = new Logger(AmqpRabbitMqPublisherAdapter.name);

  private readonly url: string;
  private readonly defaultExchange: string;
  private readonly defaultRoutingKey: string;
  private readonly defaultTimeoutMs: number;

  private connection: ChannelModel | null = null;
  private confirmChannel: ConfirmChannel | null = null;
  private connectingPromise: Promise<ConfirmChannel> | null = null;

  // Registro en memoria de mensajes devueltos como no enrutables (mandatory=true)
  private readonly mensajesRetornados = new Map<string, MensajeRetornadoInfo>();

  constructor(
    @Optional()
    configService?: ConfigService,
    @Optional()
    configManual?: AmqpPublisherConfig,
  ) {
    this.url =
      configManual?.url ??
      configService?.get<string>('RABBITMQ_URL') ??
      process.env.RABBITMQ_URL ??
      'amqp://guest:guest@localhost:5672/';

    this.defaultExchange =
      configManual?.exchange ??
      configService?.get<string>('RABBITMQ_EXCHANGE') ??
      process.env.RABBITMQ_EXCHANGE ??
      'dental.topic.exchange';

    this.defaultRoutingKey =
      configManual?.routingKey ??
      configService?.get<string>('RABBITMQ_ROUTING_KEY') ??
      process.env.RABBITMQ_ROUTING_KEY ??
      'clinica.consulta.finalizada';

    this.defaultTimeoutMs =
      configManual?.defaultTimeoutMs ?? 5000;
  }

  /**
   * Publica un mensaje plano hacia RabbitMQ con confirmación explícita (Publisher Confirm).
   * Lanza un error si el broker responde NACK, si el mensaje es devuelto como inenrutable
   * o si se supera el timeout de espera de confirmación.
   */
  async publicar(
    exchange: string,
    routingKey: string,
    payload: Record<string, unknown>,
    opciones?: OpcionesPublicacion,
  ): Promise<void> {
    // 1. Validación estricta del contrato plano de MS1 antes de tocar el socket
    this.validarContratoMs1(payload);

    // 2. Obtener canal de confirmación (conexión perezosa)
    const channel = await this.obtenerCanalConfirmacion();

    const targetExchange = exchange || this.defaultExchange;
    const targetRoutingKey = routingKey || this.defaultRoutingKey;
    const messageId = opciones?.messageId || randomUUID();
    const correlationId = opciones?.correlationId || messageId;
    const timeoutMs = opciones?.timeoutMs && opciones.timeoutMs > 0
      ? opciones.timeoutMs
      : this.defaultTimeoutMs;

    const contenidoBuffer = Buffer.from(JSON.stringify(payload), 'utf8');

    return new Promise<void>((resolve, reject) => {
      let confirmacionRecibida = false;
      let timer: NodeJS.Timeout | null = null;

      const limpiar = () => {
        confirmacionRecibida = true;
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        this.mensajesRetornados.delete(messageId);
      };

      timer = setTimeout(() => {
        if (!confirmacionRecibida) {
          limpiar();
          reject(
            new Error(
              `[RabbitMQ Timeout] Se superó el tiempo límite (${timeoutMs}ms) esperando confirmación (Publisher Confirm) para el mensaje ${messageId}.`,
            ),
          );
        }
      }, timeoutMs);

      try {
        channel.publish(
          targetExchange,
          targetRoutingKey,
          contenidoBuffer,
          {
            persistent: true,
            mandatory: true,
            contentType: 'application/json',
            contentEncoding: 'utf-8',
            messageId,
            correlationId,
            timestamp: Date.now(),
          },
          (err: Error | null) => {
            if (confirmacionRecibida) {
              return;
            }

            // Comprobar si el broker devolvió el mensaje como no enrutable
            const retorno = this.mensajesRetornados.get(messageId);
            if (retorno) {
              limpiar();
              reject(
                new Error(
                  `[RabbitMQ NO_ROUTE] Mensaje ${messageId} no enrutable en exchange '${retorno.exchange}' con routing key '${retorno.routingKey}'. Código: ${retorno.replyCode}, Razón: ${retorno.replyText}`,
                ),
              );
              return;
            }

            if (err) {
              limpiar();
              reject(
                new Error(
                  `[RabbitMQ NACK] El broker rechazó el mensaje ${messageId}: ${err.message}`,
                ),
              );
              return;
            }

            limpiar();
            this.logger.debug(
              `[AmqpRabbitMqPublisherAdapter] Mensaje ${messageId} confirmado exitosamente por el broker en '${targetExchange}' con routing key '${targetRoutingKey}'.`,
            );
            resolve();
          },
        );
      } catch (publishErr: unknown) {
        limpiar();
        reject(publishErr);
      }
    });
  }

  /**
   * Obtiene o establece la conexión y el ConfirmChannel con RabbitMQ bajo demanda.
   */
  async obtenerCanalConfirmacion(): Promise<ConfirmChannel> {
    if (this.confirmChannel) {
      return this.confirmChannel;
    }

    if (this.connectingPromise) {
      return this.connectingPromise;
    }

    this.connectingPromise = this.conectar();
    try {
      this.confirmChannel = await this.connectingPromise;
      return this.confirmChannel;
    } finally {
      this.connectingPromise = null;
    }
  }

  private async conectar(): Promise<ConfirmChannel> {
    this.logger.log(`[AmqpRabbitMqPublisherAdapter] Conectando a RabbitMQ en '${this.sanitizarUrl(this.url)}'...`);
    const conn = await amqp.connect(this.url);
    this.connection = conn;

    conn.on('error', (err: Error) => {
      this.logger.error(`[AmqpRabbitMqPublisherAdapter] Error en conexión RabbitMQ: ${err.message}`);
      this.desconectarInterno();
    });

    conn.on('close', () => {
      this.logger.warn(`[AmqpRabbitMqPublisherAdapter] Conexión cerrada por el broker RabbitMQ.`);
      this.desconectarInterno();
    });

    const channel = await conn.createConfirmChannel();

    channel.on('error', (err: Error) => {
      this.logger.error(`[AmqpRabbitMqPublisherAdapter] Error en canal de confirmación: ${err.message}`);
      this.confirmChannel = null;
    });

    channel.on('close', () => {
      this.logger.warn(`[AmqpRabbitMqPublisherAdapter] Canal de confirmación cerrado.`);
      this.confirmChannel = null;
    });

    // Captura obligatoria de mensajes devueltos por falta de ruta (mandatory=true)
    channel.on('return', (msg: ConsumeMessage) => {
      const msgId = msg.properties.messageId || 'desconocido';
      const replyCode = (msg.fields as unknown as { replyCode?: number }).replyCode ?? 312;
      const replyText = (msg.fields as unknown as { replyText?: string }).replyText ?? 'NO_ROUTE';
      const exchange = (msg.fields as unknown as { exchange?: string }).exchange ?? '';
      const routingKey = (msg.fields as unknown as { routingKey?: string }).routingKey ?? '';

      this.logger.warn(
        `[AmqpRabbitMqPublisherAdapter] Mensaje ${msgId} devuelto por broker como NO ENRUTABLE (Código: ${replyCode}, Razón: '${replyText}').`,
      );

      this.mensajesRetornados.set(msgId, {
        replyCode,
        replyText,
        exchange,
        routingKey,
      });
    });

    this.logger.log(`[AmqpRabbitMqPublisherAdapter] Canal de confirmación establecido exitosamente.`);
    return channel;
  }

  private desconectarInterno(): void {
    this.confirmChannel = null;
    this.connection = null;
    this.mensajesRetornados.clear();
  }

  async onApplicationShutdown(): Promise<void> {
    this.logger.log(`[AmqpRabbitMqPublisherAdapter] Cerrando recursos de RabbitMQ...`);
    try {
      if (this.confirmChannel) {
        await this.confirmChannel.close().catch(() => {});
        this.confirmChannel = null;
      }
      if (this.connection) {
        await this.connection.close().catch(() => {});
        this.connection = null;
      }
      this.mensajesRetornados.clear();
      this.logger.log(`[AmqpRabbitMqPublisherAdapter] Recursos cerrados correctamente.`);
    } catch (err: unknown) {
      this.logger.warn(
        `[AmqpRabbitMqPublisherAdapter] Advertencia al cerrar recursos: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private validarContratoMs1(payload: Record<string, unknown>): void {
    if (!payload || typeof payload !== 'object') {
      throw new Error('El mensaje a publicar debe ser un objeto JSON plano.');
    }

    if ('payload' in payload) {
      throw new Error(
        'Violación de contrato MS1: el mensaje NO debe contener el envoltorio anidado "payload".',
      );
    }

    const consultaId = payload.consultaId as string;
    if (!consultaId || typeof consultaId !== 'string') {
      throw new Error('El campo consultaId es obligatorio en el contrato MS1.');
    }
    if (consultaId.startsWith('cons_')) {
      throw new Error(
        `Violación de contrato MS1: consultaId '${consultaId}' no debe tener el prefijo 'cons_'.`,
      );
    }
    if (!UUID_REGEX.test(consultaId)) {
      throw new Error(
        `El campo consultaId '${consultaId}' no cumple con el formato UUID RFC 4122.`,
      );
    }

    const pacienteId = payload.pacienteId as string;
    if (!pacienteId || !UUID_REGEX.test(pacienteId)) {
      throw new Error(`El campo pacienteId '${pacienteId}' debe ser un UUID válido de MS1.`);
    }

    const servicios = payload.serviciosRealizados as Array<Record<string, unknown>>;
    if (!Array.isArray(servicios) || servicios.length === 0) {
      throw new Error(
        'El mensaje hacia MS1 requiere al menos un servicioRealizado para generar orden de cobro.',
      );
    }

    for (const s of servicios) {
      if (!s.servicioId || typeof s.servicioId !== 'string' || !UUID_REGEX.test(s.servicioId)) {
        throw new Error(`Cada servicioRealizado debe tener un servicioId UUID válido.`);
      }
      if (typeof s.cantidad !== 'number' || s.cantidad < 1 || !Number.isInteger(s.cantidad)) {
        throw new Error(`La cantidad del servicio debe ser un número entero >= 1.`);
      }
      const precio = s.precioUnitarioBs;
      if (typeof precio !== 'number' && typeof precio !== 'string') {
        throw new Error(
          `El precioUnitarioBs debe ser un número decimal o string monetario compatible con BigDecimal.`,
        );
      }
      if (Number.isNaN(Number(precio)) || Number(precio) < 0) {
        throw new Error(`El precioUnitarioBs '${String(precio)}' debe ser un número no negativo.`);
      }
      if (s.piezaDental !== null && s.piezaDental !== undefined && typeof s.piezaDental !== 'string') {
        throw new Error(
          `La piezaDental debe ser string o null según el contrato de MS1 (recibido tipo ${typeof s.piezaDental}).`,
        );
      }
    }
  }

  private sanitizarUrl(url: string): string {
    return url.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');
  }

  isConnected(): boolean {
    return this.connection !== null && this.confirmChannel !== null;
  }
}

