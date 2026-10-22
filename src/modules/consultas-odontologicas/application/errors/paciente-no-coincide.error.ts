/**
 * Error de aplicación lanzado cuando el paciente indicado en la solicitud
 * no coincide con el titular de la historia clínica referenciada.
 */
export class PacienteNoCoincideError extends Error {
  readonly codigo = 'PACIENTE_NO_COINCIDE';
  readonly pacienteEsperado: string;
  readonly pacienteRecibido: string;

  constructor(pacienteEsperado: string, pacienteRecibido: string) {
    super(
      `El paciente '${pacienteRecibido}' no coincide con el titular del expediente clínico ('${pacienteEsperado}').`
    );
    this.name = 'PacienteNoCoincideError';
    this.pacienteEsperado = pacienteEsperado;
    this.pacienteRecibido = pacienteRecibido;
  }
}
