import { Injectable, Logger } from '@nestjs/common';
import type {
  IRabbitMqPublisherPort,
  OpcionesPublicacion,
} from '../../domain/ports/rabbitmq-publisher.port.js';

export interface PublicacionRegistrada {
  exchange: string;
  routingKey: string;
  payload: Record<string, unknown>;
  publicadoEn: Date;
}

const UUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * Adaptador en memoria simulado de RabbitMQ para pruebas de desarrollo e integración.
 * Valida estrictamente el contrato JSON plano de MS1 (consultaId canónico, servicios >= 1,
 * precio decimal compatible con BigDecimal).
 * Permite simular fallas de broker, timeouts y mensajes no enrutables de manera determinista.
 */
@Injectable()
export class MockRabbitMqPublisherAdapter implements IRabbitMqPublisherPort {
  private readonly logger = new Logger(MockRabbitMqPublisherAdapter.name);
  private readonly _publicaciones: PublicacionRegistrada[] = [];
  private errorSimulado: Error | null = null;
  private timeoutSimulado = false;
  private noEnrutadoSimulado: string | null = null;

  async publicar(
    exchange: string,
    routingKey: string,
    payload: Record<string, unknown>,
    _opciones?: OpcionesPublicacion,
  ): Promise<void> {
    if (this.timeoutSimulado) {
      throw new Error('[RabbitMQ Mock] Timeout esperando Publisher Confirm del broker.');
    }

    if (this.noEnrutadoSimulado) {
      throw new Error(
        `[RabbitMQ Mock NO_ROUTE] Mensaje devuelto como inenrutable: ${this.noEnrutadoSimulado}`,
      );
    }

    if (this.errorSimulado) {
      throw this.errorSimulado;
    }

    // Validación estricta del contrato plano de MS1 (Iteración 4 / Condición 8)
    this.validarContratoMs1(payload);

    this._publicaciones.push({
      exchange,
      routingKey,
      payload: JSON.parse(JSON.stringify(payload)) as Record<string, unknown>,
      publicadoEn: new Date(),
    });

    this.logger.debug(
      `[RabbitMQ Mock] Mensaje plano publicado exitosamente en '${exchange}' con routing key '${routingKey}' (total: ${this._publicaciones.length}).`,
    );
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
      // Validar compatibilidad de precioUnitarioBs con BigDecimal de Java
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

  // Métodos de control y aserciones para pruebas
  get publicaciones(): ReadonlyArray<PublicacionRegistrada> {
    return this._publicaciones;
  }

  obtenerUltimaPublicacion(): PublicacionRegistrada | null {
    if (this._publicaciones.length === 0) return null;
    return this._publicaciones[this._publicaciones.length - 1];
  }

  simularError(error: Error | string | null): void {
    if (typeof error === 'string') {
      this.errorSimulado = new Error(error);
    } else {
      this.errorSimulado = error;
    }
  }

  simularTimeout(activo = true): void {
    this.timeoutSimulado = activo;
  }

  simularNoEnrutado(razon: string | null): void {
    this.noEnrutadoSimulado = razon;
  }

  limpiar(): void {
    this._publicaciones.length = 0;
    this.errorSimulado = null;
    this.timeoutSimulado = false;
    this.noEnrutadoSimulado = null;
  }
}

