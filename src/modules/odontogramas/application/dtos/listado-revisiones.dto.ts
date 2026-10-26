import type { RevisionOdontogramaDto } from './revision-odontograma.dto.js';

export interface ListadoRevisionesPaginadoDto {
  total: number;
  limite: number;
  offset: number;
  revisiones: RevisionOdontogramaDto[];
}
