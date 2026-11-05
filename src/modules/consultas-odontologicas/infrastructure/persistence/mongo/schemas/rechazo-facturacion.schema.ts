import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ _id: false, timestamps: false, versionKey: false })
export class RechazoFacturacionDocument {
  @Prop({ type: String, required: true })
  motivoCodigo: string;

  @Prop({ type: String, required: true })
  motivo: string;

  @Prop({ type: Date, required: true })
  rechazadaEn: Date;
}

export const RechazoFacturacionSchema =
  SchemaFactory.createForClass(RechazoFacturacionDocument);
