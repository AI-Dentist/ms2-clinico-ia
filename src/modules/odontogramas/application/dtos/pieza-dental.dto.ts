export interface SuperficieDentalDto {
  superficie: string;
  condicion: string;
  evaluada: boolean;
}

export interface TratamientoEstructuralDto {
  tipo: string;
  consultaId: string | null;
  fechaRegistro: string;
}

export interface PiezaDentalDto {
  numeroFDI: number;
  estadoAnatomico: string;
  estadoEvaluacion: string;
  superficies: Record<string, SuperficieDentalDto>;
  tratamientosEstructurales: TratamientoEstructuralDto[];
  observaciones: string | null;
}
