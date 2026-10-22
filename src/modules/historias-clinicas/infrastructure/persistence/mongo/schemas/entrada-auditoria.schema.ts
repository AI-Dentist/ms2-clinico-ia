import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { AccionAuditoria } from '../../../../domain/value-objects/accion-auditoria.enum.js';

@Schema({ _id: false })
export class EntradaAuditoriaDocument {
  @Prop({
    type: String,
    enum: Object.values(AccionAuditoria),
    required: true,
  })
  accion: AccionAuditoria;

  @Prop({ type: String, required: true })
  odontologoId: string;

  @Prop({ type: Date, required: true })
  fechaHora: Date;

  @Prop({ type: [String], default: [] })
  camposModificados: string[];

  @Prop({ type: String, default: null })
  descripcion: string | null;
}

export const EntradaAuditoriaSchema =
  SchemaFactory.createForClass(EntradaAuditoriaDocument);
