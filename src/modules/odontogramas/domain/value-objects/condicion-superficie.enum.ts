/**
 * Condición clínica observada en una superficie dental específica.
 */
export enum CondicionSuperficie {
  /** Superficie no examinada individualmente */
  NO_EVALUADA = 'NO_EVALUADA',
  /** Superficie examinada sin evidencia clínica de lesión ni restauración previa */
  SANA = 'SANA',
  /** Lesión desmineralizante activa o cavitación cariosa */
  CARIES = 'CARIES',
  /** Restauración previa con resina compuesta */
  OBTURACION_RESINA = 'OBTURACION_RESINA',
  /** Restauración previa con amalgama dental */
  OBTURACION_AMALGAMA = 'OBTURACION_AMALGAMA',
  /** Pérdida estructural por fractura o traumatismo */
  FRACTURA = 'FRACTURA',
  /** Sellante preventivo de fosas y fisuras */
  SELLANTE = 'SELLANTE',
}
