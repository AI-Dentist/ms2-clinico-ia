/**
 * Se lanza cuando se intenta asignar una condición clínica inapropiada para el borde incisal
 * de una pieza anterior (INV-ODO-04).
 */
export class SuperficieIncisalIncompatibleError extends Error {
  readonly codigo = 'SUPERFICIE_INCISAL_INCOMPATIBLE';
  readonly numeroFDI: number;

  constructor(numeroFDI: number) {
    super(
      `Incompatibilidad morfológica en pieza anterior ${numeroFDI}: el borde incisal no posee fosas ni fisuras oclusales para la aplicación de sellantes.`
    );
    this.name = 'SuperficieIncisalIncompatibleError';
    this.numeroFDI = numeroFDI;
  }
}
