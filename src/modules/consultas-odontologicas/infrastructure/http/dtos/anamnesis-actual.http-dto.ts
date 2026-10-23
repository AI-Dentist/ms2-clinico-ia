import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AnamnesisActualHttpDto {
  @ApiPropertyOptional({
    description: 'Relato cronológico de la dolencia actual',
    example: 'Paciente refiere dolor pulsátil iniciado hace 48 horas al masticar.',
  })
  @IsOptional()
  @IsString({ message: 'La descripción de la anamnesis debe ser una cadena de texto.' })
  descripcion?: string;

  @ApiPropertyOptional({
    description: 'Tiempo de evolución de los síntomas',
    example: '3 días',
  })
  @IsOptional()
  @IsString({ message: 'El tiempo de evolución debe ser una cadena de texto.' })
  tiempoEvolucion?: string | null;

  @ApiPropertyOptional({
    description: 'Escala visual analógica del dolor (EVA) de 0 a 10',
    example: 7,
    minimum: 0,
    maximum: 10,
  })
  @IsOptional()
  @IsInt({ message: 'La escala de dolor EVA debe ser un número entero.' })
  @Min(0, { message: 'La escala EVA no puede ser inferior a 0.' })
  @Max(10, { message: 'La escala EVA no puede ser superior a 10.' })
  escalaDolorEVA?: number | null;
}
