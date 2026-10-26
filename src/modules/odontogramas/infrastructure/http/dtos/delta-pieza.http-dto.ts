import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EstadoAnatomicoPieza } from '../../../domain/value-objects/estado-anatomico-pieza.enum.js';
import { TipoTratamientoEstructural } from '../../../domain/value-objects/tipo-tratamiento-estructural.enum.js';
import { CambioSuperficieDeltaHttpDto } from './cambio-superficie-delta.http-dto.js';
import { EsNumeroFDIValido } from '../validators/es-numero-fdi.validator.js';

export class DeltaPiezaHttpDto {
  @ApiProperty({
    description: 'Número de pieza según nomenclatura internacional FDI (11-48 adultos, 51-85 deciduos)',
    example: 16,
  })
  @IsInt({ message: 'El número FDI debe ser un número entero.' })
  @EsNumeroFDIValido({
    message: 'El número FDI debe corresponder a una de las 52 posiciones anatómicas válidas.',
  })
  numeroFDI: number;

  @ApiPropertyOptional({
    description: 'Estado anatómico anterior de la pieza',
    enum: EstadoAnatomicoPieza,
    example: EstadoAnatomicoPieza.PRESENTE,
  })
  @IsOptional()
  @IsEnum(EstadoAnatomicoPieza, {
    message: 'El estado anatómico anterior debe ser un valor válido de EstadoAnatomicoPieza.',
  })
  estadoAnatomicoAnterior?: EstadoAnatomicoPieza;

  @ApiPropertyOptional({
    description: 'Nuevo estado anatómico de la pieza',
    enum: EstadoAnatomicoPieza,
    example: EstadoAnatomicoPieza.PRESENTE,
  })
  @IsOptional()
  @IsEnum(EstadoAnatomicoPieza, {
    message: 'El estado anatómico nuevo debe ser un valor válido de EstadoAnatomicoPieza.',
  })
  estadoAnatomicoNuevo?: EstadoAnatomicoPieza;

  @ApiPropertyOptional({
    description: 'Modificaciones específicas en superficies dentales',
    type: [CambioSuperficieDeltaHttpDto],
  })
  @IsOptional()
  @IsArray({ message: 'Las superficies modificadas deben ser un arreglo.' })
  @ValidateNested({ each: true })
  @Type(() => CambioSuperficieDeltaHttpDto)
  superficiesModificadas?: CambioSuperficieDeltaHttpDto[];

  @ApiPropertyOptional({
    description: 'Tratamiento estructural o protésico agregado a la pieza',
    enum: TipoTratamientoEstructural,
    example: TipoTratamientoEstructural.CORONA,
  })
  @IsOptional()
  @IsEnum(TipoTratamientoEstructural, {
    message: 'El tratamiento estructural agregado debe ser un valor válido de TipoTratamientoEstructural.',
  })
  tratamientoEstructuralAgregado?: TipoTratamientoEstructural;

  @ApiPropertyOptional({
    description: 'Notas u observaciones clínicas de la pieza dental',
    example: 'Aislamiento absoluto con grapa #14',
    maxLength: 500,
  })
  @IsOptional()
  @IsString({ message: 'Las observaciones deben ser una cadena de texto.' })
  @MaxLength(500, { message: 'Las observaciones no pueden exceder 500 caracteres.' })
  observaciones?: string | null;
}
