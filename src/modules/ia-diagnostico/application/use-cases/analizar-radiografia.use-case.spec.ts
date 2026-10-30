import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import * as tf from '@tensorflow/tfjs';
import { AnalizarRadiografiaUseCase } from './analizar-radiografia.use-case.js';
import type { IIaDiagnosticoModelPort } from '../../domain/ports/ia-diagnostico-model.port.js';
import type { ImagePreprocessorService } from '../../infrastructure/image/image-preprocessor.service.js';
import { HallazgoIa } from '../../domain/enums/hallazgo-ia.enum.js';
import { SeveridadLesion } from '../../domain/enums/severidad-lesion.enum.js';

describe('AnalizarRadiografiaUseCase', () => {
  let useCase: AnalizarRadiografiaUseCase;
  let mockIaModel: IIaDiagnosticoModelPort;
  let mockPreprocessor: ImagePreprocessorService;
  let mockTensor: tf.Tensor4D;
  let disposeSpy: any;

  beforeEach(() => {
    mockTensor = tf.zeros([1, 64, 64, 1]);
    disposeSpy = vi.spyOn(mockTensor, 'dispose');

    mockIaModel = {
      ejecutarInferencia: vi.fn().mockResolvedValue({
        probabilidadCaries: 0.85,
        probabilidadSano: 0.15,
        confianza: 0.85,
        tiempoInferenciaMs: 14.5,
        arquitectura: 'CNN-2D-DeepDental-v1',
        version: '1.0.0',
      }),
    };

    mockPreprocessor = {
      preprocesarImagen: vi.fn().mockResolvedValue({
        tensor: mockTensor,
        anchoOriginal: 256,
        altoOriginal: 256,
        canales: 1,
      }),
    } as unknown as ImagePreprocessorService;

    useCase = new AnalizarRadiografiaUseCase(mockIaModel, mockPreprocessor);
  });

  it('debe analizar exitosamente una radiografía con caries severa (>0.65)', async () => {
    const cmd = {
      buffer: Buffer.from('fake-image-bytes'),
      nombreArchivo: 'periapical-molar.png',
      mimeType: 'image/png',
      tamanioBytes: 1024,
    };

    const resultado = await useCase.execute(cmd);

    expect(resultado).toBeDefined();
    expect(resultado.id).toMatch(/^an_ia_/);
    expect(resultado.probabilidadCaries).toBe(0.85);
    expect(resultado.hallazgo).toBe(HallazgoIa.CARIES_DETECTADA);
    expect(resultado.severidad).toBe(SeveridadLesion.SEVERA);
    expect(resultado.clasificacion).toContain('Caries dental cavitada');
    expect(resultado.recomendacionClinica).toContain('Se detectó radiolucidez');
    expect(resultado.modeloInfo.nombre).toBe('DeepDental-CNN');
    expect(resultado.metadataImagen.nombreArchivo).toBe('periapical-molar.png');
    expect(disposeSpy).toHaveBeenCalled();
  });

  it('debe clasificar como caries incipiente cuando la probabilidad está entre 0.35 y 0.65', async () => {
    (mockIaModel.ejecutarInferencia as any).mockResolvedValueOnce({
      probabilidadCaries: 0.45,
      probabilidadSano: 0.55,
      confianza: 0.55,
      tiempoInferenciaMs: 12.0,
      arquitectura: 'CNN-2D-DeepDental-v1',
      version: '1.0.0',
    });

    const resultado = await useCase.execute({
      buffer: Buffer.from('fake-image-bytes'),
      nombreArchivo: 'interproximal.jpg',
      mimeType: 'image/jpeg',
      tamanioBytes: 2048,
    });

    expect(resultado.hallazgo).toBe(HallazgoIa.CARIES_INCIPIENTE);
    expect(resultado.severidad).toBe(SeveridadLesion.LEVE);
    expect(resultado.clasificacion).toContain('Sospecha de desmineralización');
    expect(disposeSpy).toHaveBeenCalled();
  });

  it('debe clasificar como estructura sana cuando la probabilidad es menor a 0.35', async () => {
    (mockIaModel.ejecutarInferencia as any).mockResolvedValueOnce({
      probabilidadCaries: 0.08,
      probabilidadSano: 0.92,
      confianza: 0.92,
      tiempoInferenciaMs: 10.0,
      arquitectura: 'CNN-2D-DeepDental-v1',
      version: '1.0.0',
    });

    const resultado = await useCase.execute({
      buffer: Buffer.from('healthy-teeth-image'),
      nombreArchivo: 'panoramica-sana.png',
      mimeType: 'image/png',
      tamanioBytes: 4096,
    });

    expect(resultado.hallazgo).toBe(HallazgoIa.ESTRUCTURA_SANA);
    expect(resultado.severidad).toBe(SeveridadLesion.NINGUNA);
    expect(resultado.clasificacion).toContain('Estructura dental radiográficamente sana');
    expect(disposeSpy).toHaveBeenCalled();
  });

  it('debe liberar el tensor en finally incluso si la inferencia arroja un error', async () => {
    (mockIaModel.ejecutarInferencia as any).mockRejectedValueOnce(
      new Error('TensorFlow inference error'),
    );

    await expect(
      useCase.execute({
        buffer: Buffer.from('corrupted-data'),
        nombreArchivo: 'fail.png',
        mimeType: 'image/png',
        tamanioBytes: 100,
      }),
    ).rejects.toThrow('TensorFlow inference error');

    expect(disposeSpy).toHaveBeenCalled();
  });

  it('debe lanzar BadRequestException si el buffer está vacío', async () => {
    await expect(
      useCase.execute({
        buffer: Buffer.alloc(0),
        nombreArchivo: 'vacio.png',
        mimeType: 'image/png',
        tamanioBytes: 0,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('debe lanzar BadRequestException si el tamaño excede 15MB', async () => {
    await expect(
      useCase.execute({
        buffer: Buffer.alloc(10),
        nombreArchivo: 'gigante.png',
        mimeType: 'image/png',
        tamanioBytes: 16 * 1024 * 1024,
      }),
    ).rejects.toThrow(/excede el tamaño máximo/);
  });
});
