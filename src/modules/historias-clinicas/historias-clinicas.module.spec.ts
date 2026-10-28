import { describe, it, expect, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { HistoriasClinicasModule } from './historias-clinicas.module.js';
import { PACIENTE_VALIDATOR_PORT } from './domain/ports/paciente-validator.port.js';
import { MockPacienteValidatorAdapter } from './infrastructure/adapters/mock-paciente-validator.adapter.js';
import { GraphqlMs1PacienteValidatorAdapter } from './infrastructure/adapters/graphql-ms1-paciente-validator.adapter.js';
import { HistoriaClinicaDocument } from './infrastructure/persistence/mongo/schemas/historia-clinica.schema.js';

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
});

