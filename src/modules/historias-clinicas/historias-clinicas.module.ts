import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import {
  HistoriaClinicaDocument,
  HistoriaClinicaSchema,
} from './infrastructure/persistence/mongo/schemas/historia-clinica.schema.js';
import { MongoHistoriaClinicaRepository } from './infrastructure/persistence/mongo/repositories/mongo-historia-clinica.repository.js';
import { MockPacienteValidatorAdapter } from './infrastructure/adapters/mock-paciente-validator.adapter.js';
import { GraphqlMs1PacienteValidatorAdapter } from './infrastructure/adapters/graphql-ms1-paciente-validator.adapter.js';
import { MS1_CREDENTIALS_PROVIDER } from './infrastructure/adapters/ms1-credentials-provider.port.js';
import { EnvMs1CredentialsProvider } from './infrastructure/adapters/env-ms1-credentials-provider.adapter.js';
import { MockOdontologoContextAdapter } from './infrastructure/adapters/mock-odontologo-context.adapter.js';
import { KeycloakJwtOdontologoContextAdapter } from '../../infrastructure/auth/keycloak-jwt-odontologo-context.adapter.js';
import { AuthModule } from '../../infrastructure/auth/auth.module.js';
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
    ConfigModule,
    AuthModule,
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
    EnvMs1CredentialsProvider,
    {
      provide: MS1_CREDENTIALS_PROVIDER,
      useClass: EnvMs1CredentialsProvider,
    },
    MockPacienteValidatorAdapter,
    GraphqlMs1PacienteValidatorAdapter,
    {
      provide: PACIENTE_VALIDATOR_PORT,
      useFactory: (
        graphqlAdapter: GraphqlMs1PacienteValidatorAdapter,
        mockAdapter: MockPacienteValidatorAdapter,
        configService?: ConfigService,
      ) => {
        const adapterMode =
          configService?.get<string>('PACIENTE_VALIDATOR_ADAPTER') ??
          process.env.PACIENTE_VALIDATOR_ADAPTER ??
          'mock';

        if (adapterMode === 'graphql') {
          return graphqlAdapter;
        }
        return mockAdapter;
      },
      inject: [
        GraphqlMs1PacienteValidatorAdapter,
        MockPacienteValidatorAdapter,
        { token: ConfigService, optional: true },
      ],
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
    ...USE_CASES,
  ],
  exports: [
    HISTORIA_CLINICA_REPOSITORY,
    PACIENTE_VALIDATOR_PORT,
    MS1_CREDENTIALS_PROVIDER,
    GraphqlMs1PacienteValidatorAdapter,
    MockPacienteValidatorAdapter,
    ODONTOLOGO_CONTEXT_PORT,
    OdontologoAuthGuard,
    ...USE_CASES,
  ],
})
export class HistoriasClinicasModule {}
