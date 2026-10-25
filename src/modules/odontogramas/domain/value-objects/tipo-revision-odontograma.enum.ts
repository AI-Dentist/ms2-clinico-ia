/**
 * Clasificación de la revisión odontográfica registrada en el historial.
 */
export enum TipoRevisionOdontograma {
  /** Registro de hallazgos o tratamientos observados en una fecha clínica */
  NUEVA_OBSERVACION = 'NUEVA_OBSERVACION',
  /** Enmienda o rectificación formal de un error u omisión de un registro anterior */
  ENMIENDA_CORRECTIVA = 'ENMIENDA_CORRECTIVA',
}
