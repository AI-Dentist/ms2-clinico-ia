import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import type { EstadoEpistemico } from '../../../domain/value-objects/campo-clinico.vo.js';

export class CampoClinicoHttpDto {
  @ApiPropertyOptional({
    description: 'Nombre o etiqueta descriptiva del campo clínico',
    example: 'Hipertensión arterial',
  })
  @IsString()
  @IsOptional()
  nombre?: string | null;

  @ApiProperty({
    description: 'Estado epistémico del antecedente',
    enum: ['NO_EVALUADO', 'NEGADO', 'CONFIRMADO'],
    example: 'CONFIRMADO',
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['NO_EVALUADO', 'NEGADO', 'CONFIRMADO'])
  estado: EstadoEpistemico;

  @ApiPropertyOptional({
    description: 'Detalle clínico obligatorio cuando el estado es CONFIRMADO',
    example: 'Diagnosticada hace 5 años, controlada con medicación',
  })
  @IsString()
  @IsOptional()
  detalle?: string | null;

  @ApiPropertyOptional({
    description: 'Fecha ISO de confirmación del dato clínico',
    example: '2025-01-15T10:00:00.000Z',
  })
  @IsOptional()
  registradoEn?: Date | string | null;
}
