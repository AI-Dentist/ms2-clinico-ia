/**
 * Resultado de la validación de una cita referenciada en MS3.
 */
export interface ResultadoValidacionCita {
  esValida: boolean;
  motivoInvalidez?: string;
}

/**
 * Puerto SPI para verificar la existencia y aptitud de una cita agendada en MS3 (Wendy).
 */
export interface ICitaValidatorPort {
  validarCitaParaAtencion(citaId: string, pacienteId: string): Promise<ResultadoValidacionCita>;
}
