/**
 * Query para recuperar el detalle completo de una consulta odontológica por su identificador único.
 */
export interface ObtenerConsultaPorIdQuery {
  tokenAutenticacion: string;
  consultaId: string;
}
