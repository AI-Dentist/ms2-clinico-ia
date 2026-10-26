export class HistoriaClinicaInvalidaError extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'HistoriaClinicaInvalidaError';
  }

  static noEncontrada(historiaClinicaId: string): HistoriaClinicaInvalidaError {
    return new HistoriaClinicaInvalidaError(
      `La Historia Clínica con ID '${historiaClinicaId}' no existe en el sistema.`
    );
  }

  static noActiva(historiaClinicaId: string, estadoActual: string): HistoriaClinicaInvalidaError {
    return new HistoriaClinicaInvalidaError(
      `La Historia Clínica con ID '${historiaClinicaId}' no está ACTIVA (estado actual: ${estadoActual}). No se admiten operaciones odontográficas.`
    );
  }
}
