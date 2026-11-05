import type { ClientSession } from 'mongoose';

export const INBOX_REPOSITORY_PORT = Symbol('INBOX_REPOSITORY_PORT');

export interface InboxEventItem {
  eventId: string;
  tipoEvento: string;
  procesadoEn: Date;
}

export interface IInboxRepositoryPort {
  existe(eventId: string, session?: ClientSession): Promise<boolean>;
  guardar(inboxEvent: InboxEventItem, session?: ClientSession): Promise<void>;
}
