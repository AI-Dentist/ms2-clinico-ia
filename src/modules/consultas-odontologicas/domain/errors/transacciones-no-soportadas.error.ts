/**
 * Se lanza cuando la topología actual de la base de datos (MongoDB Standalone)
 * no soporta transacciones ACID multidocumento requeridas para coordinar
 * el cierre clínico y la inserción del Transactional Outbox.
 *
 * Evita cualquier escritura parcial o fallback secuencial inseguro.
 */
export class TransaccionesNoSoportadasError extends Error {
  readonly codigo = 'TRANSACCIONES_NO_SOPORTADAS';

  constructor(
    mensaje = 'La base de datos actual (MongoDB Standalone) no soporta transacciones ACID multidocumento. Para completar una consulta con servicios facturables se requiere un Replica Set para garantizar la persistencia atómica con Transactional Outbox sin escrituras parciales.',
  ) {
    super(mensaje);
    this.name = 'TransaccionesNoSoportadasError';
  }
}

