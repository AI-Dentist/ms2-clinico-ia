import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  HistoriaClinicaDocument,
  HistoriaClinicaSchema,
} from './infrastructure/persistence/mongo/schemas/historia-clinica.schema.js';
import { MongoHistoriaClinicaRepository } from './infrastructure/persistence/mongo/repositories/mongo-historia-clinica.repository.js';
import { MockPacienteValidatorAdapter } from './infrastructure/adapters/mock-paciente-validator.adapter.js';
import { MockOdontologoContextAdapter } from './infrastructure/adapters/mock-odontologo-context.adapter.js';
import { HISTORIA_CLINICA_REPOSITORY } from './domain/ports/historia-clinica.repository.port.js';
import { PACIENTE_VALIDATOR_PORT } from './domain/ports/paciente-validator.port.js';
import { ODONTOLOGO_CONTEXT_PORT } from './domain/ports/odontologo-context.port.js';

// Casos de uso de la capa Application
import {
  CrearHistoriaClinicaUseCase,
  ObtenerHistoriaPorIdUseCase,
  ObtenerHistoriaPorPacienteUseCase,
  ActualizarAntecedentesUseCase,
  AgregarAlergiaUseCase,
  EliminarAlergiaUseCase,
  ActualizarMedicamentosUseCase,
  CambiarEstadoHistoriaUseCase,
} from './application/index.js';

import { HistoriasClinicasController } from './infrastructure/http/controllers/historias-clinicas.controller.js';
import { OdontologoAuthGuard } from './infrastructure/http/guards/odontologo-auth.guard.js';

const USE_CASES = [
  CrearHistoriaClinicaUseCase,
  ObtenerHistoriaPorIdUseCase,
  ObtenerHistoriaPorPacienteUseCase,
  ActualizarAntecedentesUseCase,
  AgregarAlergiaUseCase,
  EliminarAlergiaUseCase,
  ActualizarMedicamentosUseCase,
  CambiarEstadoHistoriaUseCase,
];

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: HistoriaClinicaDocument.name, schema: HistoriaClinicaSchema },
    ]),
  ],
  controllers: [HistoriasClinicasController],
  providers: [
    OdontologoAuthGuard,
    {
      provide: HISTORIA_CLINICA_REPOSITORY,
      useClass: MongoHistoriaClinicaRepository,
    },
    {
      provide: PACIENTE_VALIDATOR_PORT,
      useClass: MockPacienteValidatorAdapter,
    },
    {
      provide: ODONTOLOGO_CONTEXT_PORT,
      useClass: MockOdontologoContextAdapter,
    },
    ...USE_CASES,
  ],
  exports: [HISTORIA_CLINICA_REPOSITORY, OdontologoAuthGuard, ...USE_CASES],
})
export class HistoriasClinicasModule {}
