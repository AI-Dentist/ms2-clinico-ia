export class OdontogramaNoEncontradoError extends Error {
  readonly codigo = 'ODONTOGRAMA_NO_ENCONTRADO';
  readonly identificador: string;

  constructor(identificador: string) {
    super(`Odontograma no encontrado con identificador '${identificador}'.`);
    this.name = 'OdontogramaNoEncontradoError';
    this.identificador = identificador;
  }
}
