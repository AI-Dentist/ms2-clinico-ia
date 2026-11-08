/**
 * Response contract for POST estudios/analizar-imagen and its alias analizar-radiografia.
 * Implements S8 (L8 decisions): YOLO11 ONNX inference with 3 supported classes and
 * 2 unsupported labels declared explicitly.
 */

export type Severidad = 'BAJA' | 'MEDIA' | 'ALTA';

export interface BoundingBoxDto {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HallazgoIaOnnxDto {
  etiqueta: string;
  probabilidad: number;
  severidad: Severidad;
  zonaSugerida: string;
  boundingBox: BoundingBoxDto;
  recomendacionClinica: string;
}

export interface AnalisisImagenIaDto {
  hallazgos: HallazgoIaOnnxDto[];
  /**
   * Labels the model cannot predict — always returned, never invented.
   * Consumers should inform clinicians these conditions are outside model scope.
   */
  etiquetasNoSoportadas: string[];
  modeloNombre: string;
  version: string;
  fechaInferencia: string;
  confianzaGlobal: number;
  severidadMaxima: Severidad | 'NINGUNA';
  /** Decision-support disclaimer and license attribution. */
  aviso: string;
}
