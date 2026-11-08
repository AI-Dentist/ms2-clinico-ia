import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DentalOnnxModelService } from './dental-onnx-model.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../../..');
const MODEL_PATH = process.env.DENTAL_MODEL_PATH ?? path.join(REPO_ROOT, 'models', 'dental-panoramic', 'best.onnx');

const modelExists = existsSync(MODEL_PATH);

describe('DentalOnnxModelService — unit (always)', () => {
  it('should report isAvailable=false before onModuleInit', () => {
    const svc = new DentalOnnxModelService();
    expect(svc.isAvailable).toBe(false);
  });

  it('should expose modelName and version', () => {
    const svc = new DentalOnnxModelService();
    expect(svc.modelName).toBe('liodon-ai/dental-panoramic-detector');
    expect(svc.version).toBe('1.0.0-yolo11n');
  });
});

describe.skipIf(!modelExists)(
  'DentalOnnxModelService — real ONNX inference (requires downloaded model)',
  () => {
    let svc: DentalOnnxModelService;

    beforeAll(async () => {
      svc = new DentalOnnxModelService();
      await svc.onModuleInit();
    }, 30000);

    afterAll(() => {
      svc.onModuleDestroy();
    });

    it('should load the model and report isAvailable=true', () => {
      expect(svc.isAvailable).toBe(true);
    });

    it('should run inference on a synthetic 640×640 image and return a valid result', async () => {
      // Synthetic gray image: NCHW float32[1, 3, 640, 640] all=0.5
      const nchwData = new Float32Array(1 * 3 * 640 * 640).fill(0.5);
      const ctx = {
        origWidth: 640,
        origHeight: 640,
        scale: 1,
        padLeft: 0,
        padTop: 0,
        inputSize: 640,
      };

      const result = await svc.runInference(nchwData, ctx);

      expect(result).toBeDefined();
      expect(result.modelName).toBe('liodon-ai/dental-panoramic-detector');
      expect(result.version).toBe('1.0.0-yolo11n');
      expect(typeof result.inferenceMs).toBe('number');
      expect(result.inferenceMs).toBeGreaterThan(0);
      // detections is an array (may be empty on a synthetic gray image)
      expect(Array.isArray(result.detections)).toBe(true);

      for (const det of result.detections) {
        expect(det.classIdx).toBeGreaterThanOrEqual(0);
        expect(det.classIdx).toBeLessThanOrEqual(2); // 3 classes: 0, 1, 2
        expect(det.score).toBeGreaterThanOrEqual(0.45); // above conf threshold
        expect(det.score).toBeLessThanOrEqual(1);
        expect(det.x).toBeGreaterThanOrEqual(0);
        expect(det.y).toBeGreaterThanOrEqual(0);
        expect(det.width).toBeGreaterThan(0);
        expect(det.height).toBeGreaterThan(0);
        expect(det.x + det.width).toBeLessThanOrEqual(1.01); // normalized [0,1]
        expect(det.y + det.height).toBeLessThanOrEqual(1.01);
      }
    }, 30000);
  },
);
