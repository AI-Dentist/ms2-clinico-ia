import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { TipoDiagnostico } from '../../../../domain/value-objects/tipo-diagnostico.enum.js';

@Schema({ _id: false })
export class DiagnosticoDocument {
  @Prop({ type: String, default: null })
  codigoCIE10: string | null;

  @Prop({ type: String, required: true })
  descripcion: string;

  @Prop({
    type: String,
    enum: Object.values(TipoDiagnostico),
    required: true,
  })
  tipo: TipoDiagnostico;
}

export const DiagnosticoSchema = SchemaFactory.createForClass(DiagnosticoDocument);
