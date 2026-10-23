import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AnamnesisActualHttpDto } from './anamnesis-actual.http-dto.js';
import { ExploracionFisicaHttpDto } from './exploracion-fisica.http-dto.js';
import { DiagnosticoHttpDto } from './diagnostico.http-dto.js';
import { ProcedimientoHttpDto } from './procedimiento.http-dto.js';
import { EvolucionSOAPHttpDto } from './evolucion-soap.http-dto.js';

export class ActualizarAtencionHttpDto {
  @ApiProperty({
    description: 'Versión esperada de la consulta para control de concurrencia optimista',
    example: 1,
    minimum: 1,
  })
  @IsNotEmpty({ message: 'La versión esperada es obligatoria.' })
  @IsInt({ message: 'La versión esperada debe ser un número entero.' })
  @Min(1, { message: 'La versión esperada debe ser al menos 1.' })
  versionEsperada: number;

  @ApiPropertyOptional({
    description: 'Motivo de consulta ajustado o actualizado',
    example: 'Dolor irradiado al cuadrante 3 tras exploración.',
  })
  @IsOptional()
  @IsString({ message: 'El motivo de consulta debe ser una cadena de texto.' })
  motivoConsulta?: string;

  @ApiPropertyOptional({
    description: 'Anamnesis actual actualizada',
    type: AnamnesisActualHttpDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => AnamnesisActualHttpDto)
  anamnesisActual?: AnamnesisActualHttpDto;

  @ApiPropertyOptional({
    description: 'Exploración física actualizada',
    type: ExploracionFisicaHttpDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ExploracionFisicaHttpDto)
  exploracionFisica?: ExploracionFisicaHttpDto;

  @ApiPropertyOptional({
    description: 'Lista completa de diagnósticos actualizada',
    type: [DiagnosticoHttpDto],
  })
  @IsOptional()
  @IsArray({ message: 'Los diagnósticos deben ser un arreglo.' })
  @ValidateNested({ each: true })
  @Type(() => DiagnosticoHttpDto)
  diagnosticos?: DiagnosticoHttpDto[];

  @ApiPropertyOptional({
    description: 'Lista completa de procedimientos realizados en sillón',
    type: [ProcedimientoHttpDto],
  })
  @IsOptional()
  @IsArray({ message: 'Los procedimientos deben ser un arreglo.' })
  @ValidateNested({ each: true })
  @Type(() => ProcedimientoHttpDto)
  procedimientosRealizados?: ProcedimientoHttpDto[];

  @ApiPropertyOptional({
    description: 'Evolución clínica SOAP actualizada',
    type: EvolucionSOAPHttpDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => EvolucionSOAPHttpDto)
  evolucionSOAP?: EvolucionSOAPHttpDto;

  @ApiPropertyOptional({
    description: 'Recomendaciones terapéuticas actualizadas',
    example: 'Control de higiene oral y enjuagues con clorhexidina 0.12%.',
  })
  @IsOptional()
  @IsString({ message: 'Las recomendaciones deben ser una cadena de texto.' })
  recomendaciones?: string | null;
}
