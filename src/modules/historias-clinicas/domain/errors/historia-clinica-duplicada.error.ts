/** Se lanza al intentar crear una historia clínica para un paciente que ya tiene una. (INV-01) */
export class HistoriaClinicaDuplicadaError extends Error {
  readonly codigo = 'HISTORIA_DUPLICADA';

  constructor(pacienteId: string) {
    super(`Ya existe una historia clínica para el paciente '${pacienteId}'.`);
    this.name = 'HistoriaClinicaDuplicadaError';
  }
}
