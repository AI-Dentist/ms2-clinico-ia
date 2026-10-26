import type { PiezaDentalDto } from './pieza-dental.dto.js';

export interface OdontogramaActualDto {
  id: string;
  historiaClinicaId: string;
  pacienteId: string;
  revisionActualId: string;
  totalRevisiones: number;
  version: number;
  creadoEn: string;
  actualizadoEn: string;
  actualizadoPor: string;
  piezas: PiezaDentalDto[];
}
