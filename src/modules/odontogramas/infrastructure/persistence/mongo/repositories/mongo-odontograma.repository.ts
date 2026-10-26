import { Injectable } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { Connection, ClientSession } from 'mongoose';
import type {
  IOdontogramaRepositoryPort,
  ListadoRevisionesResultado,
} from '../../../../domain/ports/odontograma.repository.port.js';
import type { Odontograma } from '../../../../domain/entities/odontograma.entity.js';
import type { RevisionOdontograma } from '../../../../domain/entities/revision-odontograma.entity.js';
import type { OdontogramaId } from '../../../../domain/value-objects/odontograma-id.vo.js';
import type { RevisionId } from '../../../../domain/value-objects/revision-id.vo.js';
import type { HistoriaClinicaId } from '../../../../../historias-clinicas/domain/value-objects/historia-clinica-id.vo.js';
import type { ConsultaId } from '../../../../../consultas-odontologicas/domain/value-objects/consulta-id.vo.js';
import { ConflictoConcurrenteOdontogramaError } from '../../../../domain/errors/conflicto-concurrente-odontograma.error.js';
import { OdontogramaDuplicadoError } from '../../../../domain/errors/odontograma-duplicado.error.js';
import { OdontogramaDocument } from '../schemas/odontograma.schema.js';
import { RevisionOdontogramaDocument } from '../schemas/revision-odontograma.schema.js';
import { OdontogramaMongoMapper } from '../mappers/odontograma-mongo.mapper.js';
import { TransaccionNoSoportadaError } from '../errors/transaccion-no-soportada.error.js';

interface MongoErrorLike {
  code?: number;
  name?: string;
  message?: string;
  keyPattern?: Record<string, unknown>;
}

@Injectable()
export class MongoOdontogramaRepository implements IOdontogramaRepositoryPort {
  constructor(
    @InjectModel(OdontogramaDocument.name)
    private readonly odontogramaModel: Model<OdontogramaDocument>,
    @InjectModel(RevisionOdontogramaDocument.name)
    private readonly revisionModel: Model<RevisionOdontogramaDocument>,
    @InjectConnection()
    private readonly connection: Connection
  ) {}

