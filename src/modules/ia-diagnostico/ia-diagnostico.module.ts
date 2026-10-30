import { Module } from '@nestjs/common';
import { HistoriasClinicasModule } from '../historias-clinicas/historias-clinicas.module.js';
import { AuthModule } from '../../infrastructure/auth/auth.module.js';
import { IA_DIAGNOSTICO_MODEL_PORT } from './domain/ports/ia-diagnostico-model.port.js';
import { CnnDentalModelService } from './infrastructure/cnn/cnn-dental-model.service.js';
import { ImagePreprocessorService } from './infrastructure/image/image-preprocessor.service.js';
import { AnalizarRadiografiaUseCase } from './application/use-cases/analizar-radiografia.use-case.js';
import { IaDiagnosticoController } from './infrastructure/http/controllers/ia-diagnostico.controller.js';

@Module({
  imports: [HistoriasClinicasModule, AuthModule],
  controllers: [IaDiagnosticoController],
  providers: [
    ImagePreprocessorService,
    CnnDentalModelService,
    {
      provide: IA_DIAGNOSTICO_MODEL_PORT,
      useClass: CnnDentalModelService,
    },
    AnalizarRadiografiaUseCase,
  ],
  exports: [
    AnalizarRadiografiaUseCase,
    IA_DIAGNOSTICO_MODEL_PORT,
    ImagePreprocessorService,
    CnnDentalModelService,
  ],
})
export class IaDiagnosticoModule {}
