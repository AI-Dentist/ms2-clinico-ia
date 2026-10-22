import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { EstadoHistoria } from '../../../../domain/value-objects/estado-historia.enum.js';
import {
  AntecedentesDocument,
  AntecedentesSchema,
} from './antecedentes.schema.js';
import { AlergiaDocument, AlergiaSchema } from './alergia.schema.js';
import {
  MedicamentoDocument,
  MedicamentoSchema,
} from './medicamento.schema.js';
import {
  EntradaAuditoriaDocument,
  EntradaAuditoriaSchema,
} from './entrada-auditoria.schema.js';

@Schema({
  collection: 'historias_clinicas',
  timestamps: false,
  versionKey: false,
})
export class HistoriaClinicaDocument {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: String, required: true, unique: true, index: true })
  pacienteId: string;

  @Prop({ type: String, required: true })
  odontologoResponsableId: string;

  @Prop({
    type: String,
    enum: Object.values(EstadoHistoria),
    required: true,
    default: EstadoHistoria.ACTIVA,
    index: true,
  })
  estado: EstadoHistoria;

  @Prop({ type: AntecedentesSchema, required: true })
  antecedentes: AntecedentesDocument;

  @Prop({ type: [AlergiaSchema], default: [] })
  alergias: AlergiaDocument[];

  @Prop({ type: [MedicamentoSchema], default: [] })
  medicamentosActuales: MedicamentoDocument[];

  @Prop({ type: String, default: null })
  observacionesGenerales: string | null;

  @Prop({ type: Number, required: true, default: 1 })
  version: number;

  @Prop({ type: Date, required: true })
  creadoEn: Date;

  @Prop({ type: Date, required: true })
  actualizadoEn: Date;

  @Prop({ type: [EntradaAuditoriaSchema], default: [] })
  historialCambios: EntradaAuditoriaDocument[];
}

export const HistoriaClinicaSchema =
  SchemaFactory.createForClass(HistoriaClinicaDocument);