  /**
   * Guarda atómicamente el odontograma maestro inicial y su revisión basal número 1.
   * Ambas escrituras se confirman en una única transacción ACID. Si cualquiera falla,
   * ninguna debe persistir. Rechaza la operación si el servidor no admite transacciones.
   */
  async guardarInicial(
    odontograma: Odontograma,
    revisionBasal: RevisionOdontograma
  ): Promise<void> {
    await this.validarCapacidadTransaccional();

    const odontogramaDoc = OdontogramaMongoMapper.odontogramaToPersistence(odontograma);
    const revisionDoc = OdontogramaMongoMapper.revisionToPersistence(revisionBasal);

    const session: ClientSession = await this.connection.startSession();

    try {
      await session.withTransaction(async () => {
        try {
          await this.odontogramaModel.create([odontogramaDoc], { session });
        } catch (error: unknown) {
          const err = error as MongoErrorLike;
          if (err.code === 11000) {
            throw new OdontogramaDuplicadoError(odontograma.historiaClinicaId.valor);
          }
          throw error;
        }

        await this.revisionModel.create([revisionDoc], { session });
      });
    } catch (error: unknown) {
      const err = error as MongoErrorLike;
      if (err.code === 20 || (err.message && err.message.includes('Transaction numbers are only allowed on a replica set member'))) {
        throw new TransaccionNoSoportadaError();
      }
      if (err.code === 11000) {
        throw new OdontogramaDuplicadoError(odontograma.historiaClinicaId.valor);
      }
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Aplica una nueva revisión u enmienda histórica de forma estrictamente transaccional.
   * 1. Inserta la nueva revisión sellada en la colección append-only.
   * 2. Actualiza el odontograma maestro con filtro atómico de versión esperada.
   * 3. Si la versión esperada no coincide, aborta la transacción sin dejar revisiones huérfanas.
   */
  async aplicarRevisionTransaccional(
    odontograma: Odontograma,
    nuevaRevision: RevisionOdontograma,
    versionEsperada: number
  ): Promise<void> {
    await this.validarCapacidadTransaccional();

    const odontogramaDoc = OdontogramaMongoMapper.odontogramaToPersistence(odontograma);
    const revisionDoc = OdontogramaMongoMapper.revisionToPersistence(nuevaRevision);

    const session: ClientSession = await this.connection.startSession();

    try {
      await session.withTransaction(async () => {
        // 1. Insertar la revisión histórica
        await this.revisionModel.create([revisionDoc], { session });

        // 2. Actualizar el agregado maestro bajo control de concurrencia optimista
        const updateResult = await this.odontogramaModel.updateOne(
          { _id: odontograma.id.valor, version: versionEsperada },
          {
            $set: {
              piezas: odontogramaDoc.piezas,
              revisionActualId: odontogramaDoc.revisionActualId,
              totalRevisiones: odontogramaDoc.totalRevisiones,
              version: odontogramaDoc.version,
              actualizadoEn: odontogramaDoc.actualizadoEn,
              actualizadoPor: odontogramaDoc.actualizadoPor,
            },
          },
          { session }
        );

        // 3. Si no se modificó ningún documento, hubo colisión concurrente (HTTP 409)
        if (updateResult.matchedCount === 0) {
          throw new ConflictoConcurrenteOdontogramaError(
            odontograma.id.valor,
            versionEsperada
          );
        }
      });
    } catch (error: unknown) {
      const err = error as MongoErrorLike;
      if (err.code === 20 || (err.message && err.message.includes('Transaction numbers are only allowed on a replica set member'))) {
        throw new TransaccionNoSoportadaError();
      }
      if (err.code === 11000) {
        throw new ConflictoConcurrenteOdontogramaError(
          odontograma.id.valor,
          versionEsperada
        );
      }
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async buscarPorId(id: OdontogramaId): Promise<Odontograma | null> {
    const doc = await this.odontogramaModel.findById(id.valor).exec();
    if (!doc) {
      return null;
    }
    return OdontogramaMongoMapper.odontogramaToDomain(doc);
  }

  async buscarPorHistoriaClinicaId(historiaClinicaId: HistoriaClinicaId): Promise<Odontograma | null> {
    const doc = await this.odontogramaModel.findOne({ historiaClinicaId: historiaClinicaId.valor }).exec();
    if (!doc) {
      return null;
    }
    return OdontogramaMongoMapper.odontogramaToDomain(doc);
  }

  async buscarRevisionPorId(revisionId: RevisionId): Promise<RevisionOdontograma | null> {
    const doc = await this.revisionModel.findById(revisionId.valor).exec();
    if (!doc) {
      return null;
    }
    return OdontogramaMongoMapper.revisionToDomain(doc);
  }

  async listarRevisiones(
    odontogramaId: OdontogramaId,
    limite = 20,
    offset = 0
  ): Promise<ListadoRevisionesResultado> {
    const filtro = { odontogramaId: odontogramaId.valor };

    const [docs, total] = await Promise.all([
      this.revisionModel
        .find(filtro)
        .sort({ numeroRevision: -1 })
        .skip(offset)
        .limit(limite)
        .exec(),
      this.revisionModel.countDocuments(filtro).exec(),
    ]);

    return {
      revisiones: docs.map((d) => OdontogramaMongoMapper.revisionToDomain(d)),
      total,
    };
  }

  async listarRevisionesPorConsultaId(consultaId: ConsultaId): Promise<RevisionOdontograma[]> {
    const docs = await this.revisionModel
      .find({ consultaId: consultaId.valor })
      .sort({ fechaObservacionClinica: 1, numeroRevision: 1 })
      .exec();

    return docs.map((d) => OdontogramaMongoMapper.revisionToDomain(d));
  }

  /**
   * Guarda de capacidad transaccional: verifica si el servidor MongoDB conectado
   * admite transacciones multidocumento (Replica Set o Sharded Cluster).
   * Lanza TransaccionNoSoportadaError antes de ejecutar cualquier mutación en Standalone.
   */
  async validarCapacidadTransaccional(): Promise<void> {
    const client = this.connection?.getClient() as any;
    const topology = client?.topology;
    const topologyType = topology?.description?.type;

    if (topologyType === 'Single') {
      const servers = Array.from(topology?.description?.servers?.values() || []) as Array<{ setName?: string }>;
      const tieneReplicaSet = servers.some((s) => Boolean(s.setName));
      if (!tieneReplicaSet) {
        throw new TransaccionNoSoportadaError();
      }
    } else if (
      topologyType &&
      topologyType !== 'ReplicaSetWithPrimary' &&
      topologyType !== 'Sharded'
    ) {
      throw new TransaccionNoSoportadaError();
    }
  }
}
