import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TipoRevisionOdontograma } from '../../../domain/value-objects/tipo-revision-odontograma.enum.js';
import { DeltaPiezaHttpDto } from './delta-pieza.http-dto.js';

export class RegistrarRevisionOdontogramaHttpDto {
  @ApiProperty({
    description: 'Versión del odontograma maestro sobre la cual se proyectan los cambios',
    example: 1,
    minimum: 1,
  })
  @IsInt({ message: 'La versión esperada debe ser un número entero.' })
  @Min(1, { message: 'La versión esperada debe ser un entero positivo mayor o igual a 1.' })
  versionEsperada: number;

  @ApiProperty({
    description: 'Tipo de revisión registrada en el historial',
    enum: TipoRevisionOdontograma,
    example: TipoRevisionOdontograma.NUEVA_OBSERVACION,
  })
  @IsEnum(TipoRevisionOdontograma, {
    message: 'El tipo de revisión debe ser un valor válido (NUEVA_OBSERVACION o ENMIENDA_CORRECTIVA).',
  })
  tipoRevision: TipoRevisionOdontograma;

  @ApiPropertyOptional({
    description: 'Identificador canónico de la consulta clínica en curso (opcional)',
    example: 'cons_12345678-aaaa-bbbb',
  })
  @IsOptional()
  @IsString({ message: 'El ID de la consulta debe ser una cadena de texto.' })
  consultaId?: string | null;

  @ApiProperty({
    description: 'Fecha clínica real en que ocurrió la observación o intervención (formato ISO 8601)',
    example: '2026-10-26T08:30:00.000Z',
  })
  @IsNotEmpty({ message: 'La fecha de observación clínica es obligatoria.' })
  @IsISO8601({}, { message: 'La fecha de observación clínica debe ser una fecha ISO 8601 válida.' })
  fechaObservacionClinica: string;

  @ApiProperty({
    description: 'Motivo o justificación clínica de la revisión registrada',
    example: 'Restauración oclusal pieza 16 y diagnóstico de caries en pieza 21.',
    maxLength: 500,
  })
  @IsNotEmpty({ message: 'El motivo de la revisión es obligatorio.' })
  @IsString({ message: 'El motivo de la revisión debe ser una cadena de texto.' })
  @MaxLength(500, { message: 'El motivo de la revisión no puede exceder 500 caracteres.' })
  motivoRevision: string;

  @ApiProperty({
    description: 'Conjunto de deltas o modificaciones aplicadas a las piezas dentales',
    type: [DeltaPiezaHttpDto],
  })
  @IsArray({ message: 'Los deltas deben ser una lista de cambios.' })
  @ValidateNested({ each: true })
  @Type(() => DeltaPiezaHttpDto)
  deltas: DeltaPiezaHttpDto[];

  @ApiPropertyOptional({
    description: 'Identificador canónico de la revisión previa rectificada (obligatorio si tipoRevision es ENMIENDA_CORRECTIVA)',
    example: 'rev_12345678-aaaa-bbbb',
  })
  @IsOptional()
  @IsString({ message: 'El ID de la revisión corregida debe ser una cadena de texto.' })
  revisionCorregidaId?: string | null;

  @ApiProperty({
    description: 'Determina si la revisión proyecta y actualiza el estado consolidado actual del odontograma',
    example: true,
  })
  @IsBoolean({ message: 'El campo aplicaAlEstadoActual debe ser un valor booleano.' })
  aplicaAlEstadoActual: boolean;
}
