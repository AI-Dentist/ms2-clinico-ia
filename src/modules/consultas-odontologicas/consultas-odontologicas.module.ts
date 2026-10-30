import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ConsultaOdontologicaDocument,
  ConsultaOdontologicaSchema,
} from './infrastructure/persistence/mongo/schemas/consulta-odontologica.schema.js';
import { MongoConsultaOdontologicaRepository } from './infrastructure/persistence/mongo/repositories/mongo-consulta-odontologica.repository.js';
import { LocalHistoriaClinicaContextAdapter } from './infrastructure/adapters/local-historia-clinica-context.adapter.js';
import { MockCitaValidatorAdapter } from './infrastructure/adapters/mock-cita-validator.adapter.js';
import { MockOdontologoContextAdapter } from './infrastructure/adapters/mock-odontologo-context.adapter.js';
import { KeycloakJwtOdontologoContextAdapter } from '../../infrastructure/auth/keycloak-jwt-odontologo-context.adapter.js';
import { AuthModule } from '../../infrastructure/auth/auth.module.js';
import { MockCatalogoServiciosAdapter } from './infrastructure/adapters/mock-catalogo-servicios.adapter.js';
import { GraphqlMs1CatalogoServiciosAdapter } from './infrastructure/adapters/graphql-ms1-catalogo-servicios.adapter.js';
import { HistoriasClinicasModule } from '../historias-clinicas/historias-clinicas.module.js';
import { OutboxModule } from '../outbox/outbox.module.js';

import { CONSULTA_ODONTOLOGICA_REPOSITORY } from './domain/ports/consulta-odontologica.repository.port.js';
import { HISTORIA_CLINICA_CONTEXT_PORT } from './domain/ports/historia-clinica-context.port.js';
import { CITA_VALIDATOR_PORT } from './domain/ports/cita-validator.port.js';
import { ODONTOLOGO_CONTEXT_PORT } from './domain/ports/odontologo-context.port.js';
import { CATALOGO_SERVICIOS_PORT } from './application/ports/catalogo-servicios.port.js';
import { UNIT_OF_WORK_CIERRE_CONSULTA_PORT } from './application/ports/unit-of-work-cierre-consulta.port.js';
import { MongoUnitOfWorkCierreConsultaAdapter } from './infrastructure/persistence/mongo/unit-of-work-cierre-consulta.adapter.js';

// Casos de uso de la capa Application
import {
  RegistrarAperturaConsultaUseCase,
  ObtenerConsultaPorIdUseCase,
  ListarConsultasPorHistoriaUseCase,
  ActualizarAtencionConsultaUseCase,
  CompletarConsultaUseCase,
  CancelarConsultaUseCase,
  ConsultarCatalogoServiciosUseCase,
} from './application/index.js';

import { ConsultasOdontologicasController } from './infrastructure/http/controllers/consultas-odontologicas.controller.js';
import { OdontologoAuthGuard } from './infrastructure/http/guards/odontologo-auth.guard.js';

const USE_CASES = [
  RegistrarAperturaConsultaUseCase,
  ObtenerConsultaPorIdUseCase,
  ListarConsultasPorHistoriaUseCase,
  ActualizarAtencionConsultaUseCase,
  CompletarConsultaUseCase,
  CancelarConsultaUseCase,
  ConsultarCatalogoServiciosUseCase,
];

@Module({
  imports: [
    ConfigModule,
    AuthModule,
    MongooseModule.forFeature([
      { name: ConsultaOdontologicaDocument.name, schema: ConsultaOdontologicaSchema },
    ]),
    HistoriasClinicasModule,
    OutboxModule,
  ],
  controllers: [ConsultasOdontologicasController],
  providers: [
    OdontologoAuthGuard,
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
    MockOdontologoContextAdapter,
    KeycloakJwtOdontologoContextAdapter,
    {
      provide: ODONTOLOGO_CONTEXT_PORT,
      useFactory: (
        keycloakAdapter: KeycloakJwtOdontologoContextAdapter,
        mockAdapter: MockOdontologoContextAdapter,
        configService?: ConfigService,
      ) => {
        const mode =
          configService?.get<string>('ODONTOLOGO_AUTH_ADAPTER') ??
          process.env.ODONTOLOGO_AUTH_ADAPTER ??
          'keycloak';
        if (mode === 'mock') {
          return mockAdapter;
        }
        return keycloakAdapter;
      },
      inject: [
        KeycloakJwtOdontologoContextAdapter,
        MockOdontologoContextAdapter,
        { token: ConfigService, optional: true },
      ],
    },
    MockCatalogoServiciosAdapter,
    GraphqlMs1CatalogoServiciosAdapter,
    {
      provide: CATALOGO_SERVICIOS_PORT,
      useFactory: (
        mockAdapter: MockCatalogoServiciosAdapter,
        graphqlAdapter: GraphqlMs1CatalogoServiciosAdapter,
        configService?: ConfigService,
      ) => {
        const raw = configService?.get<string>('CATALOGO_SERVICIOS_ADAPTER');
        const modo =
          typeof raw === 'string'
            ? raw.trim().toLowerCase()
            : (process.env.CATALOGO_SERVICIOS_ADAPTER ?? 'mock').trim().toLowerCase();

        if (modo === 'graphql') {
          return graphqlAdapter;
        }
        return mockAdapter;
      },
      inject: [
        MockCatalogoServiciosAdapter,
        GraphqlMs1CatalogoServiciosAdapter,
        { token: ConfigService, optional: true },
      ],
    },
    {
      provide: UNIT_OF_WORK_CIERRE_CONSULTA_PORT,
      useClass: MongoUnitOfWorkCierreConsultaAdapter,
    },
    ...USE_CASES,
  ],
  exports: [
    CONSULTA_ODONTOLOGICA_REPOSITORY,
    CATALOGO_SERVICIOS_PORT,
    UNIT_OF_WORK_CIERRE_CONSULTA_PORT,
    MockCatalogoServiciosAdapter,
    GraphqlMs1CatalogoServiciosAdapter,
    ...USE_CASES,
  ],
})
export class ConsultasOdontologicasModule {}

