import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ _id: false })
export class MedicamentoDocument {
  @Prop({ type: String, required: true })
  nombre: string;

  @Prop({ type: String, default: null })
  principioActivo: string | null;

  @Prop({ type: String, required: true })
  dosis: string;

  @Prop({ type: String, default: null })
  motivoUso: string | null;

  @Prop({ type: Date, default: null })
  prescritoDesde: Date | null;
}

export const MedicamentoSchema = SchemaFactory.createForClass(MedicamentoDocument);
