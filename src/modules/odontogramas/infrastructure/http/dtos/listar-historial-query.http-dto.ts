import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ListarHistorialQueryHttpDto {
  @ApiPropertyOptional({
    description: 'Cantidad máxima de revisiones a recuperar (por defecto 20, máximo 100)',
    example: 20,
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El límite debe ser un número entero.' })
  @Min(1, { message: 'El límite debe ser al menos 1.' })
  @Max(100, { message: 'El límite no puede ser superior a 100.' })
  limite?: number = 20;

  @ApiPropertyOptional({
    description: 'Desplazamiento u offset para la paginación de revisiones (por defecto 0)',
    example: 0,
    default: 0,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El offset debe ser un número entero.' })
  @Min(0, { message: 'El offset no puede ser inferior a 0.' })
  offset?: number = 0;
}
