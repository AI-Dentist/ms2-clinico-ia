import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { IHistoriaClinicaRepository } from '../../../../domain/ports/historia-clinica.repository.port.js';
import type { HistoriaClinica } from '../../../../domain/entities/historia-clinica.entity.js';
import type { HistoriaClinicaId } from '../../../../domain/value-objects/historia-clinica-id.vo.js';
import type { PacienteId } from '../../../../domain/value-objects/paciente-id.vo.js';
import { HistoriaClinicaDuplicadaError } from '../../../../domain/errors/historia-clinica-duplicada.error.js';
import { HistoriaClinicaNoEncontradaError } from '../../../../domain/errors/historia-clinica-no-encontrada.error.js';
import { ConflictoConcurrenteError } from '../../../../domain/errors/conflicto-concurrente.error.js';
import { HistoriaClinicaDocument } from '../schemas/historia-clinica.schema.js';
import { HistoriaClinicaMongoMapper } from '../mappers/historia-clinica-mongo.mapper.js';

interface MongoErrorLike {
  code?: number;
  name?: string;
  message?: string;
}

@Injectable()
export class MongoHistoriaClinicaRepository implements IHistoriaClinicaRepository {
  constructor(
    @InjectModel(HistoriaClinicaDocument.name)
    private readonly model: Model<HistoriaClinicaDocument>,
  ) {}

  async guardar(historia: HistoriaClinica): Promise<void> {
    const doc = HistoriaClinicaMongoMapper.toPersistence(historia);

    try {
      await this.model.create(doc);
    } catch (error: unknown) {
      const err = error as MongoErrorLike;
      if (err.code === 11000) {
        throw new HistoriaClinicaDuplicadaError(historia.pacienteId.valor);
      }
      throw error;
    }
  }

  async buscarPorId(id: HistoriaClinicaId): Promise<HistoriaClinica | null> {
    const doc = await this.model.findById(id.valor).exec();
    if (!doc) {
      return null;
    }
    return HistoriaClinicaMongoMapper.toDomain(doc);
  }

  async buscarPorPacienteId(pacienteId: PacienteId): Promise<HistoriaClinica | null> {
    const doc = await this.model.findOne({ pacienteId: pacienteId.valor }).exec();
    if (!doc) {
      return null;
    }
    return HistoriaClinicaMongoMapper.toDomain(doc);
  }

  async existePorPacienteId(pacienteId: PacienteId): Promise<boolean> {
    const count = await this.model
      .countDocuments({ pacienteId: pacienteId.valor })
      .exec();
    return count > 0;
  }

  async actualizar(
    historia: HistoriaClinica,
    versionEsperada: number,
  ): Promise<HistoriaClinica> {
    // 1. Extraer _id para no incluirlo en $set (MongoDB no permite mutar _id)
    const { _id, ...docParaActualizar } =
      HistoriaClinicaMongoMapper.toPersistence(historia);

    try {
      // 2. Operación atómica con filtro de concurrencia optimista
      const docActualizado = await this.model
        .findOneAndUpdate(
          { _id: historia.id.valor, version: versionEsperada },
          { $set: docParaActualizar },
          { returnDocument: 'after', runValidators: true },
        )
        .exec();

      if (!docActualizado) {
        // Comprobar si el documento existe o si su versión fue modificada concurrentemente
        const docExistente = await this.model
          .findById(historia.id.valor)
          .select('version')
          .lean()
          .exec();

        if (!docExistente) {
          throw new HistoriaClinicaNoEncontradaError(historia.id.valor);
        }

        const versionActual =
          typeof docExistente.version === 'number'
            ? docExistente.version
            : versionEsperada + 1;

        throw new ConflictoConcurrenteError(versionActual);
      }

      return HistoriaClinicaMongoMapper.toDomain(docActualizado);
    } catch (error: unknown) {
      const err = error as MongoErrorLike;
      if (err.code === 11000) {
        throw new HistoriaClinicaDuplicadaError(historia.pacienteId.valor);
      }
      throw error;
    }
  }
}
