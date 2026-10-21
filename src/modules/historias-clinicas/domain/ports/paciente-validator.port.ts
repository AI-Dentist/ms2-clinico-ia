/**
 * Puerto de salida para verificar la existencia de un paciente en MS1 (Spring Boot).
 * En producción: llama a GET /api/seguridad/pacientes/:id/existe.
 * En desarrollo: usa MockPacienteValidatorAdapter.
 *
 * @throws PacienteNoDisponibleError si MS1 no responde (timeout, 503, etc.).
 */
export interface IPacienteValidatorPort {
  existePaciente(pacienteId: string): Promise<boolean>;
}

/** Token de inyección de dependencias para IPacienteValidatorPort. */
export const PACIENTE_VALIDATOR_PORT = Symbol('IPacienteValidatorPort');
