import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { EstadoEpistemico } from '../../../../domain/value-objects/campo-clinico.vo.js';

@Schema({ _id: false })
export class CampoClinicoDocument {
  @Prop({ type: String, default: null })
  nombre: string | null;

  @Prop({
    type: String,
    enum: ['NO_EVALUADO', 'NEGADO', 'CONFIRMADO'],
    required: true,
  })
  estado: EstadoEpistemico;

  @Prop({ type: String, default: null })
  detalle: string | null;

  @Prop({ type: Date, default: null })
  registradoEn: Date | null;
}

export const CampoClinicoSchema = SchemaFactory.createForClass(CampoClinicoDocument);
