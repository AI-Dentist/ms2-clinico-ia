/**
 * Error de infraestructura lanzado cuando se intenta ejecutar una operación transaccional
 * atómica en un despliegue de MongoDB que no soporta transacciones multidocumento (ej. Standalone sin Replica Set).
 */
export class TransaccionNoSoportadaError extends Error {
  readonly codigo = 'TRANSACCION_NO_SOPORTADA';

  constructor(mensaje?: string) {
    super(
      mensaje ||
        'El servidor MongoDB actual opera en modo Standalone sin Replica Set y no soporta transacciones multidocumento ACID. Por seguridad e integridad clínica, la operación fue rechazada sin mutar datos.'
    );
    this.name = 'TransaccionNoSoportadaError';
  }
}
