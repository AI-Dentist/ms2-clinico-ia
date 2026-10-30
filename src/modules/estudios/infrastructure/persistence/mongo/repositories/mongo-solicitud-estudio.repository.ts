import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { ISolicitudEstudioRepositoryPort } from '../../../../domain/ports/solicitud-estudio.repository.port.js';
import { SolicitudEstudio } from '../../../../domain/entities/solicitud-estudio.entity.js';
import { ResultadoEstudio } from '../../../../domain/entities/resultado-estudio.entity.js';
import { SolicitudEstudioMongo, type SolicitudEstudioDocument } from '../schemas/solicitud-estudio.schema.js';
import { EstadoSolicitudEstudio } from '../../../../domain/enums/estado-solicitud-estudio.enum.js';
import { PrioridadEstudio } from '../../../../domain/enums/prioridad-estudio.enum.js';

@Injectable()
export class MongoSolicitudEstudioRepository implements ISolicitudEstudioRepositoryPort {
  constructor(
    @InjectModel(SolicitudEstudioMongo.name)
    private readonly model: Model<SolicitudEstudioDocument>
  ) {}

  async guardar(solicitud: SolicitudEstudio): Promise<SolicitudEstudio> {
    const raw: any = {
      _id: solicitud.id,
      historiaClinicaId: solicitud.historiaClinicaId,
      consultaId: solicitud.consultaId,
      pacienteId: solicitud.pacienteId,
      odontologoId: solicitud.odontologoId,
      tipoEstudioId: solicitud.tipoEstudioId,
      motivo: solicitud.motivo,
      indicaciones: solicitud.indicaciones,
      prioridad: solicitud.prioridad,
      estado: solicitud.estado,
      fechaSolicitud: solicitud.fechaSolicitud,
      motivoCancelacion: solicitud.motivoCancelacion,
      resultado: solicitud.resultado
        ? {
            _id: solicitud.resultado.id,
            laboratorioId: solicitud.resultado.laboratorioId,
            fechaResultado: solicitud.resultado.fechaResultado,
            registradoPor: solicitud.resultado.registradoPor,
            resumen: solicitud.resultado.resumen,
            observaciones: solicitud.resultado.observaciones,
            valoresReferencia: solicitud.resultado.valoresReferencia.map((v) => ({ ...v })),
            archivoAdjunto: solicitud.resultado.archivoAdjunto
              ? {
                  urlArchivo: solicitud.resultado.archivoAdjunto.urlArchivo,
                  nombreArchivo: solicitud.resultado.archivoAdjunto.nombreArchivo,
                  mimeType: solicitud.resultado.archivoAdjunto.mimeType,
                  tamanioBytes: solicitud.resultado.archivoAdjunto.tamanioBytes,
                }
              : null,
            registradoEn: solicitud.resultado.registradoEn,
          }
        : null,
      creadoEn: solicitud.creadoEn,
      actualizadoEn: solicitud.actualizadoEn,
    };

    await this.model.updateOne({ _id: solicitud.id }, { $set: raw }, { upsert: true }).exec();
    return solicitud;
  }

  async buscarPorId(id: string): Promise<SolicitudEstudio | null> {
    const doc = await this.model.findById(id).lean().exec();
    return doc ? this.toDomain(doc) : null;
  }

  async listarPorConsulta(consultaId: string): Promise<SolicitudEstudio[]> {
    const docs = await this.model
      .find({ consultaId: consultaId.trim() })
      .sort({ fechaSolicitud: -1 })
      .lean()
      .exec();
    return docs.map((d) => this.toDomain(d));
  }

  async listarPorHistoriaClinica(historiaClinicaId: string): Promise<SolicitudEstudio[]> {
    const docs = await this.model
      .find({ historiaClinicaId: historiaClinicaId.trim() })
      .sort({ fechaSolicitud: -1 })
      .lean()
      .exec();
    return docs.map((d) => this.toDomain(d));
  }

  async contarPorLaboratorio(laboratorioId: string): Promise<number> {
    return this.model.countDocuments({ 'resultado.laboratorioId': laboratorioId.trim() }).exec();
  }

  private toDomain(doc: any): SolicitudEstudio {
    let resultado: ResultadoEstudio | null = null;
    if (doc.resultado) {
      resultado = ResultadoEstudio.reconstituir({
        id: doc.resultado._id,
        solicitudEstudioId: doc._id,
        laboratorioId: doc.resultado.laboratorioId || null,
        fechaResultado: new Date(doc.resultado.fechaResultado),
        registradoPor: doc.resultado.registradoPor,
        resumen: doc.resultado.resumen,
        observaciones: doc.resultado.observaciones || null,
        valoresReferencia: doc.resultado.valoresReferencia || [],
        archivoAdjunto: doc.resultado.archivoAdjunto
          ? {
              urlArchivo: doc.resultado.archivoAdjunto.urlArchivo,
              nombreArchivo: doc.resultado.archivoAdjunto.nombreArchivo,
              mimeType: doc.resultado.archivoAdjunto.mimeType,
              tamanioBytes: doc.resultado.archivoAdjunto.tamanioBytes,
            }
          : null,
        registradoEn: new Date(doc.resultado.registradoEn),
      });
    }

    return SolicitudEstudio.reconstituir({
      id: doc._id,
      historiaClinicaId: doc.historiaClinicaId,
      consultaId: doc.consultaId,
      pacienteId: doc.pacienteId,
      odontologoId: doc.odontologoId,
      tipoEstudioId: doc.tipoEstudioId,
      motivo: doc.motivo,
      indicaciones: doc.indicaciones || null,
      prioridad: doc.prioridad as PrioridadEstudio,
      estado: doc.estado as EstadoSolicitudEstudio,
      fechaSolicitud: new Date(doc.fechaSolicitud),
      motivoCancelacion: doc.motivoCancelacion || null,
      resultado,
      creadoEn: new Date(doc.creadoEn),
      actualizadoEn: new Date(doc.actualizadoEn),
    });
  }
}
