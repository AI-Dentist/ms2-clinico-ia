import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as tf from '@tensorflow/tfjs';
import { CnnDentalModelService } from './cnn-dental-model.service.js';

describe('CnnDentalModelService (Deep Learning CNN)', () => {
  let service: CnnDentalModelService;

  beforeEach(async () => {
    service = new CnnDentalModelService();
    await service.onModuleInit();
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it('debe inicializar y compilar el modelo convolucional secuencial', () => {
    expect(service).toBeDefined();
  });

  it('debe ejecutar inferencia probabilística sobre un tensor 4D de imagen médica [1, 64, 64, 1]', async () => {
    // Generar un tensor de prueba sintético normalizado [0, 1]
    const tensorInput = tf.tidy(() => {
      const buffer = new Float32Array(64 * 64).fill(0.5);
      return tf.tensor4d(buffer, [1, 64, 64, 1]);
    });

    try {
      const resultado = await service.ejecutarInferencia(tensorInput);

      expect(resultado).toBeDefined();
      expect(resultado.arquitectura).toBe('CNN-2D-DeepDental-v1');
      expect(resultado.version).toBe('1.0.0');
      expect(typeof resultado.probabilidadCaries).toBe('number');
      expect(resultado.probabilidadCaries).toBeGreaterThanOrEqual(0);
      expect(resultado.probabilidadCaries).toBeLessThanOrEqual(1);

      expect(typeof resultado.probabilidadSano).toBe('number');
      expect(resultado.probabilidadSano).toBeGreaterThanOrEqual(0);
      expect(resultado.probabilidadSano).toBeLessThanOrEqual(1);

      // La suma de probabilidades softmax debe ser cercana a 1.0 (con redondeo)
      const suma = resultado.probabilidadCaries + resultado.probabilidadSano;
      expect(suma).toBeGreaterThanOrEqual(0.98);
      expect(suma).toBeLessThanOrEqual(1.02);

      expect(typeof resultado.confianza).toBe('number');
      expect(resultado.confianza).toBeGreaterThanOrEqual(0.5);
      expect(typeof resultado.tiempoInferenciaMs).toBe('number');
    } finally {
      tensorInput.dispose();
    }
  });

  it('debe autocompilar el modelo si ejecutarInferencia se llama antes de onModuleInit', async () => {
    const freshService = new CnnDentalModelService();
    const tensorInput = tf.tidy(() => {
      const buffer = new Float32Array(64 * 64).fill(0.1);
      return tf.tensor4d(buffer, [1, 64, 64, 1]);
    });

    try {
      const resultado = await freshService.ejecutarInferencia(tensorInput);
      expect(resultado).toBeDefined();
      expect(resultado.probabilidadCaries).toBeDefined();
    } finally {
      tensorInput.dispose();
      freshService.onModuleDestroy();
    }
  });
});
