import type {
  AnamnesisActualInput,
  DiagnosticoInput,
  EvolucionSOAPInput,
  ExploracionFisicaInput,
  ProcedimientoInput,
} from './registrar-apertura-consulta.command.js';

/**
 * Comando para actualizar en bloque los datos clínicos de la atención en sillón.
 * Exige la versión esperada para control estricto de concurrencia optimista.
 */
export interface ActualizarAtencionConsultaCommand {
  tokenAutenticacion: string;
  consultaId: string;
  versionEsperada: number;
  motivoConsulta?: string;
  anamnesisActual?: AnamnesisActualInput;
  exploracionFisica?: ExploracionFisicaInput;
  diagnosticos?: DiagnosticoInput[];
  procedimientosRealizados?: ProcedimientoInput[];
  evolucionSOAP?: EvolucionSOAPInput;
  recomendaciones?: string | null;
}
