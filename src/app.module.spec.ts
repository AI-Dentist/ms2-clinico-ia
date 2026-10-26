import { describe, it, expect } from 'vitest';
import { Test } from '@nestjs/testing';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { AppModule } from './app.module.js';
import { OdontogramasModule } from './modules/odontogramas/odontogramas.module.js';
import { ODONTOGRAMA_REPOSITORY } from './modules/odontogramas/domain/ports/odontograma.repository.port.js';
import { OdontogramaDocument } from './modules/odontogramas/infrastructure/persistence/mongo/schemas/odontograma.schema.js';
import { RevisionOdontogramaDocument } from './modules/odontogramas/infrastructure/persistence/mongo/schemas/revision-odontograma.schema.js';
import { HistoriaClinicaDocument } from './modules/historias-clinicas/infrastructure/persistence/mongo/schemas/historia-clinica.schema.js';
import { ConsultaOdontologicaDocument } from './modules/consultas-odontologicas/infrastructure/persistence/mongo/schemas/consulta-odontologica.schema.js';

describe('AppModule Integration (with mocked DB)', () => {
  it('debe compilar AppModule y resolver OdontogramasModule y sus dependencias sin conectarse a la base real', async () => {
    process.env.NODE_ENV = 'test';

    const mockConnection = {
      close: async () => {},
      startSession: () => ({
        withTransaction: async (cb: () => Promise<void>) => cb(),
        endSession: async () => {},
      }),
      getClient: () => ({ topology: { description: { type: 'ReplicaSetWithPrimary' } } }),
    };

    const mockModel = {
      create: () => {},
      find: () => ({ sort: () => ({ skip: () => ({ limit: () => ({ exec: async () => [] }) }) }) }),
      findById: () => ({ exec: async () => null }),
      findOne: () => ({ exec: async () => null }),
      countDocuments: () => ({ exec: async () => 0 }),
      updateOne: () => ({ exec: async () => ({ matchedCount: 1 }) }),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(getConnectionToken())
      .useValue(mockConnection)
      .overrideProvider(getModelToken(OdontogramaDocument.name))
      .useValue(mockModel)
      .overrideProvider(getModelToken(RevisionOdontogramaDocument.name))
      .useValue(mockModel)
      .overrideProvider(getModelToken(HistoriaClinicaDocument.name))
      .useValue(mockModel)
      .overrideProvider(getModelToken(ConsultaOdontologicaDocument.name))
      .useValue(mockModel)
      .compile();

    expect(moduleRef).toBeDefined();

    const odontogramasModule = moduleRef.get<OdontogramasModule>(OdontogramasModule);
    expect(odontogramasModule).toBeDefined();

    const repo = moduleRef.get(ODONTOGRAMA_REPOSITORY);
    expect(repo).toBeDefined();

    await moduleRef.close();
  });
});
