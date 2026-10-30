import { Laboratorio } from '../domain/entities/laboratorio.entity.js';
import { TipoEstudio } from '../domain/entities/tipo-estudio.entity.js';
import { SolicitudEstudio } from '../domain/entities/solicitud-estudio.entity.js';
import { ResultadoEstudio } from '../domain/entities/resultado-estudio.entity.js';
import type {
  LaboratorioDto,
  TipoEstudioDto,
  ResultadoEstudioDto,
  SolicitudEstudioDto,
} from './dtos/estudios.dtos.js';

export class EstudiosMapper {
  static laboratorioToDto(lab: Laboratorio): LaboratorioDto {
    return {
      id: lab.id,
      nombre: lab.nombre,
      descripcion: lab.descripcion,
      contacto: lab.contacto,
      estado: lab.estado,
      creadoEn: lab.creadoEn.toISOString(),
      actualizadoEn: lab.actualizadoEn.toISOString(),
    };
  }

  static tipoEstudioToDto(tipo: TipoEstudio): TipoEstudioDto {
    return {
      id: tipo.id,
      codigo: tipo.codigo,
      nombre: tipo.nombre,
      categoria: tipo.categoria,
      descripcion: tipo.descripcion,
      estado: tipo.estado,
      creadoEn: tipo.creadoEn.toISOString(),
      actualizadoEn: tipo.actualizadoEn.toISOString(),
    };
  }

  static resultadoToDto(res: ResultadoEstudio, labNombre?: string | null): ResultadoEstudioDto {
    return {
      id: res.id,
      solicitudEstudioId: res.solicitudEstudioId,
      laboratorioId: res.laboratorioId,
      laboratorioNombre: labNombre ?? null,
      fechaResultado: res.fechaResultado.toISOString(),
      registradoPor: res.registradoPor,
      resumen: res.resumen,
      observaciones: res.observaciones,
      valoresReferencia: res.valoresReferencia.map((v: any) => ({ ...v })),
      archivoAdjunto: res.archivoAdjunto
        ? {
            urlArchivo: res.archivoAdjunto.urlArchivo,
            nombreArchivo: res.archivoAdjunto.nombreArchivo,
            mimeType: res.archivoAdjunto.mimeType,
            tamanioBytes: res.archivoAdjunto.tamanioBytes,
          }
        : null,
      registradoEn: res.registradoEn.toISOString(),
    };
  }

  static solicitudToDto(
    solicitud: SolicitudEstudio,
    tipoEstudio?: TipoEstudio | null,
    laboratorioNombre?: string | null
  ): SolicitudEstudioDto {
    return {
      id: solicitud.id,
      historiaClinicaId: solicitud.historiaClinicaId,
      consultaId: solicitud.consultaId,
      pacienteId: solicitud.pacienteId,
      odontologoId: solicitud.odontologoId,
      tipoEstudioId: solicitud.tipoEstudioId,
      tipoEstudio: tipoEstudio ? EstudiosMapper.tipoEstudioToDto(tipoEstudio) : null,
      codigoEstudio: tipoEstudio ? tipoEstudio.codigo : null,
      nombreEstudio: tipoEstudio ? tipoEstudio.nombre : null,
      categoria: tipoEstudio ? tipoEstudio.categoria : null,
      motivo: solicitud.motivo,
      indicaciones: solicitud.indicaciones,
      prioridad: solicitud.prioridad,
      estado: solicitud.estado,
      fechaSolicitud: solicitud.fechaSolicitud.toISOString(),
      motivoCancelacion: solicitud.motivoCancelacion,
      resultado: solicitud.resultado
        ? EstudiosMapper.resultadoToDto(solicitud.resultado, laboratorioNombre)
        : null,
      creadoEn: solicitud.creadoEn.toISOString(),
      actualizadoEn: solicitud.actualizadoEn.toISOString(),
    };
  }
}
