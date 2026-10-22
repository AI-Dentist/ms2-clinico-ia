import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  CampoClinicoDocument,
  CampoClinicoSchema,
} from './campo-clinico.schema.js';

@Schema({ _id: false })
export class AntecedentesOdontologicosDocument {
  @Prop({ type: CampoClinicoSchema, required: true })
  tratamientoPrevio: CampoClinicoDocument;

  @Prop({ type: CampoClinicoSchema, required: true })
  protesisActual: CampoClinicoDocument;

  @Prop({ type: CampoClinicoSchema, required: true })
  sangradoGingival: CampoClinicoDocument;

  @Prop({ type: CampoClinicoSchema, required: true })
  bruxismo: CampoClinicoDocument;
}

export const AntecedentesOdontologicosSchema =
  SchemaFactory.createForClass(AntecedentesOdontologicosDocument);

@Schema({ _id: false })
export class AntecedentesDocument {
  @Prop({ type: [CampoClinicoSchema], default: [] })
  enfermedadesCronicas: CampoClinicoDocument[];

  @Prop({ type: [CampoClinicoSchema], default: [] })
  antecedentesMedicos: CampoClinicoDocument[];

  @Prop({ type: [CampoClinicoSchema], default: [] })
  antecedentesFamiliares: CampoClinicoDocument[];

  @Prop({ type: AntecedentesOdontologicosSchema, required: true })
  antecedentesOdontologicos: AntecedentesOdontologicosDocument;
}

export const AntecedentesSchema = SchemaFactory.createForClass(AntecedentesDocument);
