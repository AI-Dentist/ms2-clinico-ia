import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import type { Model, ClientSession, Connection } from 'mongoose';
import type {
  IInboxRepositoryPort,
  InboxEventItem,
} from '../../../../application/ports/inbox-repository.port.js';
import { InboxEvent, InboxEventSchema, type InboxEventDocument } from '../schemas/inbox-event.schema.js';

@Injectable()
export class MongoInboxRepository implements IInboxRepositoryPort {
  private readonly model: Model<InboxEventDocument>;

  constructor(@InjectConnection() connection: Connection) {
    if (typeof connection?.model === 'function') {
      this.model =
        connection.models?.[InboxEvent.name] ??
        connection.model<InboxEventDocument>(InboxEvent.name, InboxEventSchema);
    } else {
      this.model = (connection?.models?.[InboxEvent.name] ?? {}) as Model<InboxEventDocument>;
    }
  }

  async existe(eventId: string, session?: ClientSession): Promise<boolean> {
    if (!this.model?.findOne) {
      return false;
    }

    const doc = await this.model
      .findOne({ eventId })
      .session(session ?? null)
      .lean();

    return doc !== null && doc !== undefined;
  }

  async guardar(inboxEvent: InboxEventItem, session?: ClientSession): Promise<void> {
    if (!this.model?.create) {
      return;
    }

    await this.model.create(
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
