import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ConsultaOdontologicaDocument,
  ConsultaOdontologicaSchema,
} from './infrastructure/persistence/mongo/schemas/consulta-odontologica.schema.js';
import { MongoConsultaOdontologicaRepository } from './infrastructure/persistence/mongo/repositories/mongo-consulta-odontologica.repository.js';
import { LocalHistoriaClinicaContextAdapter } from './infrastructure/adapters/local-historia-clinica-context.adapter.js';
import { MockCitaValidatorAdapter } from './infrastructure/adapters/mock-cita-validator.adapter.js';
import { MockOdontologoContextAdapter } from './infrastructure/adapters/mock-odontologo-context.adapter.js';
import { HistoriasClinicasModule } from '../historias-clinicas/historias-clinicas.module.js';

import { CONSULTA_ODONTOLOGICA_REPOSITORY } from './domain/ports/consulta-odontologica.repository.port.js';
import { HISTORIA_CLINICA_CONTEXT_PORT } from './domain/ports/historia-clinica-context.port.js';
import { CITA_VALIDATOR_PORT } from './domain/ports/cita-validator.port.js';
import { ODONTOLOGO_CONTEXT_PORT } from './domain/ports/odontologo-context.port.js';

// Casos de uso de la capa Application
import {
  RegistrarAperturaConsultaUseCase,
  ObtenerConsultaPorIdUseCase,
  ListarConsultasPorHistoriaUseCase,
  ActualizarAtencionConsultaUseCase,
  CompletarConsultaUseCase,
  CancelarConsultaUseCase,
} from './application/index.js';

const USE_CASES = [
  RegistrarAperturaConsultaUseCase,
  ObtenerConsultaPorIdUseCase,
  ListarConsultasPorHistoriaUseCase,
  ActualizarAtencionConsultaUseCase,
  CompletarConsultaUseCase,
  CancelarConsultaUseCase,
];

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ConsultaOdontologicaDocument.name, schema: ConsultaOdontologicaSchema },
    ]),
    HistoriasClinicasModule,
  ],
  controllers: [],
  providers: [
    {
      provide: CONSULTA_ODONTOLOGICA_REPOSITORY,
      useClass: MongoConsultaOdontologicaRepository,
    },
    {
      provide: HISTORIA_CLINICA_CONTEXT_PORT,
      useClass: LocalHistoriaClinicaContextAdapter,
    },
    {
      provide: CITA_VALIDATOR_PORT,
      useClass: MockCitaValidatorAdapter,
    },
    {
      provide: ODONTOLOGO_CONTEXT_PORT,
      useClass: MockOdontologoContextAdapter,
    },
    ...USE_CASES,
  ],
  exports: [CONSULTA_ODONTOLOGICA_REPOSITORY, ...USE_CASES],
})
export class ConsultasOdontologicasModule {}
