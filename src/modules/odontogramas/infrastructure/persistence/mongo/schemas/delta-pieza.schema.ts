import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { EstadoAnatomicoPieza } from '../../../../domain/value-objects/estado-anatomico-pieza.enum.js';
import { TipoSuperficie } from '../../../../domain/value-objects/tipo-superficie.enum.js';
import { CondicionSuperficie } from '../../../../domain/value-objects/condicion-superficie.enum.js';
import { TipoTratamientoEstructural } from '../../../../domain/value-objects/tipo-tratamiento-estructural.enum.js';

@Schema({ _id: false, timestamps: false, versionKey: false })
export class CambioSuperficieDeltaDocument {
  @Prop({ type: String, enum: Object.values(TipoSuperficie), required: true })
  superficie: TipoSuperficie;

  @Prop({ type: String, enum: Object.values(CondicionSuperficie), required: true })
  condicionAnterior: CondicionSuperficie;

  @Prop({ type: String, enum: Object.values(CondicionSuperficie), required: true })
  condicionNueva: CondicionSuperficie;
}

export const CambioSuperficieDeltaSchema = SchemaFactory.createForClass(CambioSuperficieDeltaDocument);

@Schema({ _id: false, timestamps: false, versionKey: false })
export class DeltaPiezaDocument {
  @Prop({ type: Number, required: true })
  numeroFDI: number;

  @Prop({ type: String, enum: Object.values(EstadoAnatomicoPieza), default: null })
  estadoAnatomicoAnterior?: EstadoAnatomicoPieza;

  @Prop({ type: String, enum: Object.values(EstadoAnatomicoPieza), default: null })
  estadoAnatomicoNuevo?: EstadoAnatomicoPieza;

  @Prop({ type: [CambioSuperficieDeltaSchema], default: [] })
  superficiesModificadas: CambioSuperficieDeltaDocument[];

  @Prop({ type: String, enum: Object.values(TipoTratamientoEstructural), default: null })
  tratamientoEstructuralAgregado?: TipoTratamientoEstructural;

  @Prop({ type: String, default: null })
  observaciones: string | null;
}

export const DeltaPiezaSchema = SchemaFactory.createForClass(DeltaPiezaDocument);
