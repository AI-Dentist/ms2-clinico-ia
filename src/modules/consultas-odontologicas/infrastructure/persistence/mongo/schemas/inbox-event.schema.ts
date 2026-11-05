import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

export type InboxEventDocument = HydratedDocument<InboxEvent>;

@Schema({ collection: 'inbox_events', timestamps: false, versionKey: false })
export class InboxEvent {
  @Prop({ type: String, required: true, unique: true, index: true })
  eventId: string;

  @Prop({ type: String, required: true })
  tipoEvento: string;

  @Prop({ type: Date, required: true, default: () => new Date() })
  procesadoEn: Date;
}

export const InboxEventSchema = SchemaFactory.createForClass(InboxEvent);

// Índice único sobre eventId para garantizar idempotencia a nivel de base de datos
InboxEventSchema.index({ eventId: 1 }, { unique: true, name: 'idx_inbox_event_id_unique' });
