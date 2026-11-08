import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { AnalizarImagenIaUseCase } from './analizar-imagen-ia.use-case.js';
import type { DentalOnnxModelService } from '../../infrastructure/onnx/dental-onnx-model.service.js';
import type { OnnxImagePreprocessorService } from '../../infrastructure/image/onnx-image-preprocessor.service.js';

function makePreprocessMock(overrides?: Partial<Awaited<ReturnType<OnnxImagePreprocessorService['preprocess']>>>) {
  return vi.fn().mockResolvedValue({
    data: new Float32Array(1 * 3 * 640 * 640),
    ctx: {
      origWidth: 640,
      origHeight: 480,
      scale: 1,
      padLeft: 0,
      padTop: 80,
      inputSize: 640,
    },
    ...overrides,
  });
}

describe('AnalizarImagenIaUseCase', () => {
  let useCase: AnalizarImagenIaUseCase;
  let mockOnnx: Partial<DentalOnnxModelService>;
  let mockPreprocessor: Partial<OnnxImagePreprocessorService>;

  beforeEach(() => {
    mockOnnx = {
      runInference: vi.fn().mockResolvedValue({
        detections: [
          {
            classIdx: 0,
            score: 0.82,
            x: 0.1,
            y: 0.2,
            width: 0.15,
            height: 0.12,
          },
        ],
        modelName: 'liodon-ai/dental-panoramic-detector',
        version: '1.0.0-yolo11n',
        inferenceMs: 45.2,
      }),
      modelName: 'liodon-ai/dental-panoramic-detector',
      version: '1.0.0-yolo11n',
    };

    mockPreprocessor = { preprocess: makePreprocessMock() };

    useCase = new AnalizarImagenIaUseCase(
      mockOnnx as DentalOnnxModelService,
      mockPreprocessor as OnnxImagePreprocessorService,
    );
  });

  it('should return hallazgos with correct etiqueta and severidad for a caries detection (class 0)', async () => {
    const result = await useCase.execute({
      buffer: Buffer.from('fake-image'),
      nombreArchivo: 'rx.jpg',
      mimeType: 'image/jpeg',
      tamanioBytes: 1024,
    });

    expect(result.hallazgos).toHaveLength(1);
    expect(result.hallazgos[0]!.etiqueta).toBe('caries_interproximal_o_oclusal');
    expect(result.hallazgos[0]!.probabilidad).toBe(0.82);
    expect(result.hallazgos[0]!.severidad).toBe('ALTA'); // 0.82 >= 0.70
    expect(result.hallazgos[0]!.boundingBox).toMatchObject({ x: 0.1, y: 0.2, width: 0.15, height: 0.12 });
    expect(result.hallazgos[0]!.recomendacionClinica).toContain('caries');
    expect(result.etiquetasNoSoportadas).toContain('reabsorcion_osea_periodontal');
    expect(result.etiquetasNoSoportadas).toContain('restauracion_o_endodoncia_previa');
  });

  it('should return lesion_periapical for class 1', async () => {
    (mockOnnx.runInference as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      detections: [{ classIdx: 1, score: 0.60, x: 0.4, y: 0.3, width: 0.1, height: 0.1 }],
      modelName: 'liodon-ai/dental-panoramic-detector',
      version: '1.0.0-yolo11n',
      inferenceMs: 40,
    });

    const result = await useCase.execute({
      buffer: Buffer.from('fake'),
      nombreArchivo: 'rx.png',
      mimeType: 'image/png',
      tamanioBytes: 512,
    });

    expect(result.hallazgos[0]!.etiqueta).toBe('lesion_periapical');
    expect(result.hallazgos[0]!.severidad).toBe('MEDIA'); // 0.60 >= 0.50
  });

  it('should return pieza_retenida_o_impactada for class 2', async () => {
    (mockOnnx.runInference as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      detections: [{ classIdx: 2, score: 0.47, x: 0.6, y: 0.6, width: 0.2, height: 0.2 }],
      modelName: 'liodon-ai/dental-panoramic-detector',
      version: '1.0.0-yolo11n',
      inferenceMs: 38,
    });

    const result = await useCase.execute({
      buffer: Buffer.from('fake'),
      nombreArchivo: 'rx.png',
      mimeType: 'image/png',
      tamanioBytes: 512,
    });

    expect(result.hallazgos[0]!.etiqueta).toBe('pieza_retenida_o_impactada');
    expect(result.hallazgos[0]!.severidad).toBe('BAJA'); // 0.47 < 0.50
  });

  it('should return estructura_normal when no detections exceed threshold', async () => {
    (mockOnnx.runInference as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      detections: [],
      modelName: 'liodon-ai/dental-panoramic-detector',
      version: '1.0.0-yolo11n',
      inferenceMs: 35,
    });

    const result = await useCase.execute({
      buffer: Buffer.from('fake'),
      nombreArchivo: 'rx.png',
      mimeType: 'image/png',
      tamanioBytes: 512,
    });

    expect(result.hallazgos).toHaveLength(1);
    expect(result.hallazgos[0]!.etiqueta).toBe('estructura_normal');
    expect(result.hallazgos[0]!.recomendacionClinica).toContain('sin hallazgos detectados por el modelo');
    expect(result.confianzaGlobal).toBe(0);
    expect(result.severidadMaxima).toBe('NINGUNA');
  });

  it('should include modeloNombre, version, fechaInferencia, and aviso fields', async () => {
    const result = await useCase.execute({
      buffer: Buffer.from('fake'),
      nombreArchivo: 'rx.jpg',
      mimeType: 'image/jpeg',
      tamanioBytes: 512,
    });

    expect(result.modeloNombre).toBe('liodon-ai/dental-panoramic-detector');
    expect(result.version).toBe('1.0.0-yolo11n');
    expect(result.fechaInferencia).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.aviso).toContain('CC-BY-NC-4.0');
    expect(result.aviso).toContain('apoyo de decisión clínica');
  });

  it('should compute confianzaGlobal as max detection score', async () => {
    (mockOnnx.runInference as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      detections: [
        { classIdx: 0, score: 0.72, x: 0.1, y: 0.1, width: 0.1, height: 0.1 },
        { classIdx: 1, score: 0.91, x: 0.5, y: 0.5, width: 0.1, height: 0.1 },
      ],
      modelName: 'liodon-ai/dental-panoramic-detector',
      version: '1.0.0-yolo11n',
      inferenceMs: 50,
    });

    const result = await useCase.execute({
      buffer: Buffer.from('fake'),
      nombreArchivo: 'rx.png',
      mimeType: 'image/png',
      tamanioBytes: 512,
    });

    expect(result.confianzaGlobal).toBe(0.91);
    expect(result.severidadMaxima).toBe('ALTA');
    expect(result.hallazgos).toHaveLength(2);
  });

  it('should throw BadRequestException when buffer is empty', async () => {
    await expect(
      useCase.execute({ buffer: Buffer.alloc(0), nombreArchivo: 'x.png', mimeType: 'image/png', tamanioBytes: 0 }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException when file exceeds 25 MB', async () => {
    await expect(
      useCase.execute({
        buffer: Buffer.alloc(10),
        nombreArchivo: 'big.png',
        mimeType: 'image/png',
        tamanioBytes: 26 * 1024 * 1024,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should propagate ServiceUnavailableException from ONNX model', async () => {
    (mockOnnx.runInference as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new ServiceUnavailableException({ codigo: 'MODELO_NO_DISPONIBLE' }),
    );

    await expect(
      useCase.execute({ buffer: Buffer.from('fake'), nombreArchivo: 'rx.png', mimeType: 'image/png', tamanioBytes: 512 }),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('should propagate BadRequestException from preprocessor for corrupt images', async () => {
    (mockPreprocessor.preprocess as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new BadRequestException('Archivo corrupto o formato inválido'),
    );

    await expect(
      useCase.execute({ buffer: Buffer.from('corrupt'), nombreArchivo: 'bad.bmp', mimeType: 'image/bmp', tamanioBytes: 100 }),
    ).rejects.toThrow(BadRequestException);
  });
});
