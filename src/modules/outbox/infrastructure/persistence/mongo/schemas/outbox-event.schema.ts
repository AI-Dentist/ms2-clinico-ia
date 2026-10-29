import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({
  collection: 'outbox_events',
  timestamps: false,
  versionKey: false,
})
export class OutboxEventDocument {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: String, required: true, unique: true, index: true })
  eventId: string;

  @Prop({ type: String, required: true, index: true })
  aggregateId: string;

  @Prop({ type: String, required: true })
  aggregateType: string;

  @Prop({ type: String, required: true })
  eventType: string;

  @Prop({ type: String, required: true })
  exchange: string;

  @Prop({ type: String, required: true })
  routingKey: string;

  @Prop({ type: Object, required: true })
  payload: Record<string, unknown>;

  @Prop({
    type: String,
    enum: ['PENDIENTE', 'EN_PROCESO', 'PUBLICADO', 'ERROR_FATAL'],
    required: true,
    default: 'PENDIENTE',
    index: true,
  })
  status: 'PENDIENTE' | 'EN_PROCESO' | 'PUBLICADO' | 'ERROR_FATAL';

  @Prop({ type: Number, required: true, default: 0 })
  attempts: number;

  @Prop({ type: Number, required: true, default: 5 })
  maxAttempts: number;

  @Prop({ type: Date, required: true, index: true })
  nextRetryAt: Date;

  @Prop({ type: Date, default: null, index: true })
  lockedUntil: Date | null;

  @Prop({ type: String, default: null })
  workerId: string | null;

  @Prop({ type: Date, default: null })
  publishedAt: Date | null;

  @Prop({ type: String, default: null })
  lastError: string | null;

  @Prop({ type: Date, required: true })
  creadoEn: Date;

  @Prop({ type: Date, required: true })
  actualizadoEn: Date;
}

export const OutboxEventSchema = SchemaFactory.createForClass(OutboxEventDocument);

// Índice compuesto para sondeo de lotes elegibles y control de leases
OutboxEventSchema.index({ status: 1, nextRetryAt: 1, lockedUntil: 1 });

// Índice para auditoría e idempotencia por agregado
OutboxEventSchema.index({ aggregateId: 1, eventType: 1 });

