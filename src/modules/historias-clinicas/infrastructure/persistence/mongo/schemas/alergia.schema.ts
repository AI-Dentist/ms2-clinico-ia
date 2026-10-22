import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SeveridadAlergia } from '../../../../domain/value-objects/severidad-alergia.enum.js';

@Schema({ _id: false })
export class AlergiaDocument {
  @Prop({ type: String, required: true })
  sustancia: string;

  @Prop({ type: String, required: true })
  tipoReaccion: string;

  @Prop({
    type: String,
    enum: Object.values(SeveridadAlergia),
    required: true,
  })
  severidad: SeveridadAlergia;

  @Prop({ type: String, default: null })
  notasAdicionales: string | null;

  @Prop({ type: Date, required: true })
  registradaEn: Date;
}

export const AlergiaSchema = SchemaFactory.createForClass(AlergiaDocument);
