import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model, ClientSession } from 'mongoose';
import type {
  IInboxRepositoryPort,
  InboxEventItem,
} from '../../../application/ports/inbox-repository.port.js';
import { InboxEvent, type InboxEventDocument } from '../schemas/inbox-event.schema.js';

@Injectable()
export class MongoInboxRepository implements IInboxRepositoryPort {
  constructor(
    @InjectModel(InboxEvent.name)
    private readonly inboxModel: Model<InboxEventDocument>,
  ) {}

  async existe(eventId: string, session?: ClientSession): Promise<boolean> {
    const doc = await this.inboxModel
      .findOne({ eventId })
      .session(session ?? null)
      .lean();

    return doc !== null && doc !== undefined;
  }

  async guardar(inboxEvent: InboxEventItem, session?: ClientSession): Promise<void> {
    await this.inboxModel.create(
      [
        {
          eventId: inboxEvent.eventId,
          tipoEvento: inboxEvent.tipoEvento,
          procesadoEn: inboxEvent.procesadoEn,
        },
      ],
      { session: session ?? undefined },
    );
  }
}
