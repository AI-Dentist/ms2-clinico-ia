import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { AntecedentesHttpDto } from './antecedentes.http-dto.js';

export class CrearHistoriaClinicaHttpDto {
  @ApiProperty({
    description: 'Identificador canónico del paciente (validado en MS1)',
    example: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
  })
  @IsString()
  @IsNotEmpty({ message: 'pacienteId es obligatorio y no puede estar vacío.' })
  pacienteId: string;

  @ApiPropertyOptional({
    description:
      'Identificador del odontólogo asignado como responsable clínico. Si se omite, se asigna al profesional autenticado.',
    example: 'od_especialista_002',
  })
  @IsString()
  @IsOptional()
  odontologoResponsableId?: string;

  @ApiPropertyOptional({
    description: 'Bloque de antecedentes personales, familiares y odontológicos iniciales',
    type: AntecedentesHttpDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => AntecedentesHttpDto)
  antecedentes?: AntecedentesHttpDto;

  @ApiPropertyOptional({
    description: 'Observaciones generales o notas iniciales del expediente',
    example: 'Apertura inicial del expediente clínico odontológico.',
  })
  @IsString()
  @IsOptional()
  observacionesGenerales?: string | null;
}
