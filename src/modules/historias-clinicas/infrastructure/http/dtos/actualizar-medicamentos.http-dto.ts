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

export class MedicamentoItemHttpDto {
  @ApiProperty({
    description: 'Nombre comercial o denominación del medicamento',
    example: 'Losartán 50mg',
  })
  @IsString()
  @IsNotEmpty({ message: 'nombre del medicamento es obligatorio.' })
  nombre: string;

  @ApiPropertyOptional({
    description: 'Principio activo del medicamento',
    example: 'Losartán potásico',
  })
  @IsString()
  @IsOptional()
  principioActivo?: string | null;

  @ApiProperty({
    description: 'Dosis y frecuencia prescrita',
    example: '1 comprimido cada 12 horas',
  })
  @IsString()
  @IsNotEmpty({ message: 'dosis es obligatoria.' })
  dosis: string;

  @ApiPropertyOptional({
    description: 'Motivo de indicación terapéutica',
    example: 'Hipertensión arterial estadio 1',
  })
  @IsString()
  @IsOptional()
  motivoUso?: string | null;

  @ApiPropertyOptional({
    description: 'Fecha aproximada o exacta desde la que consume el medicamento',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsOptional()
  prescritoDesde?: Date | string | null;
}

export class ActualizarMedicamentosHttpDto {
  @ApiProperty({
    description: 'Versión esperada del expediente para control de concurrencia optimista',
    example: 1,
    minimum: 1,
  })
  @IsInt({ message: 'versionEsperada debe ser un número entero.' })
  @Min(1, { message: 'versionEsperada debe ser mayor o igual a 1.' })
  versionEsperada: number;

  @ApiProperty({
    description: 'Lista completa de medicamentos que el paciente toma actualmente',
    type: [MedicamentoItemHttpDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MedicamentoItemHttpDto)
  medicamentos: MedicamentoItemHttpDto[];

  @ApiPropertyOptional({
    description: 'Justificación del profesional para el registro de auditoría',
    example: 'Actualización farmacológica reportada en consulta periódica.',
  })
  @IsString()
  @IsOptional()
  descripcion?: string | null;
}
