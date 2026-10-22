/**
 * Estados del ciclo de vida de un encuentro clínico odontológico.
 */
export enum EstadoConsulta {
  /** La atención se encuentra abierta y en proceso de documentación en sillón. */
  EN_CURSO = 'EN_CURSO',
  /** La atención ha culminado formalmente con los requisitos clínicos mínimos. Es inmutable. */
  COMPLETADA = 'COMPLETADA',
  /** La atención fue interrumpida o cancelada con motivo justificado. Es inmutable. */
  CANCELADA = 'CANCELADA',
}
