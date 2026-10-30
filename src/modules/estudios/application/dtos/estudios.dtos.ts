import { CategoriaEstudio } from '../../domain/enums/categoria-estudio.enum.js';
import { EstadoCatalogo } from '../../domain/enums/estado-catalogo.enum.js';
import { EstadoSolicitudEstudio } from '../../domain/enums/estado-solicitud-estudio.enum.js';
import { PrioridadEstudio } from '../../domain/enums/prioridad-estudio.enum.js';

export interface LaboratorioDto {
  id: string;
  nombre: string;
  descripcion: string;
  contacto: string | null;
  estado: EstadoCatalogo;
  creadoEn: string;
  actualizadoEn: string;
}

export interface TipoEstudioDto {
  id: string;
  codigo: string;
  nombre: string;
  categoria: CategoriaEstudio;
  descripcion: string;
  estado: EstadoCatalogo;
  creadoEn: string;
  actualizadoEn: string;
}

export interface ValorReferenciaDto {
  parametro: string;
  valor: string;
  unidad?: string;
  estado?: string;
}

export interface ArchivoAdjuntoDto {
  urlArchivo: string;
  nombreArchivo: string;
  mimeType: string;
  tamanioBytes: number;
}

export interface ResultadoEstudioDto {
  id: string;
  solicitudEstudioId: string;
  laboratorioId: string | null;
  laboratorioNombre?: string | null;
  fechaResultado: string;
  registradoPor: string;
  resumen: string;
  observaciones: string | null;
  valoresReferencia?: ValorReferenciaDto[];
  archivoAdjunto?: ArchivoAdjuntoDto | null;
  registradoEn: string;
}

export interface SolicitudEstudioDto {
  id: string;
  historiaClinicaId: string;
  consultaId: string;
  pacienteId: string;
  odontologoId: string;
  tipoEstudioId: string;
  tipoEstudio?: TipoEstudioDto | null;
  codigoEstudio?: string | null;
  nombreEstudio?: string | null;
  categoria?: CategoriaEstudio | null;
  motivo: string;
  indicaciones: string | null;
  prioridad: PrioridadEstudio;
  estado: EstadoSolicitudEstudio;
  fechaSolicitud: string;
  motivoCancelacion: string | null;
  resultado: ResultadoEstudioDto | null;
  creadoEn: string;
  actualizadoEn: string;
}
