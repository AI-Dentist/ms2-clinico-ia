import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ _id: false })
export class AlergiaSnapshotDocument {
  @Prop({ type: String, required: true })
  sustancia: string;

  @Prop({ type: String, required: true })
  severidad: string;
}

export const AlergiaSnapshotSchema = SchemaFactory.createForClass(AlergiaSnapshotDocument);

@Schema({ _id: false })
export class SnapshotRiesgoClinicoDocument {
  @Prop({ type: [AlergiaSnapshotSchema], default: [] })
  alergiasCriticas: AlergiaSnapshotDocument[];

  @Prop({ type: [String], default: [] })
  condicionesMedicas: string[];

  @Prop({ type: [String], default: [] })
  medicacionHabitual: string[];

  @Prop({ type: Date, required: true })
  capturadoEn: Date;
}

export const SnapshotRiesgoClinicoSchema = SchemaFactory.createForClass(SnapshotRiesgoClinicoDocument);
