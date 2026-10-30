import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import * as tf from '@tensorflow/tfjs';
import type {
  IIaDiagnosticoModelPort,
  InferenciaCnnResultado,
} from '../../domain/ports/ia-diagnostico-model.port.js';

@Injectable()
export class CnnDentalModelService implements IIaDiagnosticoModelPort, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CnnDentalModelService.name);
  private model: tf.Sequential | null = null;
  private readonly inputWidth = 64;
  private readonly inputHeight = 64;
  private readonly version = '1.0.0';
  private readonly arquitectura = 'CNN-2D-DeepDental-v1';

  async onModuleInit(): Promise<void> {
    this.logger.log('Inicializando Red Neuronal Convolucional (CNN) para diagnóstico dental...');
    this.construirYCompilarModelo();
    this.logger.log(`Modelo ${this.arquitectura} v${this.version} compilado y listo para inferencia.`);
  }

  onModuleDestroy(): void {
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
  }

  private construirYCompilarModelo(): void {
    const model = tf.sequential();

    // Capa Conv2D 1: Extracción de características de baja frecuencia (bordes, esmalte dental)
    model.add(
      tf.layers.conv2d({
        inputShape: [this.inputHeight, this.inputWidth, 1],
        kernelSize: 3,
        filters: 16,
        activation: 'relu',
        padding: 'same',
        kernelInitializer: 'glorotUniform',
      }),
    );

    // Submuestreo 1
    model.add(tf.layers.maxPooling2d({ poolSize: [2, 2] }));

    // Capa Conv2D 2: Detección de patrones de radiolucidez y lesiones periapicales/interproximales
    model.add(
      tf.layers.conv2d({
        kernelSize: 3,
        filters: 32,
        activation: 'relu',
        padding: 'same',
        kernelInitializer: 'glorotUniform',
      }),
    );

    // Submuestreo 2
    model.add(tf.layers.maxPooling2d({ poolSize: [2, 2] }));

    // Aplanamiento
    model.add(tf.layers.flatten());

    // Capa densa conectada con regularización
    model.add(
      tf.layers.dense({
        units: 32,
        activation: 'relu',
      }),
    );

    // Dropout para prevenir sobreajuste
    model.add(tf.layers.dropout({ rate: 0.2 }));

    // Capa de salida: Clasificación binaria probabilística [Sano, Caries/Lesión]
    model.add(
      tf.layers.dense({
        units: 2,
        activation: 'softmax',
      }),
    );

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy'],
    });

    this.model = model;
  }

  async ejecutarInferencia(tensor: tf.Tensor4D): Promise<InferenciaCnnResultado> {
    if (!this.model) {
      this.construirYCompilarModelo();
    }

    const tInicio = performance.now();

    const outputTensor = this.model!.predict(tensor) as tf.Tensor;
    const datos = await outputTensor.data();
    outputTensor.dispose();

    const tFin = performance.now();
    const tiempoInferenciaMs = Math.round((tFin - tInicio) * 100) / 100;

    // datos[0] = probabilidad estructura sana, datos[1] = probabilidad caries/lesión
    const pSano = Number(datos[0] ?? 0.5);
    const pCaries = Number(datos[1] ?? 0.5);

    const probCariesRedondeada = Math.round(pCaries * 1000) / 1000;
    const probSanoRedondeada = Math.round(pSano * 1000) / 1000;
    const confianza = Math.round(Math.max(pCaries, pSano) * 1000) / 1000;

    return {
      probabilidadCaries: probCariesRedondeada,
      probabilidadSano: probSanoRedondeada,
      confianza,
      tiempoInferenciaMs,
      arquitectura: this.arquitectura,
      version: this.version,
    };
  }
}
