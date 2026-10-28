import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ItemServicioFacturableHttpDto } from './item-servicio-facturable.http-dto.js';

export class CompletarConsultaHttpDto {
  @ApiProperty({
    description: 'Versión esperada de la consulta para control de concurrencia optimista',
    example: 1,
    minimum: 1,
  })
  @IsNotEmpty({ message: 'La versión esperada es obligatoria.' })
  @IsInt({ message: 'La versión esperada debe ser un número entero.' })
  @Min(1, { message: 'La versión esperada debe ser al menos 1.' })
  versionEsperada: number;

  @ApiPropertyOptional({
    description:
      'Lista de servicios facturables del catálogo de MS1 realizados durante la atención (opcional si la consulta es de control o sin cobro)',
    type: [ItemServicioFacturableHttpDto],
  })
  @IsOptional()
  @IsArray({ message: 'Los servicios facturables deben ser un arreglo.' })
  @ValidateNested({ each: true })
  @Type(() => ItemServicioFacturableHttpDto)
  serviciosFacturables?: ItemServicioFacturableHttpDto[];

  @ApiPropertyOptional({
    description: 'Observaciones o instrucciones comerciales para la orden de cobro en MS1',
    example: 'Paciente solicita factura con NIT 12345678',
    maxLength: 500,
  })
  @IsOptional()
  @IsString({ message: 'Las observaciones de cobro deben ser una cadena de texto.' })
  @MaxLength(500, { message: 'Las observaciones de cobro no pueden superar los 500 caracteres.' })
  observacionesCobro?: string;
}
