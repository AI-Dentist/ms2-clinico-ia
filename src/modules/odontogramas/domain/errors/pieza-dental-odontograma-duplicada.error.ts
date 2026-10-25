export class PiezaDentalOdontogramaDuplicadaError extends Error {
  readonly codigo = 'PIEZA_DENTAL_ODONTOGRAMA_DUPLICADA';
  readonly numeroFDI: number;

  constructor(numeroFDI: number) {
    super(`La pieza dental FDI ${numeroFDI} ya se encuentra registrada en el odontograma.`);
    this.name = 'PiezaDentalOdontogramaDuplicadaError';
    this.numeroFDI = numeroFDI;
  }
}
