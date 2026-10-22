/**
 * Se lanza al intentar cancelar una consulta sin proveer un motivo explícito de al menos 10 caracteres (INV-CONS-06).
 */
export class JustificacionCancelacionRequeridaError extends Error {
  readonly codigo = 'JUSTIFICACION_CANCELACION_REQUERIDA';

  constructor(longitudActual = 0) {
    super(
      `Para cancelar una consulta odontológica es obligatorio registrar una justificación clínica o administrativa de al menos 10 caracteres (longitud actual: ${longitudActual}).`
    );
    this.name = 'JustificacionCancelacionRequeridaError';
  }
}
