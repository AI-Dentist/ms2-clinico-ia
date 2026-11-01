import { describe, it, expect, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { HistoriasClinicasModule } from './historias-clinicas.module.js';
import { PACIENTE_VALIDATOR_PORT } from './domain/ports/paciente-validator.port.js';
import { MockPacienteValidatorAdapter } from './infrastructure/adapters/mock-paciente-validator.adapter.js';
import { GraphqlMs1PacienteValidatorAdapter } from './infrastructure/adapters/graphql-ms1-paciente-validator.adapter.js';
import { HistoriaClinicaDocument } from './infrastructure/persistence/mongo/schemas/historia-clinica.schema.js';
import { ODONTOLOGO_CONTEXT_PORT } from './domain/ports/odontologo-context.port.js';
import { MockOdontologoContextAdapter } from './infrastructure/adapters/mock-odontologo-context.adapter.js';
import { KeycloakJwtOdontologoContextAdapter } from '../../infrastructure/auth/keycloak-jwt-odontologo-context.adapter.js';

describe('HistoriasClinicasModule - Selección de Validador de Pacientes', () => {
  const mockMongooseModel = {
    findOne: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
  };

  it("9a. Debe resolver MockPacienteValidatorAdapter por defecto cuando PACIENTE_VALIDATOR_ADAPTER es 'mock'", async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [HistoriasClinicasModule],
    })
      .overrideProvider(ConfigService)
      .useValue({
        get: vi.fn((key: string, def?: unknown) => {
          if (key === 'PACIENTE_VALIDATOR_ADAPTER') return 'mock';
          return def;
        }),
      })
      .overrideProvider(getModelToken(HistoriaClinicaDocument.name))
      .useValue(mockMongooseModel)
      .compile();

    const validator = moduleRef.get(PACIENTE_VALIDATOR_PORT);
    expect(validator).toBeInstanceOf(MockPacienteValidatorAdapter);
  });

  it("9b. Debe resolver GraphqlMs1PacienteValidatorAdapter cuando PACIENTE_VALIDATOR_ADAPTER es 'graphql'", async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [HistoriasClinicasModule],
    })
      .overrideProvider(ConfigService)
      .useValue({
        get: vi.fn((key: string, def?: unknown) => {
          if (key === 'PACIENTE_VALIDATOR_ADAPTER') return 'graphql';
          if (key === 'MS1_GRAPHQL_URL') return 'http://127.0.0.1:8081/graphql';
          if (key === 'MS1_TIMEOUT_MS') return 2000;
          return def;
        }),
      })
      .overrideProvider(getModelToken(HistoriaClinicaDocument.name))
      .useValue(mockMongooseModel)
      .compile();

    const validator = moduleRef.get(PACIENTE_VALIDATOR_PORT);
    expect(validator).toBeInstanceOf(GraphqlMs1PacienteValidatorAdapter);
  });

  it('9c. Debe resolver MockPacienteValidatorAdapter cuando ConfigService no tiene valor configurado (default seguro)', async () => {
    delete process.env.PACIENTE_VALIDATOR_ADAPTER;

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [HistoriasClinicasModule],
    })
      .overrideProvider(ConfigService)
      .useValue({
        get: vi.fn(() => undefined),
      })
      .overrideProvider(getModelToken(HistoriaClinicaDocument.name))
      .useValue(mockMongooseModel)
      .compile();

    const validator = moduleRef.get(PACIENTE_VALIDATOR_PORT);
    expect(validator).toBeInstanceOf(MockPacienteValidatorAdapter);
  });

  describe('Selección de Contexto de Odontólogo (ODONTOLOGO_CONTEXT_PORT)', () => {
    const originalEnv = process.env.NODE_ENV;
    const originalAdapter = process.env.ODONTOLOGO_AUTH_ADAPTER;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
      if (originalAdapter !== undefined) {
        process.env.ODONTOLOGO_AUTH_ADAPTER = originalAdapter;
      } else {
        delete process.env.ODONTOLOGO_AUTH_ADAPTER;
      }
    });

    it.each([undefined, 'keycloak'])(
      '10a. Debe resolver KeycloakJwtOdontologoContextAdapter en production con adapter=%s',
      async (adapter) => {
        process.env.NODE_ENV = 'production';
        if (adapter) process.env.ODONTOLOGO_AUTH_ADAPTER = adapter;
        else delete process.env.ODONTOLOGO_AUTH_ADAPTER;

        const moduleRef = await Test.createTestingModule({
          imports: [HistoriasClinicasModule],
        })
          .overrideProvider(getModelToken(HistoriaClinicaDocument.name))
          .useValue(mockMongooseModel)
          .compile();

        const port = moduleRef.get(ODONTOLOGO_CONTEXT_PORT);
        expect(port).toBeInstanceOf(KeycloakJwtOdontologoContextAdapter);
      },
    );

    it.each(['production', 'staging', undefined])(
      '10b. Debe rechazar mock en entornos no autorizados (NODE_ENV=%s)',
      async (env) => {
        process.env.ODONTOLOGO_AUTH_ADAPTER = 'mock';
        if (env) process.env.NODE_ENV = env;
        else delete process.env.NODE_ENV;

        await expect(
          Test.createTestingModule({
            imports: [HistoriasClinicasModule],
          })
            .overrideProvider(getModelToken(HistoriaClinicaDocument.name))
            .useValue(mockMongooseModel)
            .compile(),
        ).rejects.toThrow(/CRÍTICO: MockOdontologoContextAdapter deshabilitado por política de seguridad/);
      },
    );

    it.each(['development', 'test'])(
      '10c. Debe permitir mock en desarrollo y test (NODE_ENV=%s)',
      async (env) => {
        process.env.ODONTOLOGO_AUTH_ADAPTER = 'mock';
        process.env.NODE_ENV = env;

        const moduleRef = await Test.createTestingModule({
          imports: [HistoriasClinicasModule],
        })
          .overrideProvider(getModelToken(HistoriaClinicaDocument.name))
          .useValue(mockMongooseModel)
          .compile();

        expect(moduleRef.get(ODONTOLOGO_CONTEXT_PORT)).toBeInstanceOf(MockOdontologoContextAdapter);
      },
    );
  });
});

