import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ExploracionFisicaHttpDto {
  @ApiPropertyOptional({
    description: 'Hallazgos de la inspección extraoral (asimetrías, ganglios, ATM)',
    example: 'ATM sin chasquidos ni dolor a la palpación.',
  })
  @IsOptional()
  @IsString({ message: 'La inspección extraoral debe ser una cadena de texto.' })
  inspeccionExtraoral?: string | null;

  @ApiProperty({
    description: 'Inspección intraoral de tejidos blandos y periodontales',
    example: 'Mucosa y encías normocoloreadas. Caries activa ocluso-distal en 36.',
  })
  @IsNotEmpty({ message: 'La inspección intraoral es obligatoria.' })
  @IsString({ message: 'La inspección intraoral debe ser una cadena de texto.' })
  inspeccionIntraoral: string;

  @ApiPropertyOptional({
    description: 'Hallazgos dentales específicos o notas de oclusión',
    example: 'Facetas de desgaste en sector anterior.',
  })
  @IsOptional()
  @IsString({ message: 'Los hallazgos dentales deben ser una cadena de texto.' })
  hallazgosDentales?: string | null;
}
