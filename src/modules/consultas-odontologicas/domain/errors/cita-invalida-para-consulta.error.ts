/**
 * Se lanza cuando el citaId referenciado no es válido según las reglas de integración con MS3 o ya está asociado a otra consulta (INV-CONS-07).
 */
export class CitaInvalidaParaConsultaError extends Error {
  readonly codigo = 'CITA_INVALIDA_PARA_CONSULTA';
  readonly citaId: string;
  readonly motivo: string;

  constructor(citaId: string, motivo: string) {
    super(`La cita '${citaId}' no es válida para asociar a la consulta: ${motivo}`);
    this.name = 'CitaInvalidaParaConsultaError';
    this.citaId = citaId;
    this.motivo = motivo;
  }
}
