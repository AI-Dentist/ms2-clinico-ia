import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  PiezaDentalDocument,
  PiezaDentalSchema,
} from './pieza-dental.schema.js';

@Schema({
  collection: 'odontogramas',
  timestamps: false,
  versionKey: false,
  autoIndex: false,
  autoCreate: false,
})
export class OdontogramaDocument {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: String, required: true })
  historiaClinicaId: string;

  @Prop({ type: String, required: true })
  pacienteId: string;

  @Prop({ type: [PiezaDentalSchema], required: true, default: [] })
  piezas: PiezaDentalDocument[];

  @Prop({ type: String, required: true })
  revisionActualId: string;

  @Prop({ type: Number, required: true, default: 1 })
  totalRevisiones: number;

  @Prop({ type: Number, required: true, default: 1 })
  version: number;

  @Prop({ type: Date, required: true })
  creadoEn: Date;

  @Prop({ type: Date, required: true })
  actualizadoEn: Date;

  @Prop({ type: String, required: true })
  actualizadoPor: string;
}

export const OdontogramaSchema = SchemaFactory.createForClass(OdontogramaDocument);

// ─── Índices Requeridos ───────────────────────────────────────────────────────

// 1. Relación 1:1 estricta con Historia Clínica (INV-ODO-01)
OdontogramaSchema.index(
  { historiaClinicaId: 1 },
  { unique: true, name: 'uidx_odontogramas_historia_clinica' }
);

// 2. Consulta y validación por paciente
OdontogramaSchema.index(
  { pacienteId: 1 },
  { name: 'idx_odontogramas_paciente' }
);
