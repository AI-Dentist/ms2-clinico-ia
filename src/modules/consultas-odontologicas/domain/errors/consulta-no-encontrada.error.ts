/**
 * Se lanza cuando una consulta solicitada por su identificador no existe.
 */
export class ConsultaNoEncontradaError extends Error {
  readonly codigo = 'CONSULTA_NO_ENCONTRADA';
  readonly consultaId: string;

  constructor(consultaId: string) {
    super(`No se encontró la consulta odontológica con ID '${consultaId}'.`);
    this.name = 'ConsultaNoEncontradaError';
    this.consultaId = consultaId;
  }
}
