import { IsArray, IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { ValorReferencia } from '../../../domain/entities/resultado-estudio.entity.js';

export class ArchivoAdjuntoHttpDto {
  @IsString({ message: 'La urlArchivo debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La urlArchivo es obligatoria' })
  urlArchivo: string;

  @IsString({ message: 'El nombreArchivo debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombreArchivo es obligatorio' })
  nombreArchivo: string;

  @IsString({ message: 'El mimeType debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El mimeType es obligatorio' })
  mimeType: string;

  @IsNumber({}, { message: 'El tamanioBytes debe ser un número entero' })
  tamanioBytes: number;
}

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

  @IsOptional()
  @ValidateNested()
  @Type(() => ArchivoAdjuntoHttpDto)
  archivoAdjunto?: ArchivoAdjuntoHttpDto;
}
