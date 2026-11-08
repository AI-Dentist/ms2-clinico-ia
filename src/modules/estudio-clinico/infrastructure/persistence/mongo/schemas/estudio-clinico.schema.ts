import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ _id: false })
class BoundingBoxSchema {
  @Prop({ required: true }) x: number;
  @Prop({ required: true }) y: number;
  @Prop({ required: true }) width: number;
  @Prop({ required: true }) height: number;
}

@Schema({ _id: false })
class HallazgoIaSchema {
  @Prop({ required: true }) etiqueta: string;
  @Prop({ required: true }) probabilidad: number;
  @Prop({ required: true }) severidad: string;
  @Prop({ required: true }) zonaSugerida: string;
  @Prop({ required: true, type: BoundingBoxSchema }) boundingBox: BoundingBoxSchema;
  @Prop({ required: true }) recomendacionClinica: string;
}
const HallazgoIaSubSchema = SchemaFactory.createForClass(HallazgoIaSchema);

@Schema({ _id: false })
class AnalisisIaSchema {
  @Prop({ required: true }) modeloNombre: string;
  @Prop({ required: true }) version: string;
  @Prop({ required: true }) fechaInferencia: Date;
  @Prop({ required: true }) confianzaGlobal: number;
  @Prop({ required: true }) severidadMaxima: string;
  @Prop({ required: true, type: [HallazgoIaSubSchema] }) hallazgos: HallazgoIaSchema[];
  @Prop({ type: String, default: null }) observacionMedico: string | null;
}
const AnalisisIaSubSchema = SchemaFactory.createForClass(AnalisisIaSchema);

@Schema({ collection: 'estudios_clinicos', timestamps: { createdAt: 'creadoEn', updatedAt: false } })
export class EstudioClinicoMongo extends Document {
  @Prop({ required: true, index: true }) pacienteId: string;
  @Prop({ required: true }) consultaId: string;
  /**
   * Extracted from the authenticated JWT — never accepted from request body.
   */
  @Prop({ required: true, index: true }) odontologoId: string;
  @Prop({ required: true, type: AnalisisIaSubSchema }) analisisIa: AnalisisIaSchema;

  // Image metadata
  @Prop({ type: String, default: null }) imagenMimeType: string | null;
  @Prop({ type: String, default: null }) imagenNombreArchivo: string | null;
  /**
   * Base64-encoded image for inputs up to 25 MB.
   * Excluded from list queries (GET /estudios/paciente/:id) via projection.
   * Decision: exclude rather than paginate — medical images are needed only on
   * single-record fetch, not in historical lists.
   */
  @Prop({ type: String, default: null, select: false }) imagenBase64: string | null;

  creadoEn: Date;
}

export const EstudioClinicoSchema = SchemaFactory.createForClass(EstudioClinicoMongo);
