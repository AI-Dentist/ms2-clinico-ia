import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { TipoSuperficie } from '../../../../domain/value-objects/tipo-superficie.enum.js';
import { CondicionSuperficie } from '../../../../domain/value-objects/condicion-superficie.enum.js';

@Schema({ _id: false, timestamps: false, versionKey: false })
export class SuperficieDentalDocument {
  @Prop({ type: String, enum: Object.values(TipoSuperficie), required: true })
  superficie: TipoSuperficie;

  @Prop({ type: String, enum: Object.values(CondicionSuperficie), required: true })
  condicion: CondicionSuperficie;

  @Prop({ type: Boolean, required: true, default: false })
  evaluada: boolean;
}

export const SuperficieDentalSchema = SchemaFactory.createForClass(SuperficieDentalDocument);
