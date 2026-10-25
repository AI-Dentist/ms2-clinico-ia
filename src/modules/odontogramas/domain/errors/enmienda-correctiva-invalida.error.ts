/**
 * Se lanza cuando una enmienda correctiva no cumple los requisitos obligatorios de trazabilidad (INV-ODO-05).
 */
export class EnmiendaCorrectivaInvalidaError extends Error {
  readonly codigo = 'ENMIENDA_CORRECTIVA_INVALIDA';

  constructor(mensaje: string) {
    super(`Enmienda correctiva inválida: ${mensaje}`);
    this.name = 'EnmiendaCorrectivaInvalidaError';
  }
}
