import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { EstadoConsulta } from '../../../../domain/value-objects/estado-consulta.enum.js';
import {
  SnapshotRiesgoClinicoDocument,
  SnapshotRiesgoClinicoSchema,
} from './snapshot-riesgo-clinico.schema.js';
import {
  AnamnesisActualDocument,
  AnamnesisActualSchema,
} from './anamnesis-actual.schema.js';
import {
  ExploracionFisicaDocument,
  ExploracionFisicaSchema,
} from './exploracion-fisica.schema.js';
import {
  DiagnosticoDocument,
  DiagnosticoSchema,
} from './diagnostico.schema.js';
import {
  ProcedimientoDocument,
  ProcedimientoSchema,
} from './procedimiento.schema.js';
import {
  EvolucionSOAPDocument,
  EvolucionSOAPSchema,
} from './evolucion-soap.schema.js';

@Schema({
  collection: 'consultas_odontologicas',
  timestamps: false,
  versionKey: false,
})
export class ConsultaOdontologicaDocument {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: String, required: true })
  historiaClinicaId: string;

  @Prop({ type: String, required: true })
  pacienteId: string;

  @Prop({ type: String, required: true })
  odontologoId: string;

  @Prop({ type: String, default: null })
  citaId: string | null;

  @Prop({ type: Number, required: true })
  versionHistoriaReferenciada: number;

  @Prop({ type: SnapshotRiesgoClinicoSchema, required: true })
  snapshotRiesgoClinico: SnapshotRiesgoClinicoDocument;

  @Prop({ type: Date, required: true })
  fechaAtencion: Date;

  @Prop({ type: Date, default: null })
  cerradaEn: Date | null;

  @Prop({
    type: String,
    enum: Object.values(EstadoConsulta),
    required: true,
    default: EstadoConsulta.EN_CURSO,
    index: true,
  })
  estado: EstadoConsulta;

  @Prop({ type: String, required: true })
  motivoConsulta: string;

  @Prop({ type: AnamnesisActualSchema, required: true })
  anamnesisActual: AnamnesisActualDocument;

  @Prop({ type: ExploracionFisicaSchema, required: true })
  exploracionFisica: ExploracionFisicaDocument;

  @Prop({ type: [DiagnosticoSchema], default: [] })
  diagnosticos: DiagnosticoDocument[];

  @Prop({ type: [ProcedimientoSchema], default: [] })
  procedimientosRealizados: ProcedimientoDocument[];

  @Prop({ type: EvolucionSOAPSchema, required: true })
  evolucionSOAP: EvolucionSOAPDocument;

  @Prop({ type: String, default: null })
  recomendaciones: string | null;

  @Prop({ type: String, default: null })
  motivoCancelacion: string | null;

  @Prop({ type: Number, required: true, default: 1 })
  version: number;

  @Prop({ type: Date, required: true })
  creadoEn: Date;

  @Prop({ type: Date, required: true })
  actualizadoEn: Date;

  @Prop({ type: String, required: true })
  creadoPor: string;

  @Prop({ type: String, required: true })
  actualizadoPor: string;
}

export const ConsultaOdontologicaSchema = SchemaFactory.createForClass(ConsultaOdontologicaDocument);

// ─── Índices Requeridos ───────────────────────────────────────────────────────

// 1. Historial cronológico por historia clínica con desempate estable por _id
ConsultaOdontologicaSchema.index(
  { historiaClinicaId: 1, fechaAtencion: -1, _id: -1 },
  { name: 'idx_consultas_historia_fecha_id' }
);

// 2. Historial cronológico por paciente con desempate estable por _id
ConsultaOdontologicaSchema.index(
  { pacienteId: 1, fechaAtencion: -1, _id: -1 },
  { name: 'idx_consultas_paciente_fecha_id' }
);

// 3. Índice único parcial estricto para citaId (INV-CONS-07).
// Garantiza que ninguna cita string se duplique en consultas concurrentes
// y permite múltiples consultas espontáneas con citaId: null sin colisión.
ConsultaOdontologicaSchema.index(
  { citaId: 1 },
  {
    unique: true,
    partialFilterExpression: { citaId: { $type: 'string' } },
    name: 'uidx_consultas_cita_parcial',
  }
);
