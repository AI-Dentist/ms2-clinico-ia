import { Module } from '@nestjs/common';
import { HistoriasClinicasModule } from '../historias-clinicas/historias-clinicas.module.js';
import { AuthModule } from '../../infrastructure/auth/auth.module.js';
import { IaDiagnosticoController } from './infrastructure/http/controllers/ia-diagnostico.controller.js';
import {
  DentalOnnxModelService,
  DENTAL_ONNX_MODEL_PORT,
} from './infrastructure/onnx/dental-onnx-model.service.js';
import { OnnxImagePreprocessorService } from './infrastructure/image/onnx-image-preprocessor.service.js';
import { AnalizarImagenIaUseCase } from './application/use-cases/analizar-imagen-ia.use-case.js';

@Module({
  imports: [HistoriasClinicasModule, AuthModule],
  controllers: [IaDiagnosticoController],
  providers: [
    DentalOnnxModelService,
    {
      provide: DENTAL_ONNX_MODEL_PORT,
      useExisting: DentalOnnxModelService,
    },
    OnnxImagePreprocessorService,
    AnalizarImagenIaUseCase,
  ],
  exports: [
    DentalOnnxModelService,
    DENTAL_ONNX_MODEL_PORT,
    OnnxImagePreprocessorService,
    AnalizarImagenIaUseCase,
  ],
})
export class IaDiagnosticoModule {}
