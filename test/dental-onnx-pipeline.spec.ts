import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import sharp from 'sharp';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DentalOnnxModelService } from '../src/modules/ia-diagnostico/infrastructure/onnx/dental-onnx-model.service.js';
import { OnnxImagePreprocessorService } from '../src/modules/ia-diagnostico/infrastructure/image/onnx-image-preprocessor.service.js';
import { AnalizarImagenIaUseCase } from '../src/modules/ia-diagnostico/application/use-cases/analizar-imagen-ia.use-case.js';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const MODEL_PATH = process.env.DENTAL_MODEL_PATH ?? path.join(REPO_ROOT, 'models', 'dental-panoramic', 'best.onnx');

const modelExists = existsSync(MODEL_PATH);

describe.skipIf(!modelExists)('Dental ONNX Pipeline Integration (Real Model)', () => {
  let onnxModel: DentalOnnxModelService;
  let preprocessor: OnnxImagePreprocessorService;
  let useCase: AnalizarImagenIaUseCase;

  beforeAll(async () => {
    onnxModel = new DentalOnnxModelService();
    await onnxModel.onModuleInit();
    preprocessor = new OnnxImagePreprocessorService();
    useCase = new AnalizarImagenIaUseCase(onnxModel, preprocessor);
  }, 30000);

  afterAll(() => {
    onnxModel.onModuleDestroy();
  });

  it('runs real inference on a synthetic 640x640 PNG image and asserts output shape', async () => {
    // Generate real synthetic PNG using sharp
    const syntheticBuffer = await sharp({
      create: {
        width: 640,
        height: 640,
        channels: 3,
        background: { r: 128, g: 128, b: 128 },
      },
    })
      .png()
      .toBuffer();

    const result = await useCase.execute({
      buffer: syntheticBuffer,
      nombreArchivo: 'synthetic-panoramic.png',
      mimeType: 'image/png',
      tamanioBytes: syntheticBuffer.length,
    });

    expect(result).toBeDefined();
    expect(result.modeloNombre).toBe('liodon-ai/dental-panoramic-detector');
    expect(result.version).toBe('1.0.0-yolo11n');
    expect(result.fechaInferencia).toBeDefined();
    expect(typeof result.confianzaGlobal).toBe('number');
    expect(result.confianzaGlobal).toBeGreaterThanOrEqual(0);
    expect(result.confianzaGlobal).toBeLessThanOrEqual(1);

    // Unsupported labels explicitly declared
    expect(result.etiquetasNoSoportadas).toEqual([
      'reabsorcion_osea_periodontal',
      'restauracion_o_endodoncia_previa',
    ]);

    // License attribution and decision-support disclaimer
    expect(result.aviso).toContain('CC-BY-NC-4.0');
    expect(result.aviso).toContain('apoyo de decisión clínica');

    // On a plain gray synthetic image, no detections above 0.45 threshold -> estructura_normal
    expect(result.hallazgos.length).toBeGreaterThanOrEqual(1);
    if (result.hallazgos.length === 1 && result.hallazgos[0]!.etiqueta === 'estructura_normal') {
      expect(result.hallazgos[0]!.recomendacionClinica).toContain('sin hallazgos detectados por el modelo');
      expect(result.severidadMaxima).toBe('NINGUNA');
    } else {
      for (const h of result.hallazgos) {
        expect(['caries_interproximal_o_oclusal', 'lesion_periapical', 'pieza_retenida_o_impactada', 'estructura_normal']).toContain(h.etiqueta);
        expect(h.probabilidad).toBeGreaterThanOrEqual(0);
        expect(h.probabilidad).toBeLessThanOrEqual(1);
        expect(['BAJA', 'MEDIA', 'ALTA']).toContain(h.severidad);
        expect(h.boundingBox.x).toBeGreaterThanOrEqual(0);
        expect(h.boundingBox.y).toBeGreaterThanOrEqual(0);
      }
    }
  }, 30000);

  it('rejects corrupt/unsupported images with HTTP 400', async () => {
    const corruptBuffer = Buffer.from('NOT_A_REAL_IMAGE_DATA');
    await expect(
      useCase.execute({
        buffer: corruptBuffer,
        nombreArchivo: 'corrupt.jpg',
        mimeType: 'image/jpeg',
        tamanioBytes: corruptBuffer.length,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws HTTP 503 MODELO_NO_DISPONIBLE when model is not loaded', async () => {
    const uninitializedModel = new DentalOnnxModelService();
    const uninitializedUseCase = new AnalizarImagenIaUseCase(uninitializedModel, preprocessor);

    const validBuffer = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 200, g: 200, b: 200 },
      },
    })
      .png()
      .toBuffer();

    await expect(
      uninitializedUseCase.execute({
        buffer: validBuffer,
        nombreArchivo: 'valid.png',
        mimeType: 'image/png',
        tamanioBytes: validBuffer.length,
      }),
    ).rejects.toThrow(ServiceUnavailableException);
  });
});
