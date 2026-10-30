import { HallazgoIa } from '../../domain/enums/hallazgo-ia.enum.js';
import { SeveridadLesion } from '../../domain/enums/severidad-lesion.enum.js';

export interface MetadataImagenDto {
  nombreArchivo: string;
  mimeType: string;
  tamanioBytes: number;
  anchoOriginal: number;
  altoOriginal: number;
  canales: number;
}

export interface ModeloInfoDto {
  nombre: string;
  arquitectura: string;
  version: string;
}

export interface AnalisisRadiografiaDto {
  id: string;
  probabilidadCaries: number;
  probabilidadSano: number;
  confianza: number;
  hallazgo: HallazgoIa;
  severidad: SeveridadLesion;
  clasificacion: string;
  tiempoInferenciaMs: number;
  recomendacionClinica: string;
  modeloInfo: ModeloInfoDto;
  metadataImagen: MetadataImagenDto;
  fechaAnalisis: string;
}
