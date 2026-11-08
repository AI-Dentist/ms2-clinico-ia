import { describe, it, expect, beforeAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { OdontogramasModule } from './modules/odontogramas/odontogramas.module.js';
import { ODONTOGRAMA_REPOSITORY } from './modules/odontogramas/domain/ports/odontograma.repository.port.js';
import { OdontogramaDocument } from './modules/odontogramas/infrastructure/persistence/mongo/schemas/odontograma.schema.js';
import { RevisionOdontogramaDocument } from './modules/odontogramas/infrastructure/persistence/mongo/schemas/revision-odontograma.schema.js';
import { HistoriaClinicaDocument } from './modules/historias-clinicas/infrastructure/persistence/mongo/schemas/historia-clinica.schema.js';
import { ConsultaOdontologicaDocument } from './modules/consultas-odontologicas/infrastructure/persistence/mongo/schemas/consulta-odontologica.schema.js';
import { LaboratorioMongo } from './modules/estudios/infrastructure/persistence/mongo/schemas/laboratorio.schema.js';
import { TipoEstudioMongo } from './modules/estudios/infrastructure/persistence/mongo/schemas/tipo-estudio.schema.js';
import { SolicitudEstudioMongo } from './modules/estudios/infrastructure/persistence/mongo/schemas/solicitud-estudio.schema.js';
import { EstudioClinicoMongo } from './modules/estudio-clinico/infrastructure/persistence/mongo/schemas/estudio-clinico.schema.js';
import { OutboxEventDocument } from './modules/outbox/infrastructure/persistence/mongo/schemas/outbox-event.schema.js';

describe('AppModule Integration (with mocked DB)', () => {
  let AppModuleClass: any;
  let EstudiosModuleClass: any;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.MONGODB_URI = 'mongodb://127.0.0.1:27018/test_odontograma_db?replicaSet=rs_odontograma_test';
    const appMod = await import('./app.module.js');
    AppModuleClass = appMod.AppModule;
    const estMod = await import('./modules/estudios/estudios.module.js');
    EstudiosModuleClass = estMod.EstudiosModule;
  }, 30000);

  it('debe compilar AppModule y resolver OdontogramasModule y EstudiosModule sin conectarse a la base real', async () => {
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
      find: () => ({ sort: () => ({ skip: () => ({ limit: () => ({ lean: () => ({ exec: async () => [] }) }) }) }) }),
      findById: () => ({ lean: () => ({ exec: async () => null }), exec: async () => null }),
      findOne: () => ({ lean: () => ({ exec: async () => null }), exec: async () => null }),
      countDocuments: () => ({ exec: async () => 0 }),
      updateOne: () => ({ exec: async () => ({ matchedCount: 1 }) }),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [AppModuleClass],
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
      .overrideProvider(getModelToken(LaboratorioMongo.name))
      .useValue(mockModel)
      .overrideProvider(getModelToken(TipoEstudioMongo.name))
      .useValue(mockModel)
      .overrideProvider(getModelToken(SolicitudEstudioMongo.name))
      .useValue(mockModel)
      .overrideProvider(getModelToken(EstudioClinicoMongo.name))
      .useValue(mockModel)
      .overrideProvider(getModelToken(OutboxEventDocument.name))
      .useValue(mockModel)
      .compile();

    expect(moduleRef).toBeDefined();

    const odontogramasModule = moduleRef.get<OdontogramasModule>(OdontogramasModule);
    expect(odontogramasModule).toBeDefined();

    const estudiosModule = moduleRef.get(EstudiosModuleClass);
    expect(estudiosModule).toBeDefined();

    const repo = moduleRef.get(ODONTOGRAMA_REPOSITORY);
    expect(repo).toBeDefined();

    await moduleRef.close();
  });
});
