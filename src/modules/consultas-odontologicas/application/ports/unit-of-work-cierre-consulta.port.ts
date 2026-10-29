import type { ConsultaOdontologica } from '../../domain/entities/consulta-odontologica.entity.js';
import type { OutboxEvent } from '../../../outbox/domain/entities/outbox-event.entity.js';

export const UNIT_OF_WORK_CIERRE_CONSULTA_PORT = Symbol('UNIT_OF_WORK_CIERRE_CONSULTA_PORT');

/**
 * Puerto SPI del Unit of Work / Coordinador Transaccional para el cierre de consultas con Outbox.
 * Garantiza que la actualización de la consulta y el registro del evento en outbox_events
 * se ejecuten atómicamente dentro de la misma ClientSession transaccional de MongoDB.
 */
export interface IUnitOfWorkCierreConsultaPort {
  /**
   * Persiste atómicamente la consulta completada y su evento Outbox correspondiente.
   *
   * Invariantes y salvaguardas:
   * 1. Ambas escrituras deben ocurrir en la misma ClientSession de MongoDB.
   * 2. Si la versión persistida no coincide con versionEsperada, se lanza ConflictoConcurrenteConsultaError
   *    y se hace rollback completo sin dejar rastro en outbox_events.
   * 3. Si la base de datos no soporta transacciones multidocumento (Standalone), se lanza
   *    TransaccionesNoSoportadasError sin realizar ninguna escritura parcial ni fallback secuencial.
   */
  ejecutarCierreConOutbox(
    consulta: ConsultaOdontologica,
    versionEsperada: number,
    eventoOutbox: OutboxEvent,
  ): Promise<void>;
}

