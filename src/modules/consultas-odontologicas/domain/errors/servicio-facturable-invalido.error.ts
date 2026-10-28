/**
 * Error de dominio lanzado cuando la definición o los valores de un servicio facturable
 * infringen las reglas de negocio o los contratos con MS1 (UUID inválido, cantidad < 1,
 * precio inválido, servicio inexistente o inactivo).
 */
export class ServicioFacturableInvalidoError extends Error {
  readonly codigo = 'SERVICIO_FACTURABLE_INVALIDO';

  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ServicioFacturableInvalidoError';
  }
}

