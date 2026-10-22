/**
 * Query para listar las consultas odontológicas asociadas a una historia clínica con paginación estable.
 */
export interface ListarConsultasPorHistoriaQuery {
  tokenAutenticacion: string;
  historiaClinicaId: string;
  limite?: number;
  offset?: number;
}
