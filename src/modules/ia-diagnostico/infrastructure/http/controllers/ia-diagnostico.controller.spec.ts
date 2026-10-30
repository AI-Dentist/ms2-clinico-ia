import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { IaDiagnosticoController } from './ia-diagnostico.controller.js';
import type { AnalizarRadiografiaUseCase } from '../../../application/use-cases/analizar-radiografia.use-case.js';
import { HallazgoIa } from '../../../domain/enums/hallazgo-ia.enum.js';
import { SeveridadLesion } from '../../../domain/enums/severidad-lesion.enum.js';
import type { AnalisisRadiografiaDto } from '../../../application/dtos/analisis-radiografia.dto.js';

describe('IaDiagnosticoController', () => {
  let controller: IaDiagnosticoController;
  let mockUseCase: Partial<AnalizarRadiografiaUseCase>;

  const mockResultado: AnalisisRadiografiaDto = {
    id: 'an_ia_test_123',
    probabilidadCaries: 0.88,
    probabilidadSano: 0.12,
    confianza: 0.88,
    hallazgo: HallazgoIa.CARIES_DETECTADA,
    severidad: SeveridadLesion.SEVERA,
    clasificacion: 'Caries dental cavitada / Lesión activa',
    tiempoInferenciaMs: 15.2,
    recomendacionClinica: 'Se sugiere confirmación mediante examen clínico intraoral.',
    modeloInfo: {
      nombre: 'DeepDental-CNN',
      arquitectura: 'CNN-2D-DeepDental-v1',
      version: '1.0.0',
    },
    metadataImagen: {
      nombreArchivo: 'rx-molar.png',
      mimeType: 'image/png',
      tamanioBytes: 2048,
      anchoOriginal: 256,
      altoOriginal: 256,
      canales: 1,
    },
    fechaAnalisis: '2026-10-30T10:00:00.000Z',
  };

  beforeEach(() => {
    mockUseCase = {
      execute: vi.fn().mockResolvedValue(mockResultado),
    };
    controller = new IaDiagnosticoController(mockUseCase as AnalizarRadiografiaUseCase);
  });

  it('debe estar definido', () => {
    expect(controller).toBeDefined();
  });

  it('debe procesar un archivo multipart exitosamente y delegar al use case', async () => {
    const mockFile: Express.Multer.File = {
      fieldname: 'archivo',
      originalname: 'rx-molar.png',
      encoding: '7bit',
      mimetype: 'image/png',
      buffer: Buffer.from('test-image-content'),
      size: 2048,
      stream: null as any,
      destination: '',
      filename: '',
      path: '',
    };

    const resultado = await controller.analizarRadiografia(mockFile);

    expect(resultado).toEqual(mockResultado);
    expect(mockUseCase.execute).toHaveBeenCalledWith({
      buffer: mockFile.buffer,
      nombreArchivo: 'rx-molar.png',
      mimeType: 'image/png',
      tamanioBytes: 2048,
    });
  });

  it('debe lanzar BadRequestException si el archivo no es provisto', async () => {
    await expect(controller.analizarRadiografia(undefined)).rejects.toThrow(BadRequestException);
    await expect(controller.analizarRadiografia(undefined)).rejects.toThrow(
      'Debe adjuntar un archivo de imagen radiográfica',
    );
  });

  it('debe lanzar BadRequestException si el buffer del archivo está vacío', async () => {
    const mockEmptyFile: Express.Multer.File = {
      fieldname: 'archivo',
      originalname: 'empty.png',
      encoding: '7bit',
      mimetype: 'image/png',
      buffer: Buffer.alloc(0),
      size: 0,
      stream: null as any,
      destination: '',
      filename: '',
      path: '',
    };

    await expect(controller.analizarRadiografia(mockEmptyFile)).rejects.toThrow(BadRequestException);
  });
});
