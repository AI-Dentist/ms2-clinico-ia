/** Se lanza cuando no existe una historia clínica para el paciente indicado. */
export class HistoriaClinicaNoEncontradaError extends Error {
  readonly codigo = 'HISTORIA_NO_ENCONTRADA';

  constructor(pacienteId: string) {
    super(`No existe historia clínica para el paciente '${pacienteId}'.`);
    this.name = 'HistoriaClinicaNoEncontradaError';
  }
}
