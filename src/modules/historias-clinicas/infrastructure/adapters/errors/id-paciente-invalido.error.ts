/**
 * Error lanzado cuando el identificador de paciente suministrado no cumple
 * con el formato canónico de UUID exigido por el esquema de MS1 (RFC 4122).
 */
export class IdPacienteInvalidoError extends Error {
  readonly codigo = 'ID_PACIENTE_INVALIDO';

  constructor(pacienteId: string) {
    super(
      `El identificador de paciente '${pacienteId}' no tiene un formato UUID válido según el contrato de MS1.`,
    );
    this.name = 'IdPacienteInvalidoError';
  }
}
