import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { TipoRevisionOdontograma } from '../../../../domain/value-objects/tipo-revision-odontograma.enum.js';
import {
  PiezaDentalDocument,
  PiezaDentalSchema,
} from './pieza-dental.schema.js';
import {
  DeltaPiezaDocument,
  DeltaPiezaSchema,
} from './delta-pieza.schema.js';

@Schema({
  collection: 'odontograma_revisiones',
  timestamps: false,
  versionKey: false,
  autoIndex: false,
  autoCreate: false,
})
export class RevisionOdontogramaDocument {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: String, required: true })
  odontogramaId: string;

  @Prop({ type: String, required: true })
  historiaClinicaId: string;

  @Prop({ type: String, default: null })
  consultaId: string | null;

  @Prop({ type: Number, required: true })
  numeroRevision: number;

  @Prop({ type: String, enum: Object.values(TipoRevisionOdontograma), required: true })
  tipoRevision: TipoRevisionOdontograma;

  @Prop({ type: String, default: null })
  revisionCorregidaId: string | null;

  @Prop({ type: Boolean, required: true, default: true })
  aplicaAlEstadoActual: boolean;

  @Prop({ type: Date, required: true })
  fechaRegistro: Date;

  @Prop({ type: Date, required: true })
  fechaObservacionClinica: Date;

  @Prop({ type: String, required: true })
  registradoPor: string;

  @Prop({ type: String, required: true })
  motivoRevision: string;

  @Prop({ type: [DeltaPiezaSchema], default: [] })
  cambiosAplicados: DeltaPiezaDocument[];

  @Prop({ type: [PiezaDentalSchema], required: true, default: [] })
  snapshotPiezas: PiezaDentalDocument[];
}

export const RevisionOdontogramaSchema = SchemaFactory.createForClass(RevisionOdontogramaDocument);

// ─── Índices Requeridos ───────────────────────────────────────────────────────

// 1. Índice único compuesto para garantizar unicidad y secuencia ascendente de revisiones por odontograma
RevisionOdontogramaSchema.index(
  { odontogramaId: 1, numeroRevision: 1 },
  { unique: true, name: 'uidx_revisiones_odontograma_numero' }
);

// 2. Consulta y agrupación de revisiones por Consulta Odontológica (permite múltiples revisiones por consulta)
RevisionOdontogramaSchema.index(
  { consultaId: 1, fechaObservacionClinica: 1 },
  { name: 'idx_revisiones_consulta_fecha' }
);

// 3. Índice para el historial cronológico descendente paginado del odontograma
RevisionOdontogramaSchema.index(
  { odontogramaId: 1, numeroRevision: -1 },
  { name: 'idx_revisiones_historial_desc' }
);
