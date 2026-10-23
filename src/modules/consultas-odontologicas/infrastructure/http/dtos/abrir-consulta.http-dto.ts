import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AnamnesisActualHttpDto } from './anamnesis-actual.http-dto.js';
import { ExploracionFisicaHttpDto } from './exploracion-fisica.http-dto.js';
import { DiagnosticoHttpDto } from './diagnostico.http-dto.js';
import { ProcedimientoHttpDto } from './procedimiento.http-dto.js';
import { EvolucionSOAPHttpDto } from './evolucion-soap.http-dto.js';

export class AbrirConsultaHttpDto {
  @ApiProperty({
    description: 'Identificador canónico de la historia clínica asociada',
    example: 'hc_12345678-aaaa-bbbb',
  })
  @IsNotEmpty({ message: 'El ID de la historia clínica es obligatorio.' })
  @IsString({ message: 'El ID de la historia clínica debe ser una cadena de texto.' })
  historiaClinicaId: string;

  @ApiProperty({
    description: 'Identificador del paciente titular de la historia clínica',
    example: 'pac_dennis_001',
  })
  @IsNotEmpty({ message: 'El ID del paciente es obligatorio.' })
  @IsString({ message: 'El ID del paciente debe ser una cadena de texto.' })
  pacienteId: string;

  @ApiPropertyOptional({
    description: 'Identificador de la cita programada en MS3 (opcional)',
    example: 'cita_dev_001',
  })
  @IsOptional()
  @IsString({ message: 'El ID de la cita debe ser una cadena de texto.' })
  citaId?: string | null;

  @ApiProperty({
    description: 'Motivo principal de la consulta manifestado por el paciente',
    example: 'Dolor agudo en sector posterior inferior izquierdo.',
  })
  @IsNotEmpty({ message: 'El motivo de consulta es obligatorio.' })
  @IsString({ message: 'El motivo de consulta debe ser una cadena de texto.' })
  motivoConsulta: string;

  @ApiPropertyOptional({
    description: 'Anamnesis del episodio actual',
    type: AnamnesisActualHttpDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => AnamnesisActualHttpDto)
  anamnesisActual?: AnamnesisActualHttpDto;

  @ApiPropertyOptional({
    description: 'Exploración física realizada durante la consulta',
    type: ExploracionFisicaHttpDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ExploracionFisicaHttpDto)
  exploracionFisica?: ExploracionFisicaHttpDto;

  @ApiPropertyOptional({
    description: 'Diagnósticos iniciales emitidos',
    type: [DiagnosticoHttpDto],
  })
  @IsOptional()
  @IsArray({ message: 'Los diagnósticos deben ser un arreglo.' })
  @ValidateNested({ each: true })
  @Type(() => DiagnosticoHttpDto)
  diagnosticos?: DiagnosticoHttpDto[];

  @ApiPropertyOptional({
    description: 'Procedimientos realizados en sillón',
    type: [ProcedimientoHttpDto],
  })
  @IsOptional()
  @IsArray({ message: 'Los procedimientos deben ser un arreglo.' })
  @ValidateNested({ each: true })
  @Type(() => ProcedimientoHttpDto)
  procedimientosRealizados?: ProcedimientoHttpDto[];

  @ApiPropertyOptional({
    description: 'Evolución clínica bajo formato SOAP',
    type: EvolucionSOAPHttpDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => EvolucionSOAPHttpDto)
  evolucionSOAP?: EvolucionSOAPHttpDto;

  @ApiPropertyOptional({
    description: 'Recomendaciones e indicaciones terapéuticas',
    example: 'Evitar alimentos duros en las próximas 24 horas.',
  })
  @IsOptional()
  @IsString({ message: 'Las recomendaciones deben ser una cadena de texto.' })
  recomendaciones?: string | null;

  @ApiPropertyOptional({
    description: 'Fecha y hora de atención clínica (ISO 8601)',
    example: '2026-10-22T10:00:00.000Z',
  })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha de atención debe ser una fecha ISO 8601 válida.' })
  fechaAtencion?: string;
}
