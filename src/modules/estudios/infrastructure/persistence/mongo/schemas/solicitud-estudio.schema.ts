import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';
import { EstadoSolicitudEstudio } from '../../../../domain/enums/estado-solicitud-estudio.enum.js';
import { PrioridadEstudio } from '../../../../domain/enums/prioridad-estudio.enum.js';

export type SolicitudEstudioDocument = HydratedDocument<SolicitudEstudioMongo>;

@Schema({ _id: false, versionKey: false })
export class ValorReferenciaMongo {
  @Prop({ type: String, required: true })
  parametro: string;

  @Prop({ type: String, required: true })
  valor: string;

  @Prop({ type: String, default: null })
  unidad: string | null;

  @Prop({ type: String, default: null })
  estado: string | null;
}

export const ValorReferenciaSchema = SchemaFactory.createForClass(ValorReferenciaMongo);

@Schema({ _id: false, versionKey: false })
export class ResultadoEstudioMongo {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: String, default: null, index: true })
  laboratorioId: string | null;

  @Prop({ type: Date, required: true })
  fechaResultado: Date;

  @Prop({ type: String, required: true })
  registradoPor: string;

  @Prop({ type: String, required: true, trim: true })
  resumen: string;

  @Prop({ type: String, default: null })
  observaciones: string | null;

  @Prop({ type: [ValorReferenciaSchema], default: [] })
  valoresReferencia: ValorReferenciaMongo[];

  @Prop({ type: Date, required: true, default: Date.now })
  registradoEn: Date;
}

export const ResultadoEstudioSchema = SchemaFactory.createForClass(ResultadoEstudioMongo);

@Schema({ collection: 'solicitudes_estudios', timestamps: false, versionKey: false })
export class SolicitudEstudioMongo {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: String, required: true, index: true })
  historiaClinicaId: string;

  @Prop({ type: String, required: true, index: true })
  consultaId: string;

  @Prop({ type: String, required: true, index: true })
  pacienteId: string;

  @Prop({ type: String, required: true })
  odontologoId: string;

  @Prop({ type: String, required: true, index: true })
  tipoEstudioId: string;

  @Prop({ type: String, required: true, trim: true })
  motivo: string;

  @Prop({ type: String, default: null })
  indicaciones: string | null;

  @Prop({ type: String, enum: Object.values(PrioridadEstudio), default: PrioridadEstudio.RUTINA })
  prioridad: PrioridadEstudio;

  @Prop({ type: String, enum: Object.values(EstadoSolicitudEstudio), default: EstadoSolicitudEstudio.SOLICITADO, index: true })
  estado: EstadoSolicitudEstudio;

  @Prop({ type: Date, required: true, default: Date.now })
  fechaSolicitud: Date;

  @Prop({ type: String, default: null })
  motivoCancelacion: string | null;

  @Prop({ type: ResultadoEstudioSchema, default: null })
  resultado: ResultadoEstudioMongo | null;

  @Prop({ type: Date, required: true, default: Date.now })
  creadoEn: Date;

  @Prop({ type: Date, required: true, default: Date.now })
  actualizadoEn: Date;
}

export const SolicitudEstudioSchema = SchemaFactory.createForClass(SolicitudEstudioMongo);
SolicitudEstudioSchema.index({ historiaClinicaId: 1, creadoEn: -1 });
SolicitudEstudioSchema.index({ consultaId: 1 });
