import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';
import { CategoriaEstudio } from '../../../../domain/enums/categoria-estudio.enum.js';
import { EstadoCatalogo } from '../../../../domain/enums/estado-catalogo.enum.js';

export type TipoEstudioDocument = HydratedDocument<TipoEstudioMongo>;

@Schema({ collection: 'tipos_estudios', timestamps: false, versionKey: false })
export class TipoEstudioMongo {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: String, required: true, unique: true, index: true, uppercase: true, trim: true })
  codigo: string;

  @Prop({ type: String, required: true, unique: true, index: true, trim: true })
  nombre: string;

  @Prop({ type: String, enum: Object.values(CategoriaEstudio), required: true, index: true })
  categoria: CategoriaEstudio;

  @Prop({ type: String, default: '', trim: true })
  descripcion: string;

  @Prop({ type: String, enum: Object.values(EstadoCatalogo), default: EstadoCatalogo.ACTIVO, index: true })
  estado: EstadoCatalogo;

  @Prop({ type: Date, required: true, default: Date.now })
  creadoEn: Date;

  @Prop({ type: Date, required: true, default: Date.now })
  actualizadoEn: Date;
}

export const TipoEstudioSchema = SchemaFactory.createForClass(TipoEstudioMongo);
TipoEstudioSchema.index({ codigo: 1 }, { unique: true });
TipoEstudioSchema.index({ nombre: 1 }, { unique: true });
