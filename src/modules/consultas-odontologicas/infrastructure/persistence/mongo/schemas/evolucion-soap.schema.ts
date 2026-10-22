import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ _id: false })
export class EvolucionSOAPDocument {
  @Prop({ type: String, default: null })
  subjetivo: string | null;

  @Prop({ type: String, default: null })
  objetivo: string | null;

  @Prop({ type: String, default: null })
  analisis: string | null;

  @Prop({ type: String, default: null })
  plan: string | null;
}

export const EvolucionSOAPSchema = SchemaFactory.createForClass(EvolucionSOAPDocument);
