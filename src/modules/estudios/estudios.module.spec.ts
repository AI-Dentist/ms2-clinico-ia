import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Module, Global } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken, getConnectionToken } from '@nestjs/mongoose';

import { EstudiosModule } from './estudios.module.js';
import { LaboratorioMongo } from './infrastructure/persistence/mongo/schemas/laboratorio.schema.js';
import { TipoEstudioMongo } from './infrastructure/persistence/mongo/schemas/tipo-estudio.schema.js';
import { SolicitudEstudioMongo } from './infrastructure/persistence/mongo/schemas/solicitud-estudio.schema.js';
import { ConsultaOdontologicaDocument } from '../consultas-odontologicas/infrastructure/persistence/mongo/schemas/consulta-odontologica.schema.js';
import { HistoriaClinicaDocument } from '../historias-clinicas/infrastructure/persistence/mongo/schemas/historia-clinica.schema.js';
import { OutboxEventDocument } from '../outbox/infrastructure/persistence/mongo/schemas/outbox-event.schema.js';

import { ODONTOLOGO_CONTEXT_PORT } from './domain/ports/odontologo-context.port.js';
import { MockOdontologoContextAdapter } from './infrastructure/adapters/mock-odontologo-context.adapter.js';
import { KeycloakJwtOdontologoContextAdapter } from '../../infrastructure/auth/keycloak-jwt-odontologo-context.adapter.js';

describe('EstudiosModule (NestJS DI & Provider Security Wiring)', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalAdapter = process.env.ODONTOLOGO_AUTH_ADAPTER;

  const mockModel = {
    create: vi.fn(),
    updateOne: vi.fn(),
    findById: vi.fn(),
    findOne: vi.fn(),
    find: vi.fn(),
  };

  const mockConnection = {
    startSession: vi.fn(),
    getClient: vi.fn().mockReturnValue({ topology: { description: { type: 'ReplicaSetWithPrimary' } } }),
  };

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    delete process.env.ODONTOLOGO_AUTH_ADAPTER;
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    if (originalAdapter !== undefined) {
      process.env.ODONTOLOGO_AUTH_ADAPTER = originalAdapter;
    } else {
      delete process.env.ODONTOLOGO_AUTH_ADAPTER;
    }
  });

  @Global()
  @Module({
    providers: [
      {
        provide: getConnectionToken(),
        useValue: mockConnection,
      },
    ],
    exports: [getConnectionToken()],
  })
  class MockDatabaseModule {}

  async function crearModuloPrueba(): Promise<TestingModule> {
    return Test.createTestingModule({
      imports: [MockDatabaseModule, EstudiosModule],
    })
      .overrideProvider(getModelToken(LaboratorioMongo.name))
      .useValue(mockModel)
      .overrideProvider(getModelToken(TipoEstudioMongo.name))
      .useValue(mockModel)
      .overrideProvider(getModelToken(SolicitudEstudioMongo.name))
      .useValue(mockModel)
      .overrideProvider(getModelToken(ConsultaOdontologicaDocument.name))
      .useValue(mockModel)
      .overrideProvider(getModelToken(HistoriaClinicaDocument.name))
      .useValue(mockModel)
      .overrideProvider(getModelToken(OutboxEventDocument.name))
      .useValue(mockModel)
      .compile();
  }

  it.each([undefined, 'keycloak'])(
    '1. debe resolver KeycloakJwtOdontologoContextAdapter en production con adapter=%s',
    async (adapter) => {
      process.env.NODE_ENV = 'production';
      if (adapter) process.env.ODONTOLOGO_AUTH_ADAPTER = adapter;
      else delete process.env.ODONTOLOGO_AUTH_ADAPTER;

      const moduleRef = await crearModuloPrueba();
      const port = moduleRef.get(ODONTOLOGO_CONTEXT_PORT);

      expect(port).toBeDefined();
      expect(port).toBeInstanceOf(KeycloakJwtOdontologoContextAdapter);
    },
  );

  it.each(['production', 'staging', undefined])(
    '2. debe rechazar de forma segura mock en entornos no autorizados (NODE_ENV=%s)',
    async (env) => {
      process.env.ODONTOLOGO_AUTH_ADAPTER = 'mock';
      if (env) process.env.NODE_ENV = env;
      else delete process.env.NODE_ENV;

      await expect(crearModuloPrueba()).rejects.toThrow(
        /CRÍTICO: MockOdontologoContextAdapter deshabilitado por política de seguridad/,
      );
    },
  );

  it.each(['development', 'test'])(
    '3. debe permitir mock en desarrollo y test (NODE_ENV=%s)',
    async (env) => {
      process.env.ODONTOLOGO_AUTH_ADAPTER = 'mock';
      process.env.NODE_ENV = env;

      const moduleRef = await crearModuloPrueba();
      expect(moduleRef.get(ODONTOLOGO_CONTEXT_PORT)).toBeInstanceOf(MockOdontologoContextAdapter);
    },
  );
});
