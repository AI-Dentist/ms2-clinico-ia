import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ _id: false })
export class ExploracionFisicaDocument {
  @Prop({ type: String, default: null })
  inspeccionExtraoral: string | null;

  @Prop({ type: String, default: '' })
  inspeccionIntraoral: string;

  @Prop({ type: String, default: null })
  hallazgosDentales: string | null;
}

export const ExploracionFisicaSchema = SchemaFactory.createForClass(ExploracionFisicaDocument);
