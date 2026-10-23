import { IsInt, IsNotEmpty, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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
}
