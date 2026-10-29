import type { ClientSession } from 'mongoose';
import type { OutboxEvent } from '../entities/outbox-event.entity.js';

export const OUTBOX_REPOSITORY_PORT = Symbol('OUTBOX_REPOSITORY_PORT');

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
}

