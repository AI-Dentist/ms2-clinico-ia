import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type {
  IConsultaOdontologicaRepositoryPort,
  ListadoConsultasResultado,
} from '../../../../domain/ports/consulta-odontologica.repository.port.js';
import type { ConsultaOdontologica } from '../../../../domain/entities/consulta-odontologica.entity.js';
import type { ConsultaId } from '../../../../domain/value-objects/consulta-id.vo.js';
import type { HistoriaClinicaId } from '../../../../domain/value-objects/historia-clinica-id.vo.js';
import type { PacienteId } from '../../../../domain/value-objects/paciente-id.vo.js';
import type { CitaId } from '../../../../domain/value-objects/cita-id.vo.js';
import { ConsultaNoEncontradaError } from '../../../../domain/errors/consulta-no-encontrada.error.js';
import { ConflictoConcurrenteConsultaError } from '../../../../domain/errors/conflicto-concurrente-consulta.error.js';
import { CitaInvalidaParaConsultaError } from '../../../../domain/errors/cita-invalida-para-consulta.error.js';
import { ConsultaOdontologicaDocument } from '../schemas/consulta-odontologica.schema.js';
import { ConsultaOdontologicaMongoMapper } from '../mappers/consulta-odontologica-mongo.mapper.js';

interface MongoErrorLike {
  code?: number;
  name?: string;
  message?: string;
  keyPattern?: Record<string, unknown>;
}

@Injectable()
export class MongoConsultaOdontologicaRepository implements IConsultaOdontologicaRepositoryPort {
  constructor(
    @InjectModel(ConsultaOdontologicaDocument.name)
    private readonly model: Model<ConsultaOdontologicaDocument>
  ) {}

  async guardar(consulta: ConsultaOdontologica): Promise<void> {
    const doc = ConsultaOdontologicaMongoMapper.toPersistence(consulta);

    try {
      await this.model.create(doc);
    } catch (error: unknown) {
      const err = error as MongoErrorLike;
      if (err.code === 11000) {
        if (err.keyPattern && 'citaId' in err.keyPattern) {
          throw new CitaInvalidaParaConsultaError(
            consulta.citaId ? consulta.citaId.valor : '',
            'La cita ya se encuentra asociada a otra consulta odontológica activa (índice único parcial).'
          );
        }
      }
      throw error;
    }
  }

  async buscarPorId(id: ConsultaId): Promise<ConsultaOdontologica | null> {
    const doc = await this.model.findById(id.valor).exec();
    if (!doc) {
      return null;
    }
    return ConsultaOdontologicaMongoMapper.toDomain(doc);
  }

  async buscarPorCitaId(citaId: CitaId): Promise<ConsultaOdontologica | null> {
    const doc = await this.model.findOne({ citaId: citaId.valor }).exec();
    if (!doc) {
      return null;
    }
    return ConsultaOdontologicaMongoMapper.toDomain(doc);
  }

  async listarPorHistoriaClinica(
    historiaClinicaId: HistoriaClinicaId,
    limite = 20,
    offset = 0
  ): Promise<ListadoConsultasResultado> {
    const filtro = { historiaClinicaId: historiaClinicaId.valor };

    const [docs, total] = await Promise.all([
      this.model
        .find(filtro)
        .sort({ fechaAtencion: -1, _id: -1 })
        .skip(offset)
        .limit(limite)
        .exec(),
      this.model.countDocuments(filtro).exec(),
    ]);

    return {
      consultas: docs.map((d) => ConsultaOdontologicaMongoMapper.toDomain(d)),
      total,
    };
  }

  async listarPorPacienteId(
    pacienteId: PacienteId,
    limite = 20,
    offset = 0
  ): Promise<ListadoConsultasResultado> {
    const filtro = { pacienteId: pacienteId.valor };

    const [docs, total] = await Promise.all([
      this.model
        .find(filtro)
        .sort({ fechaAtencion: -1, _id: -1 })
        .skip(offset)
        .limit(limite)
        .exec(),
      this.model.countDocuments(filtro).exec(),
    ]);

    return {
      consultas: docs.map((d) => ConsultaOdontologicaMongoMapper.toDomain(d)),
      total,
    };
  }

  async actualizar(consulta: ConsultaOdontologica, versionEsperada: number): Promise<void> {
    // 1. Extraer _id para no mutarlo en $set
    const { _id, ...docParaActualizar } = ConsultaOdontologicaMongoMapper.toPersistence(consulta);

    try {
      // 2. Actualización atómica con concurrencia optimista
      const docActualizado = await this.model
        .findOneAndUpdate(
          { _id: consulta.id.valor, version: versionEsperada },
          { $set: docParaActualizar },
          { returnDocument: 'after', runValidators: true }
        )
        .exec();

      if (!docActualizado) {
        // Distinguir entre consulta inexistente y conflicto de concurrencia
        const docExistente = await this.model
          .findById(consulta.id.valor)
          .select('version')
          .lean()
          .exec();

        if (!docExistente) {
          throw new ConsultaNoEncontradaError(consulta.id.valor);
        }

        throw new ConflictoConcurrenteConsultaError(consulta.id.valor, versionEsperada);
      }
    } catch (error: unknown) {
      const err = error as MongoErrorLike;
      if (err.code === 11000) {
        if (err.keyPattern && 'citaId' in err.keyPattern) {
          throw new CitaInvalidaParaConsultaError(
            consulta.citaId ? consulta.citaId.valor : '',
            'La cita ya se encuentra asociada a otra consulta odontológica activa.'
          );
        }
      }
      throw error;
    }
  }
}
