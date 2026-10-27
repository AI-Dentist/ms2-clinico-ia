import type { Laboratorio } from '../entities/laboratorio.entity.js';

export interface ILaboratorioRepositoryPort {
  guardar(laboratorio: Laboratorio): Promise<Laboratorio>;
  buscarPorId(id: string): Promise<Laboratorio | null>;
  buscarPorNombre(nombre: string): Promise<Laboratorio | null>;
  listar(filtros?: { soloActivos?: boolean }): Promise<Laboratorio[]>;
  existe(id: string): Promise<boolean>;
}

export const LABORATORIO_REPOSITORY = Symbol('ILaboratorioRepositoryPort');
