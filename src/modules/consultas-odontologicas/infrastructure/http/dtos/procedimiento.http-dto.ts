import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProcedimientoHttpDto {
  @ApiPropertyOptional({
    description: 'Código de procedimiento o nomenclatura clínica',
    example: 'PROC-OBT-01',
  })
  @IsOptional()
  @IsString({ message: 'El código del procedimiento debe ser una cadena de texto.' })
  codigo?: string | null;

  @ApiProperty({
    description: 'Descripción del procedimiento realizado en sillón',
    example: 'Obturación con resina compuesta fotocurable',
  })
  @IsNotEmpty({ message: 'La descripción del procedimiento es obligatoria.' })
  @IsString({ message: 'La descripción del procedimiento debe ser una cadena de texto.' })
  descripcion: string;

  @ApiPropertyOptional({
    description: 'Número de pieza dental según nomenclatura internacional FDI (11 a 85)',
    example: 36,
  })
  @IsOptional()
  @IsInt({ message: 'La pieza dental debe ser un número entero FDI válido.' })
  piezaDental?: number | null;

  @ApiPropertyOptional({
    description: 'Observaciones o detalles técnicos de la intervención',
    example: 'Aislamiento absoluto con dique de goma. Cavidad clase II.',
  })
  @IsOptional()
  @IsString({ message: 'Las observaciones deben ser una cadena de texto.' })
  observaciones?: string | null;
}
