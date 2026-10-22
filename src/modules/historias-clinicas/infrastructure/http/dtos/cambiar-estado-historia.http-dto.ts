import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { EstadoHistoria } from '../../../domain/value-objects/estado-historia.enum.js';

export class CambiarEstadoHistoriaHttpDto {
  @ApiProperty({
    description: 'Versión esperada del expediente para control de concurrencia optimista',
    example: 1,
    minimum: 1,
  })
  @IsInt({ message: 'versionEsperada debe ser un número entero.' })
  @Min(1, { message: 'versionEsperada debe ser mayor o igual a 1.' })
  versionEsperada: number;

  @ApiProperty({
    description: 'Estado destino para la historia clínica',
    enum: EstadoHistoria,
    example: EstadoHistoria.CERRADA,
  })
  @IsEnum(EstadoHistoria, {
    message: 'nuevoEstado debe ser ACTIVA, CERRADA o ARCHIVADA.',
  })
  nuevoEstado: EstadoHistoria;

  @ApiPropertyOptional({
    description: 'Motivo o justificación del cambio de estado',
    example: 'Cierre del expediente clínico por alta y culminación de tratamiento.',
  })
  @IsString()
  @IsOptional()
  descripcion?: string | null;
}
