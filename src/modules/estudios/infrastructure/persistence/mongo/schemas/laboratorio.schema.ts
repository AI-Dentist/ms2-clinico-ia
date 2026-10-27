import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';
import { EstadoCatalogo } from '../../../../domain/enums/estado-catalogo.enum.js';

export type LaboratorioDocument = HydratedDocument<LaboratorioMongo>;

@Schema({ collection: 'laboratorios', timestamps: false, versionKey: false })
export class LaboratorioMongo {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: String, required: true, unique: true, index: true, trim: true })
  nombre: string;

  @Prop({ type: String, default: '', trim: true })
  descripcion: string;

  @Prop({ type: String, default: null, trim: true })
  contacto: string | null;

  @Prop({ type: String, enum: Object.values(EstadoCatalogo), default: EstadoCatalogo.ACTIVO, index: true })
  estado: EstadoCatalogo;

  @Prop({ type: Date, required: true, default: Date.now })
  creadoEn: Date;

  @Prop({ type: Date, required: true, default: Date.now })
  actualizadoEn: Date;
}

export const LaboratorioSchema = SchemaFactory.createForClass(LaboratorioMongo);
LaboratorioSchema.index({ nombre: 1 }, { unique: true });
