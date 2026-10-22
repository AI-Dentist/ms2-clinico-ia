/**
 * Comando para completar y sellar formalmente una consulta odontológica.
 */
export interface CompletarConsultaCommand {
  tokenAutenticacion: string;
  consultaId: string;
  versionEsperada: number;
}
