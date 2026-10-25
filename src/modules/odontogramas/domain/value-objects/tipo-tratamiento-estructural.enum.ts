/**
 * Tratamiento estructural o protésico que compromete la pieza completa.
 */
export enum TipoTratamientoEstructural {
  /** Prótesis fija unidentaria completa (metal-cerámica, zirconio, etc.) */
  CORONA = 'CORONA',
  /** Tratamiento biomecánico de conductos radiculares (endodoncia) */
  ENDODONCIA = 'ENDODONCIA',
  /** Retención intrarradicular y reconstrucción de muñón */
  PERNO_MUÑON = 'PERNO_MUÑON',
  /** Sustitución radicular osteointegrada */
  IMPLANTE = 'IMPLANTE',
}
