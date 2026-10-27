import { IsArray, IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import type { ValorReferencia } from '../../../domain/entities/resultado-estudio.entity.js';

export class RegistrarResultadoEstudioHttpDto {
  @IsString({ message: 'El laboratorioId debe ser una cadena de texto' })
  @IsOptional()
  laboratorioId?: string;

  @IsDateString({}, { message: 'La fecha de resultado debe ser formato ISO 8601' })
  @IsOptional()
  fechaResultado?: string;

  @IsString({ message: 'El resumen del resultado debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El resumen del resultado es obligatorio' })
  resumen: string;

  @IsString({ message: 'Las observaciones deben ser una cadena de texto' })
  @IsOptional()
  observaciones?: string;

  @IsArray({ message: 'Los valores de referencia deben ser un arreglo' })
  @IsOptional()
  valoresReferencia?: ValorReferencia[];
}
