import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ _id: false })
export class ProcedimientoDocument {
  @Prop({ type: String, default: null })
  codigo: string | null;

  @Prop({ type: String, required: true })
  descripcion: string;

  @Prop({ type: Number, default: null })
  piezaDental: number | null;

  @Prop({ type: String, default: null })
  observaciones: string | null;
}

export const ProcedimientoSchema = SchemaFactory.createForClass(ProcedimientoDocument);
