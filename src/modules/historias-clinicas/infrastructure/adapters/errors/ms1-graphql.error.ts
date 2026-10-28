/**
 * Error lanzado cuando MS1 responde HTTP 200 pero el cuerpo de respuesta
 * incluye un arreglo de errores de GraphQL ('errors').
 */
export class Ms1GraphqlError extends Error {
  readonly codigo = 'MS1_GRAPHQL_ERROR';

  constructor(
    public readonly errores: Array<{ message: string; [key: string]: unknown }>,
  ) {
    const mensajes = errores.map((e) => e.message).join('; ');
    super(`Error en respuesta GraphQL de MS1: ${mensajes}`);
    this.name = 'Ms1GraphqlError';
  }
}

