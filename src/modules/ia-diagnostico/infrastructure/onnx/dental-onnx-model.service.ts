import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ort from 'onnxruntime-node';
import type { NormalizedDetection, LetterboxContext } from './yolo-decoder.js';
import { decodeYolo11Output } from './yolo-decoder.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../../..');
const DEFAULT_MODEL_PATH = path.join(REPO_ROOT, 'models', 'dental-panoramic', 'best.onnx');

export const DENTAL_ONNX_MODEL_PORT = Symbol('IDentalOnnxModelPort');

export const MODEL_CONF_THRESHOLD = 0.45;
export const MODEL_IOU_THRESHOLD = 0.35;
const NUM_CLASSES = 3;

export interface OnnxInferenceResult {
  detections: NormalizedDetection[];
  modelName: string;
  version: string;
  inferenceMs: number;
}

@Injectable()
export class DentalOnnxModelService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DentalOnnxModelService.name);
  private session: ort.InferenceSession | null = null;
  private modelAvailable = false;
  private inputName = 'images';
  private outputName = 'output0';

  readonly modelName = 'liodon-ai/dental-panoramic-detector';
  readonly version = '1.0.0-yolo11n';

  async onModuleInit(): Promise<void> {
    const modelPath = process.env.DENTAL_MODEL_PATH ?? DEFAULT_MODEL_PATH;
    if (!existsSync(modelPath)) {
      this.logger.warn(
        `ONNX model not found at: ${modelPath}. ` +
          `Run "node scripts/fetch-dental-model.mjs" to download it. ` +
          `Inference will return 503 until the model is available.`,
      );
      this.modelAvailable = false;
      return;
    }

    try {
      this.logger.log(`Loading ONNX model from: ${modelPath}`);
      this.session = await ort.InferenceSession.create(modelPath, {
        executionProviders: ['cpu'],
      });

      // Discover actual input/output names from the model
      if (this.session.inputNames.length > 0) {
        this.inputName = this.session.inputNames[0]!;
      }
      if (this.session.outputNames.length > 0) {
        this.outputName = this.session.outputNames[0]!;
      }

      this.modelAvailable = true;
      this.logger.log(
        `ONNX model loaded. Input: "${this.inputName}", Output: "${this.outputName}"`,
      );
    } catch (err: any) {
      this.logger.error(`Failed to load ONNX model: ${err.message}`);
      this.modelAvailable = false;
    }
  }

  onModuleDestroy(): void {
    this.session = null;
    this.modelAvailable = false;
  }

  async runInference(
    nchwData: Float32Array,
    ctx: LetterboxContext,
  ): Promise<OnnxInferenceResult> {
    if (!this.modelAvailable || !this.session) {
      throw new ServiceUnavailableException({
        statusCode: 503,
        codigo: 'MODELO_NO_DISPONIBLE',
        mensaje:
          'El modelo de inferencia ONNX no está disponible. ' +
          'Descárguelo con: node scripts/fetch-dental-model.mjs',
      });
    }

    const t0 = performance.now();

    // Input tensor: float32[1, 3, 640, 640]
    const inputTensor = new ort.Tensor('float32', nchwData, [1, 3, 640, 640]);
    const feeds: Record<string, ort.Tensor> = { [this.inputName]: inputTensor };

    const results = await this.session.run(feeds);
    const outputTensor = results[this.outputName];

    if (!outputTensor) {
      throw new ServiceUnavailableException({
        statusCode: 503,
        codigo: 'MODELO_NO_DISPONIBLE',
        mensaje: `La salida del modelo "${this.outputName}" no está disponible.`,
      });
    }

    const outputData = outputTensor.data as Float32Array;
    // Expected shape: [1, 7, 8400] → numAnchors = outputData.length / (4 + NUM_CLASSES)
    const numAnchors = outputData.length / (4 + NUM_CLASSES);

    const detections = decodeYolo11Output(
      outputData,
      numAnchors,
      NUM_CLASSES,
      ctx,
      MODEL_CONF_THRESHOLD,
      MODEL_IOU_THRESHOLD,
    );

    const inferenceMs = Math.round((performance.now() - t0) * 100) / 100;

    return {
      detections,
      modelName: this.modelName,
      version: this.version,
      inferenceMs,
    };
  }

  /** True when the ONNX model file was found and loaded successfully. */
  get isAvailable(): boolean {
    return this.modelAvailable;
  }
}
