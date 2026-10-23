import { IsInt, IsNotEmpty, IsString, Min, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CancelarConsultaHttpDto {
  @ApiProperty({
    description: 'Versión esperada de la consulta para control de concurrencia optimista',
    example: 1,
    minimum: 1,
  })
  @IsNotEmpty({ message: 'La versión esperada es obligatoria.' })
  @IsInt({ message: 'La versión esperada debe ser un número entero.' })
  @Min(1, { message: 'La versión esperada debe ser al menos 1.' })
  versionEsperada: number;

  @ApiProperty({
    description: 'Motivo clínico o administrativo justificado de la cancelación',
    example: 'Paciente se retira de la clínica antes de iniciar la intervención por emergencia personal.',
  })
  @IsNotEmpty({ message: 'El motivo de cancelación es obligatorio.' })
  @IsString({ message: 'El motivo de cancelación debe ser una cadena de texto.' })
  @MinLength(5, { message: 'El motivo de cancelación debe contener al menos 5 caracteres.' })
  motivoCancelacion: string;
}
