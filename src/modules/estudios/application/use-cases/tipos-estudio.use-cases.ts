import { Inject, Injectable } from '@nestjs/common';
import crypto from 'node:crypto';
import {
  TIPO_ESTUDIO_REPOSITORY,
  type ITipoEstudioRepositoryPort,
} from '../../domain/ports/tipo-estudio.repository.port.js';
import { TipoEstudio } from '../../domain/entities/tipo-estudio.entity.js';
import { TipoEstudioDuplicadoError } from '../../domain/errors/conflict-estudios.errors.js';
import { TipoEstudioNoEncontradoError } from '../../domain/errors/not-found-estudios.errors.js';
import { EstudiosMapper } from '../estudios.mapper.js';
import type { TipoEstudioDto } from '../dtos/estudios.dtos.js';
import { CategoriaEstudio } from '../../domain/enums/categoria-estudio.enum.js';

export interface CrearTipoEstudioCommand {
  codigo: string;
  nombre: string;
  categoria: CategoriaEstudio;
  descripcion?: string;
}

export interface ActualizarTipoEstudioCommand {
  nombre?: string;
  categoria?: CategoriaEstudio;
  descripcion?: string;
}

@Injectable()
export class CrearTipoEstudioUseCase {
  constructor(
    @Inject(TIPO_ESTUDIO_REPOSITORY)
    private readonly repo: ITipoEstudioRepositoryPort
  ) {}

  async execute(cmd: CrearTipoEstudioCommand): Promise<TipoEstudioDto> {
    const porCodigo = await this.repo.buscarPorCodigo(cmd.codigo.trim().toUpperCase());
    if (porCodigo) {
      throw new TipoEstudioDuplicadoError('codigo', cmd.codigo.trim().toUpperCase());
    }

    const porNombre = await this.repo.buscarPorNombre(cmd.nombre.trim());
    if (porNombre) {
      throw new TipoEstudioDuplicadoError('nombre', cmd.nombre.trim());
    }

    const tipo = TipoEstudio.crear({
      id: `test_${crypto.randomUUID()}`,
      codigo: cmd.codigo,
      nombre: cmd.nombre,
      categoria: cmd.categoria,
      descripcion: cmd.descripcion || '',
    });

    const guardado = await this.repo.guardar(tipo);
    return EstudiosMapper.tipoEstudioToDto(guardado);
  }
}

@Injectable()
export class ListarTiposEstudioUseCase {
  constructor(
    @Inject(TIPO_ESTUDIO_REPOSITORY)
    private readonly repo: ITipoEstudioRepositoryPort
  ) {}

  async execute(filtros?: { categoria?: CategoriaEstudio; soloActivos?: boolean }): Promise<TipoEstudioDto[]> {
    const list = await this.repo.listar(filtros);
    return list.map((t) => EstudiosMapper.tipoEstudioToDto(t));
  }
}

@Injectable()
export class ObtenerTipoEstudioPorIdUseCase {
  constructor(
    @Inject(TIPO_ESTUDIO_REPOSITORY)
    private readonly repo: ITipoEstudioRepositoryPort
  ) {}

  async execute(id: string): Promise<TipoEstudioDto> {
    const tipo = await this.repo.buscarPorId(id);
    if (!tipo) {
      throw new TipoEstudioNoEncontradoError(id);
    }
    return EstudiosMapper.tipoEstudioToDto(tipo);
  }
}

@Injectable()
export class ActualizarTipoEstudioUseCase {
  constructor(
    @Inject(TIPO_ESTUDIO_REPOSITORY)
    private readonly repo: ITipoEstudioRepositoryPort
  ) {}

  async execute(id: string, cmd: ActualizarTipoEstudioCommand): Promise<TipoEstudioDto> {
    const tipo = await this.repo.buscarPorId(id);
    if (!tipo) {
      throw new TipoEstudioNoEncontradoError(id);
    }

    if (cmd.nombre && cmd.nombre.trim().toLowerCase() !== tipo.nombre.toLowerCase()) {
      const otro = await this.repo.buscarPorNombre(cmd.nombre.trim());
      if (otro && otro.id !== id) {
        throw new TipoEstudioDuplicadoError('nombre', cmd.nombre.trim());
      }
    }

    tipo.actualizarDatos({
      nombre: cmd.nombre,
      categoria: cmd.categoria,
      descripcion: cmd.descripcion,
    });

    const guardado = await this.repo.guardar(tipo);
    return EstudiosMapper.tipoEstudioToDto(guardado);
  }
}

@Injectable()
export class CambiarEstadoTipoEstudioUseCase {
  constructor(
    @Inject(TIPO_ESTUDIO_REPOSITORY)
    private readonly repo: ITipoEstudioRepositoryPort
  ) {}

  async execute(id: string, activo: boolean): Promise<TipoEstudioDto> {
    const tipo = await this.repo.buscarPorId(id);
    if (!tipo) {
      throw new TipoEstudioNoEncontradoError(id);
    }

    if (activo) {
      tipo.activar();
    } else {
      tipo.desactivar();
    }

    const guardado = await this.repo.guardar(tipo);
    return EstudiosMapper.tipoEstudioToDto(guardado);
  }
}
