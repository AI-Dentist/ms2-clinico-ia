import type { ConsultaOdontologicaResponseDto } from './consulta-odontologica-response.dto.js';

/**
 * Data Transfer Object paginado para listados de consultas odontológicas.
 */
export interface ListadoConsultasResponseDto {
  consultas: ConsultaOdontologicaResponseDto[];
  total: number;
  limite: number;
  offset: number;
}
