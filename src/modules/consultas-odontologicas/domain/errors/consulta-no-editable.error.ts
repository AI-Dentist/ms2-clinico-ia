import type { EstadoConsulta } from '../value-objects/estado-consulta.enum.js';

/**
 * Se lanza al intentar modificar los datos clínicos de una consulta en estado COMPLETADA o CANCELADA.
 * (INV-CONS-04)
 */
export class ConsultaNoEditableError extends Error {
  readonly codigo = 'CONSULTA_NO_EDITABLE';
  readonly estado: EstadoConsulta;

  constructor(estado: EstadoConsulta) {
    super(`La consulta odontológica en estado '${estado}' es inmutable y no puede ser modificada.`);
    this.name = 'ConsultaNoEditableError';
    this.estado = estado;
  }
}
