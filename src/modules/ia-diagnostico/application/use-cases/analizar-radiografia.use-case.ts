import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import crypto from 'node:crypto';
import {
  IA_DIAGNOSTICO_MODEL_PORT,
  type IIaDiagnosticoModelPort,
} from '../../domain/ports/ia-diagnostico-model.port.js';
import { ImagePreprocessorService } from '../../infrastructure/image/image-preprocessor.service.js';
import { HallazgoIa } from '../../domain/enums/hallazgo-ia.enum.js';
import { SeveridadLesion } from '../../domain/enums/severidad-lesion.enum.js';
import { AnalisisRadiografia } from '../../domain/entities/analisis-radiografia.entity.js';
import type { AnalisisRadiografiaDto } from '../dtos/analisis-radiografia.dto.js';

export interface AnalizarRadiografiaCommand {
  buffer: Buffer;
  nombreArchivo: string;
  mimeType: string;
  tamanioBytes: number;
}

@Injectable()
export class AnalizarRadiografiaUseCase {
  constructor(
    @Inject(IA_DIAGNOSTICO_MODEL_PORT)
    private readonly iaModel: IIaDiagnosticoModelPort,
    private readonly preprocessor: ImagePreprocessorService,
  ) {}

  async execute(cmd: AnalizarRadiografiaCommand): Promise<AnalisisRadiografiaDto> {
    if (!cmd.buffer || cmd.buffer.length === 0) {
      throw new BadRequestException('El archivo de imagen radiográfica está vacío o corrupto.');
    }

    if (cmd.tamanioBytes > 15 * 1024 * 1024) {
      throw new BadRequestException('El archivo excede el tamaño máximo permitido de 15MB.');
    }

    // 1. Preprocesamiento: decodificación, escala de grises, resize y tensor normalizado
    const { tensor, anchoOriginal, altoOriginal, canales } =
      await this.preprocessor.preprocesarImagen(cmd.buffer, 64, 64);

    let inferencia;
    try {
      // 2. Inferencia con la Red Neuronal Convolucional (CNN)
      inferencia = await this.iaModel.ejecutarInferencia(tensor);
    } finally {
      // Garantizar que no existan fugas de memoria en TensorFlow.js
      tensor.dispose();
    }

    // 3. Mapeo clínico de hallazgos odontológicos
    const { hallazgo, severidad, clasificacion, recomendacionClinica } =
      this.clasificarHallazgoClinico(inferencia.probabilidadCaries);

    // 4. Instanciación de la entidad de dominio
    const entidad = AnalisisRadiografia.crear({
      id: `an_ia_${crypto.randomUUID()}`,
      probabilidadCaries: inferencia.probabilidadCaries,
      probabilidadSano: inferencia.probabilidadSano,
      confianza: inferencia.confianza,
      hallazgo,
      severidad,
      clasificacion,
      tiempoInferenciaMs: inferencia.tiempoInferenciaMs,
      recomendacionClinica,
      modeloInfo: {
        nombre: 'DeepDental-CNN',
        arquitectura: inferencia.arquitectura,
        version: inferencia.version,
      },
      metadataImagen: {
        nombreArchivo: cmd.nombreArchivo,
        mimeType: cmd.mimeType,
        tamanioBytes: cmd.tamanioBytes,
        anchoOriginal,
        altoOriginal,
        canales,
      },
      fechaAnalisis: new Date(),
    });

    return {
      id: entidad.id,
      probabilidadCaries: entidad.probabilidadCaries,
      probabilidadSano: entidad.probabilidadSano,
      confianza: entidad.confianza,
      hallazgo: entidad.hallazgo,
      severidad: entidad.severidad,
      clasificacion: entidad.clasificacion,
      tiempoInferenciaMs: entidad.tiempoInferenciaMs,
      recomendacionClinica: entidad.recomendacionClinica,
      modeloInfo: entidad.modeloInfo,
      metadataImagen: entidad.metadataImagen,
      fechaAnalisis: entidad.fechaAnalisis.toISOString(),
    };
  }

  private clasificarHallazgoClinico(probCaries: number): {
    hallazgo: HallazgoIa;
    severidad: SeveridadLesion;
    clasificacion: string;
    recomendacionClinica: string;
  } {
    if (probCaries >= 0.65) {
      return {
        hallazgo: HallazgoIa.CARIES_DETECTADA,
        severidad: SeveridadLesion.SEVERA,
        clasificacion: 'Caries dental cavitada / Lesión activa',
        recomendacionClinica:
          'Se detectó radiolucidez patológica compatible con caries cavitada. Se sugiere confirmación mediante examen clínico intraoral y restauración odontológica.',
      };
    }

    if (probCaries >= 0.35) {
      return {
        hallazgo: HallazgoIa.CARIES_INCIPIENTE,
        severidad: SeveridadLesion.LEVE,
        clasificacion: 'Sospecha de desmineralización o caries incipiente',
        recomendacionClinica:
          'Se aprecian áreas de desmineralización incipiente en esmalte o límite amelodentinario. Se recomienda barniz de flúor y control radiográfico en 6 meses.',
      };
    }

    return {
      hallazgo: HallazgoIa.ESTRUCTURA_SANA,
      severidad: SeveridadLesion.NINGUNA,
      clasificacion: 'Estructura dental radiográficamente sana',
      recomendacionClinica:
        'Densidad radiográfica homogénea sin evidencia de lesiones cariosas activas.',
    };
  }
}
