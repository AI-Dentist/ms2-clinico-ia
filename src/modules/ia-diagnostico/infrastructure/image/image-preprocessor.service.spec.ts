import { describe, it, expect, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import pngjs from 'pngjs';
import jpeg from 'jpeg-js';
import { ImagePreprocessorService } from './image-preprocessor.service.js';

const { PNG } = pngjs;

describe('ImagePreprocessorService', () => {
  let service: ImagePreprocessorService;

  beforeEach(() => {
    service = new ImagePreprocessorService();
  });

  it('debe preprocesar un buffer PNG válido generando un tensor 4D normalizado', async () => {
    // Generar un PNG simple de 8x8 en memoria
    const png = new PNG({ width: 8, height: 8 });
    for (let y = 0; y < png.height; y++) {
      for (let x = 0; x < png.width; x++) {
        const idx = (png.width * y + x) << 2;
        png.data[idx] = 120; // R
        png.data[idx + 1] = 120; // G
        png.data[idx + 2] = 120; // B
        png.data[idx + 3] = 255; // A
      }
    }
    const pngBuffer = PNG.sync.write(png);

    const resultado = await service.preprocesarImagen(pngBuffer, 64, 64);

    expect(resultado).toBeDefined();
    expect(resultado.anchoOriginal).toBe(8);
    expect(resultado.altoOriginal).toBe(8);
    expect(resultado.canales).toBe(1);
    expect(resultado.tensor.shape).toEqual([1, 64, 64, 1]);

    // Verificar que los valores estén normalizados entre 0 y 1
    const data = await resultado.tensor.data();
    expect(data.length).toBe(64 * 64);
    expect(data[0]).toBeGreaterThanOrEqual(0);
    expect(data[0]).toBeLessThanOrEqual(1);

    resultado.tensor.dispose();
  });

  it('debe preprocesar un buffer JPEG válido generando un tensor 4D normalizado', async () => {
    // Generar un JPEG simple de 8x8 en memoria
    const rawData = Buffer.alloc(8 * 8 * 4);
    for (let i = 0; i < 8 * 8; i++) {
      rawData[i * 4] = 200;
      rawData[i * 4 + 1] = 200;
      rawData[i * 4 + 2] = 200;
      rawData[i * 4 + 3] = 255;
    }
    const jpegBuffer = jpeg.encode({ data: rawData, width: 8, height: 8 }, 90).data;

    const resultado = await service.preprocesarImagen(jpegBuffer, 64, 64);

    expect(resultado).toBeDefined();
    expect(resultado.anchoOriginal).toBe(8);
    expect(resultado.altoOriginal).toBe(8);
    expect(resultado.tensor.shape).toEqual([1, 64, 64, 1]);

    resultado.tensor.dispose();
  });

  it('debe manejar buffers sintéticos arbitrarios mediante fallback seguro sin fallar', async () => {
    const syntheticBuffer = Buffer.from('mock_raw_dental_pixel_stream_data_1234567890');
    const resultado = await service.preprocesarImagen(syntheticBuffer, 64, 64);

    expect(resultado).toBeDefined();
    expect(resultado.tensor.shape).toEqual([1, 64, 64, 1]);
    expect(resultado.canales).toBe(1);

    resultado.tensor.dispose();
  });

  it('debe arrojar BadRequestException si el buffer está vacío', async () => {
    await expect(service.preprocesarImagen(Buffer.alloc(0))).rejects.toThrow(
      BadRequestException,
    );
  });
});
