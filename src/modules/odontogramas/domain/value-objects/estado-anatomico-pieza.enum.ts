/**
 * Estado anatómico real de la pieza dental en la cavidad oral.
 */
export enum EstadoAnatomicoPieza {
  /**
   * Estado basal neutro: se desconoce si la pieza está presente, ausente o no erupcionada.
   * Asignado obligatoriamente a las 52 posiciones FDI durante la inicialización.
   */
  DESCONOCIDO = 'DESCONOCIDO',
  /** Confirmada presencia física erupcionada en boca */
  PRESENTE = 'PRESENTE',
  /** Confirmada ausencia congénita o agenesia biológica */
  AUSENTE = 'AUSENTE',
  /** Confirmada pérdida dental por exodoncia previa o antecedente de extracción */
  EXTRAIDO = 'EXTRAIDO',
  /** Confirmada pieza retenida, impactada intraósea o aún no erupcionada */
  NO_ERUPCIONADO = 'NO_ERUPCIONADO',
}
