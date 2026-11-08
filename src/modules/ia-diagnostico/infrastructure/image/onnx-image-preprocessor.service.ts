import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as tf from '@tensorflow/tfjs';
import sharp from 'sharp';
import type { LetterboxContext } from '../onnx/yolo-decoder.js';

const SUPPORTED_FORMATS = new Set(['jpeg', 'png', 'webp']);
const INPUT_SIZE = 640;
// Standard YOLO letterbox padding value (gray, normalized)
const PAD_VALUE = 114 / 255;

export interface OnnxPreprocessResult {
  /** Float32Array in NCHW layout [1, 3, 640, 640], ready for onnxruntime-node Tensor */
  data: Float32Array;
  ctx: LetterboxContext;
}

@Injectable()
export class OnnxImagePreprocessorService {
  private readonly logger = new Logger(OnnxImagePreprocessorService.name);

  /**
   * Decodes a JPEG/PNG/WebP buffer, letterboxes it to 640×640, normalizes [0,1],
   * and returns the NCHW Float32Array and the letterbox context needed for
   * post-processing bounding boxes.
   *
   * Throws BadRequestException (HTTP 400) for corrupt or unsupported images.
   * Never synthesizes pixel data.
   */
  async preprocess(buffer: Buffer): Promise<OnnxPreprocessResult> {
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('El buffer de imagen está vacío o ausente.');
    }

    // 1. Detect format and decode via sharp
    let sharpInstance: ReturnType<typeof sharp>;
    let origWidth: number;
    let origHeight: number;
    let rgbBuffer: Buffer;

    try {
      sharpInstance = sharp(buffer);
      const meta = await sharpInstance.metadata();

      if (!meta.format || !SUPPORTED_FORMATS.has(meta.format)) {
        throw new BadRequestException(
          `Formato de imagen no soportado: "${meta.format ?? 'desconocido'}". ` +
            `Formatos aceptados: JPEG, PNG, WebP.`,
        );
      }

      origWidth = meta.width!;
      origHeight = meta.height!;

      // Decode to raw RGB (3 channels, strip alpha)
      const { data } = await sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      rgbBuffer = data;
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      this.logger.warn(`Failed to decode image: ${err.message}`);
      throw new BadRequestException(
        `No se pudo decodificar la imagen. Archivo corrupto o formato inválido. (${err.message})`,
      );
    }

    // 2. Letterbox to INPUT_SIZE × INPUT_SIZE using TensorFlow.js
    const scale = Math.min(INPUT_SIZE / origWidth, INPUT_SIZE / origHeight);
    const scaledW = Math.round(origWidth * scale);
    const scaledH = Math.round(origHeight * scale);
    const padLeft = Math.floor((INPUT_SIZE - scaledW) / 2);
    const padTop = Math.floor((INPUT_SIZE - scaledH) / 2);
    const padRight = INPUT_SIZE - scaledW - padLeft;
    const padBottom = INPUT_SIZE - scaledH - padTop;

    const nchwData = tf.tidy(() => {
      // Build [H, W, 3] float32 tensor, normalized to [0, 1]
      const float32 = new Float32Array(origHeight * origWidth * 3);
      for (let i = 0; i < origHeight * origWidth * 3; i++) {
        float32[i] = (rgbBuffer[i] ?? 0) / 255.0;
      }

      const tensor3d = tf.tensor3d(float32, [origHeight, origWidth, 3], 'float32');
      const resized = tf.image.resizeBilinear(tensor3d, [scaledH, scaledW]);

      // Pad to 640×640 with gray (PAD_VALUE)
      const padded = tf.pad(
        resized,
        [[padTop, padBottom], [padLeft, padRight], [0, 0]],
        PAD_VALUE,
      );

      // Transpose NHWC → NCHW: [H, W, C] → [C, H, W]
      const nchw = tf.transpose(padded, [2, 0, 1]);

      // Add batch dim: [3, 640, 640] → [1, 3, 640, 640]
      const batched = tf.expandDims(nchw, 0);

      return batched.dataSync() as Float32Array;
    });

    const ctx: LetterboxContext = {
      origWidth,
      origHeight,
      scale,
      padLeft,
      padTop,
      inputSize: INPUT_SIZE,
    };

    return { data: nchwData, ctx };
  }
}
