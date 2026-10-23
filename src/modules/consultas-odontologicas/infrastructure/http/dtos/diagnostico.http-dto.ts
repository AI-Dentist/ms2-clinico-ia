import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TipoDiagnostico } from '../../../domain/value-objects/tipo-diagnostico.enum.js';

export class DiagnosticoHttpDto {
  @ApiPropertyOptional({
    description: 'Código CIE-10 / CIE-11 del diagnóstico',
    example: 'K04.0',
  })
  @IsOptional()
  @IsString({ message: 'El código CIE-10 debe ser una cadena de texto.' })
  codigoCIE10?: string | null;

  @ApiProperty({
    description: 'Descripción clínica del diagnóstico',
    example: 'Pulpitis reversible en pieza 36',
  })
  @IsNotEmpty({ message: 'La descripción del diagnóstico es obligatoria.' })
  @IsString({ message: 'La descripción del diagnóstico debe ser una cadena de texto.' })
  descripcion: string;

  @ApiProperty({
    description: 'Tipo de certeza diagnóstica',
    enum: TipoDiagnostico,
    example: TipoDiagnostico.DEFINITIVO,
  })
  @IsNotEmpty({ message: 'El tipo de diagnóstico es obligatorio.' })
  @IsEnum(TipoDiagnostico, {
    message: 'El tipo de diagnóstico debe ser PRESUNTIVO o DEFINITIVO.',
  })
  tipo: TipoDiagnostico;
}
