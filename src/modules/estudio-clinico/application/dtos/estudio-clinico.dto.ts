import type { HallazgoIaOnnxDto } from '../../../ia-diagnostico/application/dtos/analisis-imagen-ia.dto.js';

export interface AnalisisIaDto {
  modeloNombre: string;
  version: string;
  fechaInferencia: string;
  confianzaGlobal: number;
  severidadMaxima: string;
  hallazgos: HallazgoIaOnnxDto[];
  observacionMedico: string | null;
}

export interface EstudioClinicoDto {
  id: string;
  pacienteId: string;
  consultaId: string;
  odontologoId: string;
  analisisIa: AnalisisIaDto;
  imagenMimeType: string | null;
  imagenNombreArchivo: string | null;
  creadoEn: string;
}

export interface CrearEstudioClinicoCommand {
  pacienteId: string;
  consultaId: string;
  /** Must come from the JWT context — never from request body. */
  odontologoId: string;
  analisisIa: AnalisisIaDto;
  imagenMimeType?: string | null;
  imagenNombreArchivo?: string | null;
  imagenBase64?: string | null;
}
