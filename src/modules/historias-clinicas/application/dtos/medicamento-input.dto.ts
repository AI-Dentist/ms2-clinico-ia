export interface MedicamentoInputDto {
  nombre: string;
  principioActivo?: string | null;
  dosis: string;
  motivoUso?: string | null;
  prescritoDesde?: Date | string | null;
}
