/**
 * Error lanzado cuando el identificador de un servicio o especialidad
 * no cumple con el formato canónico de UUID (RFC 4122).
 */
export class IdServicioInvalidoError extends Error {
  readonly codigo = 'ID_SERVICIO_INVALIDO';

  constructor(servicioId: string) {
    super(
      `El identificador '${servicioId}' no tiene un formato UUID válido según el contrato de MS1.`,
    );
    this.name = 'IdServicioInvalidoError';
  }
}

