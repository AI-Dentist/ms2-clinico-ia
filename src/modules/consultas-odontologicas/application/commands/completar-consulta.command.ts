export interface ItemServicioFacturableCommand {
  servicioId: string;
  cantidad: number;
  piezaDental?: number | null;
}

/**
 * Comando para completar y sellar formalmente una consulta odontológica,
 * registrando opcionalmente los servicios facturables para su cobro en MS1.
 */
export interface CompletarConsultaCommand {
  tokenAutenticacion: string;
  consultaId: string;
  versionEsperada: number;
  serviciosFacturables?: ItemServicioFacturableCommand[];
  observacionesCobro?: string | null;
}
