import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ _id: false })
export class AnamnesisActualDocument {
  @Prop({ type: String, default: '' })
  descripcion: string;

  @Prop({ type: String, default: null })
  tiempoEvolucion: string | null;

  @Prop({ type: Number, default: null })
  escalaDolorEVA: number | null;
}

export const AnamnesisActualSchema = SchemaFactory.createForClass(AnamnesisActualDocument);
