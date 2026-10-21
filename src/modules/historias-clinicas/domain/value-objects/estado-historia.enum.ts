/**
 * Estado del expediente de historia clínica.
 *
 * Transiciones permitidas:
 *   ACTIVA  ──► CERRADA   (baja temporal)
 *   ACTIVA  ──► ARCHIVADA (irreversible)
 *   CERRADA ──► ACTIVA    (reapertura)
 *   CERRADA ──► ARCHIVADA (irreversible)
 *   ARCHIVADA ──► *       (prohibido)
 */
export enum EstadoHistoria {
  ACTIVA = 'ACTIVA',
  CERRADA = 'CERRADA',
  ARCHIVADA = 'ARCHIVADA',
}
