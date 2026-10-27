import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { CategoriaEstudio } from '../../../domain/enums/categoria-estudio.enum.js';
import { EstadoCatalogo } from '../../../domain/enums/estado-catalogo.enum.js';

export class CrearTipoEstudioHttpDto {
  @IsString({ message: 'El código debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El código es obligatorio' })
  @MinLength(2, { message: 'El código debe tener al menos 2 caracteres' })
  codigo: string;

  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MinLength(3, { message: 'El nombre debe tener al menos 3 caracteres' })
  nombre: string;

  @IsEnum(CategoriaEstudio, { message: 'La categoría debe ser LABORATORIO o IMAGENOLOGIA' })
  categoria: CategoriaEstudio;

  @IsString({ message: 'La descripción debe ser una cadena de texto' })
  @IsOptional()
  descripcion?: string;
}

export class ActualizarTipoEstudioHttpDto {
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @IsOptional()
  @MinLength(3, { message: 'El nombre debe tener al menos 3 caracteres' })
  nombre?: string;

  @IsEnum(CategoriaEstudio, { message: 'La categoría debe ser LABORATORIO o IMAGENOLOGIA' })
  @IsOptional()
  categoria?: CategoriaEstudio;

  @IsString({ message: 'La descripción debe ser una cadena de texto' })
  @IsOptional()
  descripcion?: string;
}

export class CambiarEstadoTipoEstudioHttpDto {
  @IsEnum(EstadoCatalogo, { message: 'El estado debe ser ACTIVO o INACTIVO' })
  @IsOptional()
  estado?: EstadoCatalogo;

  @IsBoolean({ message: 'El campo activo debe ser booleano' })
  @IsOptional()
  activo?: boolean;
}
