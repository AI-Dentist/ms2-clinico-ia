import type { TipoEstudio } from '../entities/tipo-estudio.entity.js';
import type { CategoriaEstudio } from '../enums/categoria-estudio.enum.js';

export interface ITipoEstudioRepositoryPort {
  guardar(tipo: TipoEstudio): Promise<TipoEstudio>;
  buscarPorId(id: string): Promise<TipoEstudio | null>;
  buscarPorCodigo(codigo: string): Promise<TipoEstudio | null>;
  buscarPorNombre(nombre: string): Promise<TipoEstudio | null>;
  listar(filtros?: { categoria?: CategoriaEstudio; soloActivos?: boolean }): Promise<TipoEstudio[]>;
  existe(id: string): Promise<boolean>;
}

export const TIPO_ESTUDIO_REPOSITORY = Symbol('ITipoEstudioRepositoryPort');
