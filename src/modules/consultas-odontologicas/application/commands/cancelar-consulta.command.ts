/**
 * Comando para cancelar una consulta odontológica en curso por motivo justificado.
 */
export interface CancelarConsultaCommand {
  tokenAutenticacion: string;
  consultaId: string;
  versionEsperada: number;
  motivoCancelacion: string;
}
