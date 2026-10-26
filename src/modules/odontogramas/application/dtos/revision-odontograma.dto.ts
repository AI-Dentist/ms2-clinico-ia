import type { PiezaDentalDto } from './pieza-dental.dto.js';

export interface CambioSuperficieDeltaDto {
  superficie: string;
  condicionAnterior: string;
  condicionNueva: string;
}

export interface DeltaPiezaDto {
  numeroFDI: number;
  estadoAnatomicoAnterior?: string;
  estadoAnatomicoNuevo?: string;
  superficiesModificadas?: CambioSuperficieDeltaDto[];
  tratamientoEstructuralAgregado?: string;
  observaciones?: string | null;
}

export interface RevisionOdontogramaDto {
  id: string;
  odontogramaId: string;
  historiaClinicaId: string;
  consultaId: string | null;
  numeroRevision: number;
  tipoRevision: string;
  revisionCorregidaId: string | null;
  aplicaAlEstadoActual: boolean;
  fechaRegistro: string;
  fechaObservacionClinica: string;
  registradoPor: string;
  motivoRevision: string;
  cambiosAplicados: DeltaPiezaDto[];
  snapshotPiezas: PiezaDentalDto[];
}
