/**
 * Se lanza al intentar abrir una consulta sobre una historia clínica que no existe o no está en estado ACTIVA (INV-CONS-02).
 */
export class HistoriaClinicaNoHabilitadaError extends Error {
  readonly codigo = 'HISTORIA_CLINICA_NO_HABILITADA';
  readonly historiaClinicaId: string;
  readonly estadoActual?: string;

  constructor(historiaClinicaId: string, estadoActual?: string) {
    const detalle = estadoActual
      ? `su estado actual es '${estadoActual}', debiendo ser 'ACTIVA'`
      : 'el expediente no existe';
    super(`No es posible iniciar una consulta para la historia clínica '${historiaClinicaId}': ${detalle}.`);
    this.name = 'HistoriaClinicaNoHabilitadaError';
    this.historiaClinicaId = historiaClinicaId;
    this.estadoActual = estadoActual;
  }
}
