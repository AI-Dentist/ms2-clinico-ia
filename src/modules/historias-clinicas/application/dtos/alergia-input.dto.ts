import type { SeveridadAlergia } from '../../domain/value-objects/severidad-alergia.enum.js';

export interface AlergiaInputDto {
  sustancia: string;
  tipoReaccion: string;
  severidad: SeveridadAlergia;
  notasAdicionales?: string | null;
  registradaEn?: Date | string | null;
}
