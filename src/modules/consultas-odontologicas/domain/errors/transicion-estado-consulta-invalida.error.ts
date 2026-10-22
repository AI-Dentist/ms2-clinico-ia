import type { EstadoConsulta } from '../value-objects/estado-consulta.enum.js';

/**
 * Se lanza al intentar una transición de estado no permitida por la máquina de estados.
 */
export class TransicionEstadoConsultaInvalidaError extends Error {
  readonly codigo = 'TRANSICION_ESTADO_CONSULTA_INVALIDA';
  readonly estadoActual: EstadoConsulta;
  readonly estadoDestino: EstadoConsulta;

  constructor(estadoActual: EstadoConsulta, estadoDestino: EstadoConsulta) {
    super(`No se permite la transición de estado desde '${estadoActual}' hacia '${estadoDestino}'.`);
    this.name = 'TransicionEstadoConsultaInvalidaError';
    this.estadoActual = estadoActual;
    this.estadoDestino = estadoDestino;
  }
}
