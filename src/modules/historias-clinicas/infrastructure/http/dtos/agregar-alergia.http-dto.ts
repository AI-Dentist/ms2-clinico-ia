import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { SeveridadAlergia } from '../../../domain/value-objects/severidad-alergia.enum.js';

export class AgregarAlergiaHttpDto {
  @ApiProperty({
    description: 'Versión esperada del expediente para control de concurrencia optimista',
    example: 1,
    minimum: 1,
  })
  @IsInt({ message: 'versionEsperada debe ser un número entero.' })
  @Min(1, { message: 'versionEsperada debe ser mayor o igual a 1.' })
  versionEsperada: number;

  @ApiProperty({
    description: 'Sustancia alérgena (única en el expediente, case-insensitive)',
    example: 'Penicilina',
  })
  @IsString()
  @IsNotEmpty({ message: 'sustancia es obligatoria y no puede estar vacía.' })
  sustancia: string;

  @ApiProperty({
    description: 'Manifestación clínica o tipo de reacción observada o referida',
    example: 'Shock anafiláctico / Urticaria',
  })
  @IsString()
  @IsNotEmpty({ message: 'tipoReaccion es obligatorio.' })
  tipoReaccion: string;

  @ApiProperty({
    description: 'Severidad clínica de la alergia',
    enum: SeveridadAlergia,
    example: SeveridadAlergia.GRAVE,
  })
  @IsEnum(SeveridadAlergia, { message: 'severidad debe ser LEVE, MODERADA o GRAVE.' })
  severidad: SeveridadAlergia;

  @ApiPropertyOptional({
    description: 'Notas adicionales sobre el episodio o advertencias',
    example: 'Reacción en infancia; evitar todo betalactámico.',
  })
  @IsString()
  @IsOptional()
  notasAdicionales?: string | null;

  @ApiPropertyOptional({
    description: 'Justificación del profesional para el registro de auditoría',
    example: 'Reportado por el paciente en control periódico.',
  })
  @IsString()
  @IsOptional()
  descripcion?: string | null;
}
