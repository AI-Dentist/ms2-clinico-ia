import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class EliminarAlergiaHttpDto {
  @ApiProperty({
    description: 'Versión esperada del expediente clínico para control de concurrencia optimista',
    example: 2,
    minimum: 1,
  })
  @IsInt({ message: 'versionEsperada debe ser un número entero.' })
  @Min(1, { message: 'versionEsperada debe ser mayor o igual a 1.' })
  versionEsperada: number;

  @ApiPropertyOptional({
    description: 'Motivo de la eliminación de la alergia para registro de auditoría',
    example: 'Prueba de alergia posterior resultó negativa.',
  })
  @IsString()
  @IsOptional()
  descripcion?: string | null;
}
