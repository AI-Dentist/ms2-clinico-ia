import type { ClientSession } from 'mongoose';
import type { OutboxEvent } from '../entities/outbox-event.entity.js';

export const OUTBOX_REPOSITORY_PORT = Symbol('OUTBOX_REPOSITORY_PORT');

export interface EventoFatalItem {
  id: string;
  aggregateId: string;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  actualizadoEn: Date;
}

export interface OutboxStatusDto {
  pendientes: number;
  enProceso: number;
  publicados: number;
  fatales: number;
  eventosFatales: EventoFatalItem[];
}

export interface IOutboxRepositoryPort {
  /**
   * Persiste un nuevo evento en el outbox.
   * Admite opcionalmente una ClientSession de Mongoose para participar en
   * transacciones ACID multidocumento con el aggregate clínico.
   */
  guardar(evento: OutboxEvent, session?: ClientSession): Promise<void>;

  /**
   * Busca un evento por su identificador primario (_id).
   */
  buscarPorId(id: string): Promise<OutboxEvent | null>;

  /**
   * Busca un evento por su eventId de integración.
   */
  buscarPorEventId(eventId: string): Promise<OutboxEvent | null>;

  /**
   * Reclama de forma atómica un lote de eventos listos para ser publicados
   * asignando un lease exclusivo al workerId solicitante.
   */
  reclamarLote(
    limite: number,
    leaseDurationMs: number,
    workerId: string,
    ahora?: Date,
  ): Promise<OutboxEvent[]>;

  /**
   * Actualiza el estado, reintentos y timestamps de un evento reclamado.
   */
  actualizar(evento: OutboxEvent): Promise<void>;

  /**
   * Reclama y libera locks cuyo lease haya expirado (recuperación de trabajadores caídos).
   */
  liberarLeasesVencidos(ahora?: Date): Promise<number>;

  /**
   * Obtiene métricas agregadas del estado de los eventos en el outbox y lista
   * de eventos que se encuentran en estado terminal ERROR_FATAL.
   */
  obtenerEstado(): Promise<OutboxStatusDto>;
}

