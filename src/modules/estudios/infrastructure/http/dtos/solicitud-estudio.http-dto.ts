import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PrioridadEstudio } from '../../../domain/enums/prioridad-estudio.enum.js';
import { EstadoSolicitudEstudio } from '../../../domain/enums/estado-solicitud-estudio.enum.js';

export class CrearSolicitudEstudioHttpDto {
  @IsString({ message: 'El consultaId debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El consultaId es obligatorio' })
  consultaId: string;

  @IsString({ message: 'El tipoEstudioId debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El tipoEstudioId es obligatorio' })
  tipoEstudioId: string;

  @IsString({ message: 'El motivo clínico debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El motivo clínico es obligatorio' })
  motivo: string;

  @IsString({ message: 'Las indicaciones deben ser una cadena de texto' })
  @IsOptional()
  indicaciones?: string;

  @IsEnum(PrioridadEstudio, { message: 'La prioridad debe ser RUTINA o URGENTE' })
  @IsOptional()
  prioridad?: PrioridadEstudio;
}

export class CambiarEstadoSolicitudHttpDto {
  @IsEnum(EstadoSolicitudEstudio, { message: 'El estado debe ser EN_PROCESO o CANCELADO' })
  estado: EstadoSolicitudEstudio;

  @IsString({ message: 'El motivo de cancelación debe ser una cadena de texto' })
  @IsOptional()
  motivoCancelacion?: string;
}
