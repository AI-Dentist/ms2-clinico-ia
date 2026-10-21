import type { EstadoHistoria } from '../value-objects/estado-historia.enum.js';

/**
 * Se lanza al intentar modificar una historia en estado CERRADA o ARCHIVADA.
 * (INV-03, INV-04)
 */
export class HistoriaClinicaNoEditableError extends Error {
  readonly codigo = 'HISTORIA_NO_EDITABLE';
  readonly estado: EstadoHistoria;

  constructor(estado: EstadoHistoria) {
    super(`La historia clínica en estado '${estado}' no puede ser modificada.`);
    this.name = 'HistoriaClinicaNoEditableError';
    this.estado = estado;
  }
}
