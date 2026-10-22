import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { AntecedentesHttpDto } from './antecedentes.http-dto.js';

export class ActualizarAntecedentesHttpDto {
  @ApiProperty({
    description: 'Versión esperada del expediente clínico para control de concurrencia optimista',
    example: 1,
    minimum: 1,
  })
  @IsInt({ message: 'versionEsperada debe ser un número entero.' })
  @Min(1, { message: 'versionEsperada debe ser mayor o igual a 1.' })
  versionEsperada: number;

  @ApiProperty({
    description: 'Nuevo estado estructurado de los antecedentes',
    type: AntecedentesHttpDto,
  })
  @ValidateNested()
  @Type(() => AntecedentesHttpDto)
  @IsNotEmpty({ message: 'nuevosAntecedentes es obligatorio.' })
  nuevosAntecedentes: AntecedentesHttpDto;

  @ApiProperty({
    description: 'Rutas de campos modificados para el registro de auditoría clínica',
    example: ['antecedentes.enfermedadesCronicas', 'antecedentes.antecedentesOdontologicos'],
    type: [String],
  })
  @IsArray({ message: 'camposModificados debe ser un arreglo de cadenas.' })
  @IsString({ each: true, message: 'Cada elemento de camposModificados debe ser una cadena.' })
  camposModificados: string[];

  @ApiPropertyOptional({
    description: 'Descripción o justificación clínica del cambio para auditoría',
    example: 'Se documenta hipertensión arterial confirmada tras anamnesis.',
  })
  @IsString()
  @IsOptional()
  descripcion?: string | null;
}
