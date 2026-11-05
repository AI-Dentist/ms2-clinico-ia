import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, type ClientSession } from 'mongoose';
import type {
  IOutboxRepositoryPort,
  OutboxStatusDto,
} from '../../../../domain/ports/outbox-repository.port.js';
import { OutboxEvent } from '../../../../domain/entities/outbox-event.entity.js';
import { OutboxEventDocument } from '../schemas/outbox-event.schema.js';

@Injectable()
export class MongoOutboxRepository implements IOutboxRepositoryPort {
  constructor(
    @InjectModel(OutboxEventDocument.name)
    private readonly model: Model<OutboxEventDocument>,
  ) {}

  async guardar(evento: OutboxEvent, session?: ClientSession): Promise<void> {
    const doc = this.toPersistence(evento);
    if (session) {
      await this.model.create([doc], { session });
    } else {
      await this.model.create(doc);
    }
  }

  async buscarPorId(id: string): Promise<OutboxEvent | null> {
    const doc = await this.model.findById(id).exec();
    if (!doc) return null;
    return this.toDomain(doc);
  }

  async buscarPorEventId(eventId: string): Promise<OutboxEvent | null> {
    const doc = await this.model.findOne({ eventId }).exec();
    if (!doc) return null;
    return this.toDomain(doc);
  }

  async reclamarLote(
    limite: number,
    leaseDurationMs: number,
    workerId: string,
    ahora: Date = new Date(),
  ): Promise<OutboxEvent[]> {
    const eventos: OutboxEvent[] = [];
    const expiracionLease = new Date(ahora.getTime() + leaseDurationMs);

    for (let i = 0; i < limite; i++) {
      const doc = await this.model
        .findOneAndUpdate(
          {
            status: { $in: ['PENDIENTE', 'EN_PROCESO'] },
            nextRetryAt: { $lte: ahora },
            $or: [
              { lockedUntil: null },
              { lockedUntil: { $lte: ahora } },
            ],
          },
          {
            $set: {
              status: 'EN_PROCESO',
              workerId,
              lockedUntil: expiracionLease,
              actualizadoEn: ahora,
            },
          },
          { returnDocument: 'after' },
        )
        .exec();

      if (!doc) {
        break; // No hay más eventos elegibles en este ciclo
      }
      eventos.push(this.toDomain(doc));
    }

    return eventos;
  }

  async actualizar(evento: OutboxEvent): Promise<void> {
    const doc = this.toPersistence(evento);
    await this.model
      .findByIdAndUpdate(
        evento.id,
        {
          $set: {
            status: doc.status,
            attempts: doc.attempts,
            nextRetryAt: doc.nextRetryAt,
            lockedUntil: doc.lockedUntil,
            workerId: doc.workerId,
            publishedAt: doc.publishedAt,
            lastError: doc.lastError,
            actualizadoEn: doc.actualizadoEn,
          },
        },
        { runValidators: true },
      )
      .exec();
  }

  async liberarLeasesVencidos(ahora: Date = new Date()): Promise<number> {
    const resultado = await this.model
      .updateMany(
        {
          status: 'EN_PROCESO',
          lockedUntil: { $lte: ahora },
        },
        {
          $set: {
            status: 'PENDIENTE',
            lockedUntil: null,
            workerId: null,
            actualizadoEn: ahora,
          },
        },
      )
      .exec();

    return resultado.modifiedCount;
  }

  async obtenerEstado(): Promise<OutboxStatusDto> {
    const [pendientes, enProceso, publicados, fatales, eventosFatalesDocs] = await Promise.all([
      this.model.countDocuments({ status: 'PENDIENTE' }).exec(),
      this.model.countDocuments({ status: 'EN_PROCESO' }).exec(),
      this.model.countDocuments({ status: 'PUBLICADO' }).exec(),
      this.model.countDocuments({ status: 'ERROR_FATAL' }).exec(),
      this.model
        .find({ status: 'ERROR_FATAL' })
        .sort({ actualizadoEn: -1 })
        .limit(20)
        .lean()
        .exec(),
    ]);

    return {
      pendientes,
      enProceso,
      publicados,
      fatales,
      eventosFatales: eventosFatalesDocs.map((doc) => ({
        id: doc._id,
        aggregateId: doc.aggregateId,
        attempts: doc.attempts,
        maxAttempts: doc.maxAttempts,
        lastError: doc.lastError,
        actualizadoEn: doc.actualizadoEn,
      })),
    };
  }

  private toPersistence(evento: OutboxEvent): OutboxEventDocument {
    return {
      _id: evento.id,
      eventId: evento.eventId,
      aggregateId: evento.aggregateId,
      aggregateType: evento.aggregateType,
      eventType: evento.eventType,
      exchange: evento.exchange,
      routingKey: evento.routingKey,
      payload: { ...evento.payload },
      status: evento.status,
      attempts: evento.attempts,
      maxAttempts: evento.maxAttempts,
      nextRetryAt: evento.nextRetryAt,
      lockedUntil: evento.lockedUntil,
      workerId: evento.workerId,
      publishedAt: evento.publishedAt,
      lastError: evento.lastError,
      creadoEn: evento.creadoEn,
      actualizadoEn: evento.actualizadoEn,
    };
  }

  private toDomain(doc: OutboxEventDocument): OutboxEvent {
    return OutboxEvent.reconstituir({
      id: doc._id,
      eventId: doc.eventId,
      aggregateId: doc.aggregateId,
      aggregateType: doc.aggregateType,
      eventType: doc.eventType,
      exchange: doc.exchange,
      routingKey: doc.routingKey,
      payload: doc.payload ?? {},
      status: doc.status,
      attempts: doc.attempts,
      maxAttempts: doc.maxAttempts,
      nextRetryAt: doc.nextRetryAt,
      lockedUntil: doc.lockedUntil ?? null,
      workerId: doc.workerId ?? null,
      publishedAt: doc.publishedAt ?? null,
      lastError: doc.lastError ?? null,
      creadoEn: doc.creadoEn,
      actualizadoEn: doc.actualizadoEn,
    });
  }
}
