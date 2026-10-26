import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { EstadoAnatomicoPieza } from '../../../../domain/value-objects/estado-anatomico-pieza.enum.js';
import { EstadoEvaluacionPieza } from '../../../../domain/value-objects/estado-evaluacion-pieza.enum.js';
import {
  SuperficieDentalDocument,
  SuperficieDentalSchema,
} from './superficie-dental.schema.js';
import {
  TratamientoEstructuralDocument,
  TratamientoEstructuralSchema,
} from './tratamiento-estructural.schema.js';

@Schema({ _id: false, timestamps: false, versionKey: false })
export class PiezaDentalDocument {
  @Prop({ type: Number, required: true })
  numeroFDI: number;

  @Prop({ type: String, enum: Object.values(EstadoAnatomicoPieza), required: true })
  estadoAnatomico: EstadoAnatomicoPieza;

  @Prop({ type: String, enum: Object.values(EstadoEvaluacionPieza), required: true })
  estadoEvaluacion: EstadoEvaluacionPieza;

  @Prop({ type: Map, of: SuperficieDentalSchema, default: {} })
  superficies: Map<string, SuperficieDentalDocument>;

  @Prop({ type: [TratamientoEstructuralSchema], default: [] })
  tratamientosEstructurales: TratamientoEstructuralDocument[];

  @Prop({ type: String, default: null })
  observaciones: string | null;
}

export const PiezaDentalSchema = SchemaFactory.createForClass(PiezaDentalDocument);
