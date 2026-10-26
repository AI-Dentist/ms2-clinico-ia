import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class InicializarOdontogramaHttpDto {
  @ApiProperty({
    description: 'Identificador canónico de la Historia Clínica a la que se asocia el odontograma',
    example: 'hc_12345678-aaaa-bbbb',
  })
  @IsNotEmpty({ message: 'El ID de la historia clínica es obligatorio.' })
  @IsString({ message: 'El ID de la historia clínica debe ser una cadena de texto.' })
  historiaClinicaId: string;
}
