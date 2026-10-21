import type { EstadoHistoria } from '../value-objects/estado-historia.enum.js';

/** Se lanza cuando se intenta una transición de estado no permitida por la máquina de estados. */
export class TransicionEstadoInvalidaError extends Error {
  readonly codigo = 'TRANSICION_ESTADO_INVALIDA';

  constructor(desde: EstadoHistoria, hacia: EstadoHistoria) {
    super(`Transición de estado no permitida: '${desde}' → '${hacia}'.`);
    this.name = 'TransicionEstadoInvalidaError';
  }
}
