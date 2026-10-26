import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HistoriasClinicasModule } from '../historias-clinicas/historias-clinicas.module.js';
import { ConsultasOdontologicasModule } from '../consultas-odontologicas/consultas-odontologicas.module.js';

// Schemas & Persistence
import {
  OdontogramaDocument,
  OdontogramaSchema,
} from './infrastructure/persistence/mongo/schemas/odontograma.schema.js';
import {
  RevisionOdontogramaDocument,
  RevisionOdontogramaSchema,
} from './infrastructure/persistence/mongo/schemas/revision-odontograma.schema.js';
import { MongoOdontogramaRepository } from './infrastructure/persistence/mongo/repositories/mongo-odontograma.repository.js';
import { ODONTOGRAMA_REPOSITORY } from './domain/ports/odontograma.repository.port.js';

// Context Adapters & Ports
import { LocalHistoriaClinicaContextAdapter } from './infrastructure/adapters/local-historia-clinica-context.adapter.js';
import { LocalConsultaOdontologicaContextAdapter } from './infrastructure/adapters/local-consulta-odontologica-context.adapter.js';
import { MockOdontologoContextAdapter } from './infrastructure/adapters/mock-odontologo-context.adapter.js';
import { HISTORIA_CLINICA_CONTEXT_PORT } from './application/ports/historia-clinica-context.port.js';
import { CONSULTA_ODONTOLOGICA_CONTEXT_PORT } from './application/ports/consulta-odontologica-context.port.js';
import { ODONTOLOGO_CONTEXT_PORT } from './application/ports/odontologo-context.port.js';

// Application Use Cases
import {
  InicializarOdontogramaUseCase,
  ObtenerOdontogramaActualUseCase,
  RegistrarRevisionOdontogramaUseCase,
  ListarHistorialRevisionesUseCase,
  ObtenerSnapshotRevisionUseCase,
  ObtenerSnapshotsPorConsultaUseCase,
} from './application/index.js';

import { OdontogramasController } from './infrastructure/http/controllers/odontogramas.controller.js';
import { OdontologoAuthGuard } from './infrastructure/http/guards/odontologo-auth.guard.js';

const USE_CASES = [
  InicializarOdontogramaUseCase,
  ObtenerOdontogramaActualUseCase,
  RegistrarRevisionOdontogramaUseCase,
  ListarHistorialRevisionesUseCase,
  ObtenerSnapshotRevisionUseCase,
  ObtenerSnapshotsPorConsultaUseCase,
];

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: OdontogramaDocument.name, schema: OdontogramaSchema },
      { name: RevisionOdontogramaDocument.name, schema: RevisionOdontogramaSchema },
    ]),
    HistoriasClinicasModule,
    ConsultasOdontologicasModule,
  ],
  controllers: [OdontogramasController],
  providers: [
    {
      provide: ODONTOGRAMA_REPOSITORY,
      useClass: MongoOdontogramaRepository,
    },
    {
      provide: HISTORIA_CLINICA_CONTEXT_PORT,
      useClass: LocalHistoriaClinicaContextAdapter,
    },
    {
      provide: CONSULTA_ODONTOLOGICA_CONTEXT_PORT,
      useClass: LocalConsultaOdontologicaContextAdapter,
    },
    {
      provide: ODONTOLOGO_CONTEXT_PORT,
      useFactory: () => {
        const env = process.env.NODE_ENV;
        if (env !== 'development' && env !== 'test') {
          throw new Error(
            `CRÍTICO: MockOdontologoContextAdapter deshabilitado por política de seguridad. Solo está permitido en entornos 'development' o 'test' (entorno actual: '${env || 'no configurado'}').`
          );
        }
        return new MockOdontologoContextAdapter();
      },
    },
    OdontologoAuthGuard,
    ...USE_CASES,
  ],
  exports: [
    ODONTOGRAMA_REPOSITORY,
    HISTORIA_CLINICA_CONTEXT_PORT,
    CONSULTA_ODONTOLOGICA_CONTEXT_PORT,
    ODONTOLOGO_CONTEXT_PORT,
    OdontologoAuthGuard,
    ...USE_CASES,
  ],
})
export class OdontogramasModule {}
