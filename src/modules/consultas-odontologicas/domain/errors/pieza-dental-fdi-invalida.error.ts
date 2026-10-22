/**
 * Se lanza cuando se intenta registrar un número de pieza dental fuera del estándar internacional FDI (INV-CONS-08).
 * El estándar FDI solo contempla exactamente 52 piezas anatómicas (32 permanentes y 20 temporales).
 */
export class PiezaDentalFDIInvalidaError extends Error {
  readonly codigo = 'PIEZA_DENTAL_FDI_INVALIDA';
  readonly piezaInvalida: number;

  constructor(piezaInvalida: number) {
    super(
      `El número de pieza dental '${piezaInvalida}' no es válido según la nomenclatura FDI. Debe pertenecer al conjunto cerrado de las 52 piezas anatómicas reconocidas (Permanentes: 11-18, 21-28, 31-38, 41-48; Deciduas: 51-55, 61-65, 71-75, 81-85).`
    );
    this.name = 'PiezaDentalFDIInvalidaError';
    this.piezaInvalida = piezaInvalida;
  }
}
