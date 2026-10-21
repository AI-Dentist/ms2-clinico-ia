/** Se lanza al intentar agregar una alergia cuya sustancia ya está registrada. (INV-05) */
export class AlergiaDuplicadaError extends Error {
  readonly codigo = 'ALERGIA_DUPLICADA';
  readonly sustancia: string;

  constructor(sustancia: string) {
    super(`Ya existe una alergia registrada para la sustancia '${sustancia}'.`);
    this.name = 'AlergiaDuplicadaError';
    this.sustancia = sustancia;
  }
}
