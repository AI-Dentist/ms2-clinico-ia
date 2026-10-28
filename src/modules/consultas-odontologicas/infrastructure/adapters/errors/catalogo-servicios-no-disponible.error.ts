/**
 * Error lanzado cuando el catálogo de servicios de MS1 no responde,
 * sufre un timeout o presenta fallas de conectividad de red.
 */
export class CatalogoServiciosNoDisponibleError extends Error {
  readonly codigo = 'CATALOGO_SERVICIOS_NO_DISPONIBLE';

  constructor(
    mensaje: string,
    public readonly causaOriginal?: unknown,
  ) {
    super(mensaje);
    this.name = 'CatalogoServiciosNoDisponibleError';
  }
}

