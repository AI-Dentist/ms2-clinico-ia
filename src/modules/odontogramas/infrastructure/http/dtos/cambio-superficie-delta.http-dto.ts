import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TipoSuperficie } from '../../../domain/value-objects/tipo-superficie.enum.js';
import { CondicionSuperficie } from '../../../domain/value-objects/condicion-superficie.enum.js';

export class CambioSuperficieDeltaHttpDto {
  @ApiProperty({
    description: 'Superficie anatómica dental afectada',
    enum: TipoSuperficie,
    example: TipoSuperficie.OCLUSAL_INCISAL,
  })
  @IsEnum(TipoSuperficie, {
    message: 'La superficie debe ser un valor válido de TipoSuperficie (VESTIBULAR, PALATINA_LINGUAL, MESIAL, DISTAL, OCLUSAL_INCISAL).',
  })
  superficie: TipoSuperficie;

  @ApiProperty({
    description: 'Condición previa observada en la superficie',
    enum: CondicionSuperficie,
    example: CondicionSuperficie.SANA,
  })
  @IsEnum(CondicionSuperficie, {
    message: 'La condición anterior debe ser un valor válido del enum CondicionSuperficie.',
  })
  condicionAnterior: CondicionSuperficie;

  @ApiProperty({
    description: 'Nueva condición clínica diagnosticada o ejecutada en la superficie',
    enum: CondicionSuperficie,
    example: CondicionSuperficie.CARIES,
  })
  @IsEnum(CondicionSuperficie, {
    message: 'La condición nueva debe ser un valor válido del enum CondicionSuperficie.',
  })
  condicionNueva: CondicionSuperficie;
}
