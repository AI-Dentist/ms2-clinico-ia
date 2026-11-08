import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { EstudioClinicoMongo } from '../schemas/estudio-clinico.schema.js';
import type { CrearEstudioClinicoCommand, EstudioClinicoDto } from '../../../../application/dtos/estudio-clinico.dto.js';

@Injectable()
export class MongoEstudioClinicoRepository {
  constructor(
    @InjectModel(EstudioClinicoMongo.name)
    private readonly model: Model<EstudioClinicoMongo>,
  ) {}

  async crear(cmd: CrearEstudioClinicoCommand): Promise<EstudioClinicoDto> {
    const doc = await this.model.create({
      pacienteId: cmd.pacienteId,
      consultaId: cmd.consultaId,
      odontologoId: cmd.odontologoId,
      analisisIa: {
        modeloNombre: cmd.analisisIa.modeloNombre,
        version: cmd.analisisIa.version,
        fechaInferencia: new Date(cmd.analisisIa.fechaInferencia),
        confianzaGlobal: cmd.analisisIa.confianzaGlobal,
        severidadMaxima: cmd.analisisIa.severidadMaxima,
        hallazgos: cmd.analisisIa.hallazgos,
        observacionMedico: cmd.analisisIa.observacionMedico ?? null,
      },
      imagenMimeType: cmd.imagenMimeType ?? null,
      imagenNombreArchivo: cmd.imagenNombreArchivo ?? null,
      imagenBase64: cmd.imagenBase64 ?? null,
    });

    return this.toDto(doc);
  }

  async listarPorPaciente(pacienteId: string): Promise<EstudioClinicoDto[]> {
    // Exclude imagenBase64 from list results — large Base64 strings not needed in history views
    const docs = await this.model
      .find({ pacienteId })
      .select('-imagenBase64')
      .sort({ creadoEn: -1 })
      .lean()
      .exec();

    return docs.map((d) => this.toDto(d as unknown as EstudioClinicoMongo));
  }

  private toDto(doc: EstudioClinicoMongo): EstudioClinicoDto {
    return {
      id: (doc._id as { toString(): string }).toString(),
      pacienteId: doc.pacienteId,
      consultaId: doc.consultaId,
      odontologoId: doc.odontologoId,
      analisisIa: {
        modeloNombre: doc.analisisIa.modeloNombre,
        version: doc.analisisIa.version,
        fechaInferencia:
          doc.analisisIa.fechaInferencia instanceof Date
            ? doc.analisisIa.fechaInferencia.toISOString()
            : String(doc.analisisIa.fechaInferencia),
        confianzaGlobal: doc.analisisIa.confianzaGlobal,
        severidadMaxima: doc.analisisIa.severidadMaxima,
        hallazgos: doc.analisisIa.hallazgos as any,
        observacionMedico: doc.analisisIa.observacionMedico ?? null,
      },
      imagenMimeType: doc.imagenMimeType ?? null,
      imagenNombreArchivo: doc.imagenNombreArchivo ?? null,
      creadoEn: doc.creadoEn instanceof Date ? doc.creadoEn.toISOString() : String(doc.creadoEn),
    };
  }
}
