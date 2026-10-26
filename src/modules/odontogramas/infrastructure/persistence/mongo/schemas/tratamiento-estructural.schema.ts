import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { TipoTratamientoEstructural } from '../../../../domain/value-objects/tipo-tratamiento-estructural.enum.js';

@Schema({ _id: false, timestamps: false, versionKey: false })
export class TratamientoEstructuralDocument {
  @Prop({ type: String, enum: Object.values(TipoTratamientoEstructural), required: true })
  tipo: TipoTratamientoEstructural;

  @Prop({ type: String, default: null })
  consultaId: string | null;

  @Prop({ type: Date, required: true })
  fechaRegistro: Date;
}

export const TratamientoEstructuralSchema = SchemaFactory.createForClass(TratamientoEstructuralDocument);
