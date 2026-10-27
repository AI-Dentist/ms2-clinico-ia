import { Inject, Injectable } from '@nestjs/common';
import crypto from 'node:crypto';
import {
  LABORATORIO_REPOSITORY,
  type ILaboratorioRepositoryPort,
} from '../../domain/ports/laboratorio.repository.port.js';
import { Laboratorio } from '../../domain/entities/laboratorio.entity.js';
import { LaboratorioDuplicadoError } from '../../domain/errors/conflict-estudios.errors.js';
import { LaboratorioNoEncontradoError } from '../../domain/errors/not-found-estudios.errors.js';
import { EstudiosMapper } from '../estudios.mapper.js';
import type { LaboratorioDto } from '../dtos/estudios.dtos.js';

export interface CrearLaboratorioCommand {
  nombre: string;
  descripcion?: string;
  contacto?: string | null;
}

export interface ActualizarLaboratorioCommand {
  nombre?: string;
  descripcion?: string;
  contacto?: string | null;
}

@Injectable()
export class CrearLaboratorioUseCase {
  constructor(
    @Inject(LABORATORIO_REPOSITORY)
    private readonly repo: ILaboratorioRepositoryPort
  ) {}

  async execute(cmd: CrearLaboratorioCommand): Promise<LaboratorioDto> {
    const existente = await this.repo.buscarPorNombre(cmd.nombre.trim());
    if (existente) {
      throw new LaboratorioDuplicadoError(cmd.nombre.trim());
    }

    const lab = Laboratorio.crear({
      id: `lab_${crypto.randomUUID()}`,
      nombre: cmd.nombre,
      descripcion: cmd.descripcion || '',
      contacto: cmd.contacto,
    });

    const guardado = await this.repo.guardar(lab);
    return EstudiosMapper.laboratorioToDto(guardado);
  }
}

@Injectable()
export class ListarLaboratoriosUseCase {
  constructor(
    @Inject(LABORATORIO_REPOSITORY)
    private readonly repo: ILaboratorioRepositoryPort
  ) {}

  async execute(filtros?: { soloActivos?: boolean }): Promise<LaboratorioDto[]> {
    const list = await this.repo.listar(filtros);
    return list.map((l) => EstudiosMapper.laboratorioToDto(l));
  }
}

@Injectable()
export class ObtenerLaboratorioPorIdUseCase {
  constructor(
    @Inject(LABORATORIO_REPOSITORY)
    private readonly repo: ILaboratorioRepositoryPort
  ) {}

  async execute(id: string): Promise<LaboratorioDto> {
    const lab = await this.repo.buscarPorId(id);
    if (!lab) {
      throw new LaboratorioNoEncontradoError(id);
    }
    return EstudiosMapper.laboratorioToDto(lab);
  }
}

@Injectable()
export class ActualizarLaboratorioUseCase {
  constructor(
    @Inject(LABORATORIO_REPOSITORY)
    private readonly repo: ILaboratorioRepositoryPort
  ) {}

  async execute(id: string, cmd: ActualizarLaboratorioCommand): Promise<LaboratorioDto> {
    const lab = await this.repo.buscarPorId(id);
    if (!lab) {
      throw new LaboratorioNoEncontradoError(id);
    }

    if (cmd.nombre && cmd.nombre.trim().toLowerCase() !== lab.nombre.toLowerCase()) {
      const otro = await this.repo.buscarPorNombre(cmd.nombre.trim());
      if (otro && otro.id !== id) {
        throw new LaboratorioDuplicadoError(cmd.nombre.trim());
      }
    }

    lab.actualizarDatos({
      nombre: cmd.nombre,
      descripcion: cmd.descripcion,
      contacto: cmd.contacto,
    });

    const guardado = await this.repo.guardar(lab);
    return EstudiosMapper.laboratorioToDto(guardado);
  }
}

@Injectable()
export class CambiarEstadoLaboratorioUseCase {
  constructor(
    @Inject(LABORATORIO_REPOSITORY)
    private readonly repo: ILaboratorioRepositoryPort
  ) {}

  async execute(id: string, activo: boolean): Promise<LaboratorioDto> {
    const lab = await this.repo.buscarPorId(id);
    if (!lab) {
      throw new LaboratorioNoEncontradoError(id);
    }

    if (activo) {
      lab.activar();
    } else {
      lab.desactivar();
    }

    const guardado = await this.repo.guardar(lab);
    return EstudiosMapper.laboratorioToDto(guardado);
  }
}
