import { BadRequestException, Injectable } from '@nestjs/common';
import { DentalOnnxModelService } from '../../infrastructure/onnx/dental-onnx-model.service.js';
import { OnnxImagePreprocessorService } from '../../infrastructure/image/onnx-image-preprocessor.service.js';
import type {
  AnalisisImagenIaDto,
  HallazgoIaOnnxDto,
  Severidad,
} from '../dtos/analisis-imagen-ia.dto.js';
import type { NormalizedDetection } from '../../infrastructure/onnx/yolo-decoder.js';

const MAX_IMAGE_BYTES = 25 * 1024 * 1024; // 25 MB per S9

/**
 * Maps YOLO class index (from liodon-ai/dental-panoramic-detector) to the
 * canonical Spanish clinical label. Order: caries=0, periapical_lesion=1, impacted_tooth=2.
 */
const CLASS_LABEL_MAP: Record<number, string> = {
  0: 'caries_interproximal_o_oclusal',
  1: 'lesion_periapical',
  2: 'pieza_retenida_o_impactada',
};

/**
 * Labels the current model cannot detect — declared explicitly (never invented).
 */
const UNSUPPORTED_LABELS = [
  'reabsorcion_osea_periodontal',
  'restauracion_o_endodoncia_previa',
];

/**
 * Severity heuristic (documented):
 *   score >= 0.70 → ALTA
 *   score >= 0.50 → MEDIA
 *   score <  0.50 → BAJA
 */
function mapSeveridad(score: number): Severidad {
  if (score >= 0.70) return 'ALTA';
  if (score >= 0.50) return 'MEDIA';
  return 'BAJA';
}

/**
 * Quadrant from bounding box center (using dental radiograph orientation convention):
 *   left = patient's right side, upper = maxilla.
 */
function mapZonaSugerida(det: NormalizedDetection): string {
  const cx = det.x + det.width / 2;
  const cy = det.y + det.height / 2;
  if (cx < 0.5 && cy < 0.5) return 'Cuadrante I – Superior Derecho (maxila derecha)';
  if (cx >= 0.5 && cy < 0.5) return 'Cuadrante II – Superior Izquierdo (maxila izquierda)';
  if (cx < 0.5 && cy >= 0.5) return 'Cuadrante III – Inferior Derecho (mandíbula derecha)';
  return 'Cuadrante IV – Inferior Izquierdo (mandíbula izquierda)';
}

const RECOMENDACIONES: Record<string, string> = {
  caries_interproximal_o_oclusal:
    'Se detectó radiolucidez compatible con caries interproximal u oclusal. ' +
    'Se recomienda confirmar mediante exploración clínica con sonda y aplicar tratamiento restaurador.',
  lesion_periapical:
    'Área radiolúcida periapical detectada. Puede indicar patología pulpar o granuloma. ' +
    'Se sugiere evaluación de vitalidad pulpar y eventual tratamiento endodóntico.',
  pieza_retenida_o_impactada:
    'Pieza dental sin erupcionar o impactada detectada. ' +
    'Se recomienda evaluación ortodóntica y/o quirúrgica según el grado de impactación.',
};

export interface AnalizarImagenIaCommand {
  buffer: Buffer;
  nombreArchivo: string;
  mimeType: string;
  tamanioBytes: number;
}

const AVISO =
  'Este análisis es un apoyo de decisión clínica para uso profesional odontológico. ' +
  'No constituye un diagnóstico médico definitivo ni reemplaza el criterio del profesional. ' +
  'Modelo: liodon-ai/dental-panoramic-detector — Licencia CC-BY-NC-4.0 (uso no comercial).';

@Injectable()
export class AnalizarImagenIaUseCase {
  constructor(
    private readonly onnxModel: DentalOnnxModelService,
    private readonly preprocessor: OnnxImagePreprocessorService,
  ) {}

  async execute(cmd: AnalizarImagenIaCommand): Promise<AnalisisImagenIaDto> {
    if (!cmd.buffer || cmd.buffer.length === 0) {
      throw new BadRequestException('El archivo de imagen está vacío o ausente.');
    }
    if (cmd.tamanioBytes > MAX_IMAGE_BYTES) {
      throw new BadRequestException(
        `El archivo excede el tamaño máximo permitido de ${MAX_IMAGE_BYTES / 1024 / 1024}MB.`,
      );
    }

    // 1. Decode and letterbox (throws 400 for corrupt/unsupported)
    const { data: nchwData, ctx } = await this.preprocessor.preprocess(cmd.buffer);

    // 2. ONNX inference (throws 503 if model unavailable)
    const { detections, modelName, version, inferenceMs: _inferenceMs } =
      await this.onnxModel.runInference(nchwData, ctx);

    // 3. Build hallazgos[]
    const hallazgos: HallazgoIaOnnxDto[] = detections.map((det) => {
      const etiqueta = CLASS_LABEL_MAP[det.classIdx] ?? `clase_${det.classIdx}`;
      const severidad = mapSeveridad(det.score);
      return {
        etiqueta,
        probabilidad: Math.round(det.score * 100) / 100,
        severidad,
        zonaSugerida: mapZonaSugerida(det),
        boundingBox: {
          x: Math.round(det.x * 10000) / 10000,
          y: Math.round(det.y * 10000) / 10000,
          width: Math.round(det.width * 10000) / 10000,
          height: Math.round(det.height * 10000) / 10000,
        },
        recomendacionClinica: RECOMENDACIONES[etiqueta] ?? 'Evaluación clínica profesional recomendada.',
      };
    });

    // 4. estructura_normal — only when no detections above threshold
    if (hallazgos.length === 0) {
      hallazgos.push({
        etiqueta: 'estructura_normal',
        probabilidad: 0,
        severidad: 'BAJA',
        zonaSugerida: 'Sin zona específica',
        boundingBox: { x: 0, y: 0, width: 0, height: 0 },
        recomendacionClinica:
          'sin hallazgos detectados por el modelo — no constituye una confirmación clínica.',
      });
    }

    const confianzaGlobal =
      detections.length > 0
        ? Math.round(Math.max(...detections.map((d) => d.score)) * 100) / 100
        : 0;

    const severidadMaxima = this.computeSeveridadMaxima(hallazgos);

    return {
      hallazgos,
      etiquetasNoSoportadas: UNSUPPORTED_LABELS,
      modeloNombre: modelName,
      version,
      fechaInferencia: new Date().toISOString(),
      confianzaGlobal,
      severidadMaxima,
      aviso: AVISO,
    };
  }

  private computeSeveridadMaxima(hallazgos: HallazgoIaOnnxDto[]): Severidad | 'NINGUNA' {
    const order: (Severidad | 'NINGUNA')[] = ['NINGUNA', 'BAJA', 'MEDIA', 'ALTA'];
    return hallazgos.reduce<Severidad | 'NINGUNA'>((max, h) => {
      if (h.etiqueta === 'estructura_normal') return max;
      const idx = order.indexOf(h.severidad);
      const maxIdx = order.indexOf(max);
      return idx > maxIdx ? h.severidad : max;
    }, 'NINGUNA');
  }
}
