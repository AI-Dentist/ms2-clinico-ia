import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class EvolucionSOAPHttpDto {
  @ApiPropertyOptional({
    description: 'Componente Subjetivo (S): Síntomas y motivos expresados por el paciente',
    example: 'Paciente refiere mejoría notable del dolor tras medicación previa.',
  })
  @IsOptional()
  @IsString({ message: 'El componente subjetivo debe ser una cadena de texto.' })
  subjetivo?: string | null;

  @ApiPropertyOptional({
    description: 'Componente Objetivo (O): Hallazgos clínicos medibles y observables',
    example: 'Percusión vertical negativa. Sondeo periodontal sin sangrado.',
  })
  @IsOptional()
  @IsString({ message: 'El componente objetivo debe ser una cadena de texto.' })
  objetivo?: string | null;

  @ApiPropertyOptional({
    description: 'Componente Análisis (A): Interpretación diagnóstica y evolución',
    example: 'Respuesta tisular favorable con buen pronóstico.',
  })
  @IsOptional()
  @IsString({ message: 'El componente de análisis debe ser una cadena de texto.' })
  analisis?: string | null;

  @ApiPropertyOptional({
    description: 'Componente Plan (P): Tratamiento acordado y próximos pasos',
    example: 'Control en 6 meses y profilaxis programada.',
  })
  @IsOptional()
  @IsString({ message: 'El plan debe ser una cadena de texto.' })
  plan?: string | null;
}
