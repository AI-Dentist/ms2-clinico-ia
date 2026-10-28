import { IsInt, IsNotEmpty, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ItemServicioFacturableHttpDto {
  @ApiProperty({
    description: 'UUID del servicio en el catálogo maestro de MS1',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsNotEmpty({ message: 'El servicioId es obligatorio.' })
  @IsUUID(undefined, { message: 'El servicioId debe ser un UUID válido.' })
  servicioId: string;

  @ApiProperty({
    description: 'Cantidad de veces que se realizó el servicio (>= 1)',
    example: 1,
    minimum: 1,
  })
  @IsNotEmpty({ message: 'La cantidad es obligatoria.' })
  @IsInt({ message: 'La cantidad debe ser un número entero.' })
  @Min(1, { message: 'La cantidad debe ser al menos 1.' })
  cantidad: number;

  @ApiPropertyOptional({
    description: 'Pieza dental FDI anatómica intervenida (opcional)',
    example: 16,
    minimum: 11,
    maximum: 85,
  })
  @IsOptional()
  @IsInt({ message: 'La pieza dental debe ser un número entero FDI.' })
  @Min(11, { message: 'La pieza dental FDI mínima es 11.' })
  @Max(85, { message: 'La pieza dental FDI máxima es 85.' })
  piezaDental?: number | null;
}

