import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  LaboratorioMongo,
  LaboratorioSchema,
} from './infrastructure/persistence/mongo/schemas/laboratorio.schema.js';
import {
  TipoEstudioMongo,
  TipoEstudioSchema,
} from './infrastructure/persistence/mongo/schemas/tipo-estudio.schema.js';
import {
  SolicitudEstudioMongo,
  SolicitudEstudioSchema,
} from './infrastructure/persistence/mongo/schemas/solicitud-estudio.schema.js';

import { LABORATORIO_REPOSITORY } from './domain/ports/laboratorio.repository.port.js';
import { TIPO_ESTUDIO_REPOSITORY } from './domain/ports/tipo-estudio.repository.port.js';
import { SOLICITUD_ESTUDIO_REPOSITORY } from './domain/ports/solicitud-estudio.repository.port.js';
import { CONSULTA_CONTEXT_PORT } from './domain/ports/consulta-context.port.js';
import { ODONTOLOGO_CONTEXT_PORT } from './domain/ports/odontologo-context.port.js';

import { MongoLaboratorioRepository } from './infrastructure/persistence/mongo/repositories/mongo-laboratorio.repository.js';
import { MongoTipoEstudioRepository } from './infrastructure/persistence/mongo/repositories/mongo-tipo-estudio.repository.js';
import { MongoSolicitudEstudioRepository } from './infrastructure/persistence/mongo/repositories/mongo-solicitud-estudio.repository.js';

import { LocalConsultaContextAdapter } from './infrastructure/adapters/local-consulta-context.adapter.js';
import { MockOdontologoContextAdapter } from './infrastructure/adapters/mock-odontologo-context.adapter.js';
import { KeycloakJwtOdontologoContextAdapter } from '../../infrastructure/auth/keycloak-jwt-odontologo-context.adapter.js';
import { AuthModule } from '../../infrastructure/auth/auth.module.js';
import { IaDiagnosticoModule } from '../ia-diagnostico/ia-diagnostico.module.js';

import { ConsultasOdontologicasModule } from '../consultas-odontologicas/consultas-odontologicas.module.js';
import { ConfigModule, ConfigService } from '@nestjs/config';

import {
  CrearLaboratorioUseCase,
  ListarLaboratoriosUseCase,
  ObtenerLaboratorioPorIdUseCase,
  ActualizarLaboratorioUseCase,
  CambiarEstadoLaboratorioUseCase,
} from './application/use-cases/laboratorios.use-cases.js';

import {
  CrearTipoEstudioUseCase,
  ListarTiposEstudioUseCase,
  ObtenerTipoEstudioPorIdUseCase,
  ActualizarTipoEstudioUseCase,
  CambiarEstadoTipoEstudioUseCase,
} from './application/use-cases/tipos-estudio.use-cases.js';

import {
  CrearSolicitudEstudioUseCase,
  ListarSolicitudesPorConsultaUseCase,
  ListarSolicitudesPorHistoriaUseCase,
  ObtenerSolicitudEstudioPorIdUseCase,
  CambiarEstadoSolicitudUseCase,
  RegistrarResultadoEstudioUseCase,
  AdjuntarArchivoEstudioUseCase,
} from './application/use-cases/solicitudes-estudio.use-cases.js';

import { LaboratoriosController } from './infrastructure/http/controllers/laboratorios.controller.js';
import { TiposEstudiosController } from './infrastructure/http/controllers/tipos-estudios.controller.js';
import { EstudiosController } from './infrastructure/http/controllers/estudios.controller.js';
import { OdontologoAuthGuard } from './infrastructure/http/guards/odontologo-auth.guard.js';

const USE_CASES = [
  CrearLaboratorioUseCase,
  ListarLaboratoriosUseCase,
  ObtenerLaboratorioPorIdUseCase,
  ActualizarLaboratorioUseCase,
  CambiarEstadoLaboratorioUseCase,
  CrearTipoEstudioUseCase,
  ListarTiposEstudioUseCase,
  ObtenerTipoEstudioPorIdUseCase,
  ActualizarTipoEstudioUseCase,
  CambiarEstadoTipoEstudioUseCase,
  CrearSolicitudEstudioUseCase,
  ListarSolicitudesPorConsultaUseCase,
  ListarSolicitudesPorHistoriaUseCase,
  ObtenerSolicitudEstudioPorIdUseCase,
  CambiarEstadoSolicitudUseCase,
  RegistrarResultadoEstudioUseCase,
  AdjuntarArchivoEstudioUseCase,
];

@Module({
  imports: [
    ConfigModule,
    AuthModule,
    IaDiagnosticoModule,
    MongooseModule.forFeature([
      { name: LaboratorioMongo.name, schema: LaboratorioSchema },
      { name: TipoEstudioMongo.name, schema: TipoEstudioSchema },
      { name: SolicitudEstudioMongo.name, schema: SolicitudEstudioSchema },
    ]),
    ConsultasOdontologicasModule,
  ],
  controllers: [
    LaboratoriosController,
    TiposEstudiosController,
    EstudiosController,
  ],
  providers: [
    OdontologoAuthGuard,
    {
      provide: LABORATORIO_REPOSITORY,
      useClass: MongoLaboratorioRepository,
    },
    {
      provide: TIPO_ESTUDIO_REPOSITORY,
      useClass: MongoTipoEstudioRepository,
    },
    {
      provide: SOLICITUD_ESTUDIO_REPOSITORY,
      useClass: MongoSolicitudEstudioRepository,
    },
    {
      provide: CONSULTA_CONTEXT_PORT,
      useClass: LocalConsultaContextAdapter,
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
    LABORATORIO_REPOSITORY,
    TIPO_ESTUDIO_REPOSITORY,
    SOLICITUD_ESTUDIO_REPOSITORY,
    ...USE_CASES,
  ],
})
export class EstudiosModule {}
