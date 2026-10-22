import type { TipoDiagnostico } from '../../domain/value-objects/tipo-diagnostico.enum.js';

export interface DiagnosticoInput {
  codigoCIE10?: string | null;
  descripcion: string;
  tipo: TipoDiagnostico | 'PRESUNTIVO' | 'DEFINITIVO';
}

export interface ProcedimientoInput {
  codigo?: string | null;
  descripcion: string;
  piezaDental?: number | null;
  observaciones?: string | null;
}

export interface AnamnesisActualInput {
  descripcion?: string;
  tiempoEvolucion?: string | null;
  escalaDolorEVA?: number | null;
}

export interface ExploracionFisicaInput {
  inspeccionExtraoral?: string | null;
  inspeccionIntraoral: string;
  hallazgosDentales?: string | null;
}

export interface EvolucionSOAPInput {
  subjetivo?: string | null;
  objetivo?: string | null;
  analisis?: string | null;
  plan?: string | null;
}

/**
 * Comando para registrar la apertura de un nuevo encuentro clínico odontológico.
 */
export interface RegistrarAperturaConsultaCommand {
  tokenAutenticacion: string;
  historiaClinicaId: string;
  pacienteId: string;
  citaId?: string | null;
  motivoConsulta: string;
  anamnesisActual?: AnamnesisActualInput;
  exploracionFisica?: ExploracionFisicaInput;
  diagnosticos?: DiagnosticoInput[];
  procedimientosRealizados?: ProcedimientoInput[];
  evolucionSOAP?: EvolucionSOAPInput;
  recomendaciones?: string | null;
  fechaAtencion?: Date;
}
