/**
 * Error de aplicación lanzado cuando el validador externo (MS1)
 * confirma que el paciente no existe en el sistema.
 */
export class PacienteInexistenteError extends Error {
  readonly codigo = 'PACIENTE_INEXISTENTE';

  constructor(pacienteId: string) {
    super(`El paciente con identificador '${pacienteId}' no existe en el sistema.`);
    this.name = 'PacienteInexistenteError';
  }
}
