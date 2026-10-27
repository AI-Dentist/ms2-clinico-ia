import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { EstadoCatalogo } from '../../../domain/enums/estado-catalogo.enum.js';

export class CrearLaboratorioHttpDto {
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MinLength(3, { message: 'El nombre debe tener al menos 3 caracteres' })
  nombre: string;

  @IsString({ message: 'La descripción debe ser una cadena de texto' })
  @IsOptional()
  descripcion?: string;

  @IsString({ message: 'El contacto debe ser una cadena de texto' })
  @IsOptional()
  contacto?: string;
}

export class ActualizarLaboratorioHttpDto {
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @IsOptional()
  @MinLength(3, { message: 'El nombre debe tener al menos 3 caracteres' })
  nombre?: string;

  @IsString({ message: 'La descripción debe ser una cadena de texto' })
  @IsOptional()
  descripcion?: string;

  @IsString({ message: 'El contacto debe ser una cadena de texto' })
  @IsOptional()
  contacto?: string;
}

export class CambiarEstadoLaboratorioHttpDto {
  @IsEnum(EstadoCatalogo, { message: 'El estado debe ser ACTIVO o INACTIVO' })
  @IsOptional()
  estado?: EstadoCatalogo;

  @IsBoolean({ message: 'El campo activo debe ser booleano' })
  @IsOptional()
  activo?: boolean;
}
