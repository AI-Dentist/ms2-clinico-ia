/**
 * Error de aplicación lanzado cuando se solicita un servicio por ID
 * y este no existe en el catálogo de servicios de MS1.
 */
export class ServicioCatalogoNoEncontradoError extends Error {
  readonly codigo = 'SERVICIO_CATALOGO_NO_ENCONTRADO';

  constructor(public readonly servicioId: string) {
    super(
      `El servicio odontológico con ID '${servicioId}' no fue encontrado en el catálogo de MS1.`,
    );
    this.name = 'ServicioCatalogoNoEncontradoError';
  }
}

