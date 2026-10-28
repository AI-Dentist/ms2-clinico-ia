import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ _id: false })
export class ServicioFacturableDocument {
  @Prop({ type: String, required: true })
  servicioId: string;

  @Prop({ type: String, default: null })
  codigo: string | null;

  @Prop({ type: String, required: true })
  nombre: string;

  @Prop({ type: Number, required: true })
  cantidad: number;

  @Prop({ type: String, required: true })
  precioUnitarioBs: string;

  @Prop({ type: Number, default: null })
  piezaDental: number | null;
}

export const ServicioFacturableSchema = SchemaFactory.createForClass(
  ServicioFacturableDocument,
);

