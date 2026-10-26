import type { DeltaPiezaDto } from '../dtos/revision-odontograma.dto.js';

export interface RegistrarRevisionOdontogramaCommand {
  odontogramaId: string;
  versionEsperada: number;
  tipoRevision: 'NUEVA_OBSERVACION' | 'ENMIENDA_CORRECTIVA';
  consultaId?: string | null;
  fechaObservacionClinica: string | Date;
  motivoRevision: string;
  deltas: DeltaPiezaDto[];
  revisionCorregidaId?: string | null;
  aplicaAlEstadoActual?: boolean;
  tokenOdontologo?: string;
}
