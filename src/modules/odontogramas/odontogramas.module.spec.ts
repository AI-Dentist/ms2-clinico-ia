import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Module, Global } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken, getConnectionToken } from '@nestjs/mongoose';
import { OdontogramasModule } from './odontogramas.module.js';

// Schemas & Persistence
import { OdontogramaDocument, OdontogramaSchema } from './infrastructure/persistence/mongo/schemas/odontograma.schema.js';
import { RevisionOdontogramaDocument, RevisionOdontogramaSchema } from './infrastructure/persistence/mongo/schemas/revision-odontograma.schema.js';
import { HistoriaClinicaDocument } from '../historias-clinicas/infrastructure/persistence/mongo/schemas/historia-clinica.schema.js';
import { ConsultaOdontologicaDocument } from '../consultas-odontologicas/infrastructure/persistence/mongo/schemas/consulta-odontologica.schema.js';
import { MongoOdontogramaRepository } from './infrastructure/persistence/mongo/repositories/mongo-odontograma.repository.js';
import { ODONTOGRAMA_REPOSITORY } from './domain/ports/odontograma.repository.port.js';

// Ports & Adapters
import { HISTORIA_CLINICA_CONTEXT_PORT } from './application/ports/historia-clinica-context.port.js';
import { CONSULTA_ODONTOLOGICA_CONTEXT_PORT } from './application/ports/consulta-odontologica-context.port.js';
import { ODONTOLOGO_CONTEXT_PORT } from './application/ports/odontologo-context.port.js';
import { LocalHistoriaClinicaContextAdapter } from './infrastructure/adapters/local-historia-clinica-context.adapter.js';
import { LocalConsultaOdontologicaContextAdapter } from './infrastructure/adapters/local-consulta-odontologica-context.adapter.js';
import { MockOdontologoContextAdapter } from './infrastructure/adapters/mock-odontologo-context.adapter.js';

// Reused Port Tokens
import { HISTORIA_CLINICA_REPOSITORY } from '../historias-clinicas/domain/ports/historia-clinica.repository.port.js';
import { CONSULTA_ODONTOLOGICA_REPOSITORY } from '../consultas-odontologicas/domain/ports/consulta-odontologica.repository.port.js';

// Use Cases
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

describe('OdontogramasModule (NestJS DI & Integration Unit Tests)', () => {
  const originalEnv = process.env.NODE_ENV;

  const mockModel = {
    create: vi.fn(),
    updateOne: vi.fn(),
    findById: vi.fn(),
    findOne: vi.fn(),
    find: vi.fn(),
    countDocuments: vi.fn(),
  };

  const mockConnection = {
    startSession: vi.fn(),
    getClient: vi.fn().mockReturnValue({ topology: { description: { type: 'ReplicaSetWithPrimary' } } }),
  };

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
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
      imports: [MockDatabaseModule, OdontogramasModule],
    })
      .overrideProvider(getModelToken(OdontogramaDocument.name))
      .useValue(mockModel)
      .overrideProvider(getModelToken(RevisionOdontogramaDocument.name))
      .useValue(mockModel)
      .overrideProvider(getModelToken(HistoriaClinicaDocument.name))
      .useValue(mockModel)
      .overrideProvider(getModelToken(ConsultaOdontologicaDocument.name))
      .useValue(mockModel)
      .compile();
  }

  // 1. Resolución del módulo
  it('1. debe resolver exitosamente la instancia de OdontogramasModule', async () => {
    const moduleRef = await crearModuloPrueba();
    const odontogramasModule = moduleRef.get<OdontogramasModule>(OdontogramasModule);

    expect(odontogramasModule).toBeDefined();
    expect(odontogramasModule).toBeInstanceOf(OdontogramasModule);
  });

  // 2. Resolución del repositorio mediante su token
  it('2. debe resolver el repositorio de persistencia mediante ODONTOGRAMA_REPOSITORY', async () => {
    const moduleRef = await crearModuloPrueba();
    const repo = moduleRef.get(ODONTOGRAMA_REPOSITORY);

    expect(repo).toBeDefined();
    expect(repo).toBeInstanceOf(MongoOdontogramaRepository);
  });

  // 3. Resolución de los tres puertos de contexto
  it('3. debe resolver los tres puertos de contexto clínico (Historia, Consulta, Odontólogo)', async () => {
    const moduleRef = await crearModuloPrueba();

    const historiaPort = moduleRef.get(HISTORIA_CLINICA_CONTEXT_PORT);
    const consultaPort = moduleRef.get(CONSULTA_ODONTOLOGICA_CONTEXT_PORT);
    const odontologoPort = moduleRef.get(ODONTOLOGO_CONTEXT_PORT);

    expect(historiaPort).toBeDefined();
    expect(historiaPort).toBeInstanceOf(LocalHistoriaClinicaContextAdapter);

    expect(consultaPort).toBeDefined();
    expect(consultaPort).toBeInstanceOf(LocalConsultaOdontologicaContextAdapter);

    expect(odontologoPort).toBeDefined();
    expect(odontologoPort).toBeInstanceOf(MockOdontologoContextAdapter);
  });

  // 4. Resolución de los seis casos de uso
  it('4. debe resolver los seis casos de uso de la capa Application', async () => {
    const moduleRef = await crearModuloPrueba();

    expect(moduleRef.get(InicializarOdontogramaUseCase)).toBeInstanceOf(InicializarOdontogramaUseCase);
    expect(moduleRef.get(ObtenerOdontogramaActualUseCase)).toBeInstanceOf(ObtenerOdontogramaActualUseCase);
    expect(moduleRef.get(RegistrarRevisionOdontogramaUseCase)).toBeInstanceOf(RegistrarRevisionOdontogramaUseCase);
    expect(moduleRef.get(ListarHistorialRevisionesUseCase)).toBeInstanceOf(ListarHistorialRevisionesUseCase);
    expect(moduleRef.get(ObtenerSnapshotRevisionUseCase)).toBeInstanceOf(ObtenerSnapshotRevisionUseCase);
    expect(moduleRef.get(ObtenerSnapshotsPorConsultaUseCase)).toBeInstanceOf(ObtenerSnapshotsPorConsultaUseCase);
  });

  // 5. Reutilización de repositorios existentes
  it('5. debe reutilizar los tokens de repositorio exportados por HistoriasClinicas y ConsultasOdontologicas', async () => {
    const moduleRef = await crearModuloPrueba();

    const hcRepo = moduleRef.get(HISTORIA_CLINICA_REPOSITORY);
    const coRepo = moduleRef.get(CONSULTA_ODONTOLOGICA_REPOSITORY);

    expect(hcRepo).toBeDefined();
    expect(coRepo).toBeDefined();
  });

  // 6. Ausencia de dependencias circulares
  it('6. no debe contener dependencias circulares en la jerarquía de módulos', async () => {
    // Al compilarse sin errores de forwardRef, se valida la ausencia de ciclos
    const moduleRef = await crearModuloPrueba();
    expect(moduleRef).toBeDefined();
  });

  // 7. Restricción del adaptador odontológico sintético
  it('7. debe permitir el registro del adaptador sintético en entorno development', async () => {
    process.env.NODE_ENV = 'development';
    const moduleRef = await crearModuloPrueba();
    const odontologoPort = moduleRef.get(ODONTOLOGO_CONTEXT_PORT);

    expect(odontologoPort).toBeInstanceOf(MockOdontologoContextAdapter);
  });

  // 8. Rechazo seguro en entornos distintos de development/test
  it('8. debe rechazar de forma segura la inicialización en entornos no permitidos (production, staging, undefined)', async () => {
    // Caso Production
    process.env.NODE_ENV = 'production';
    await expect(crearModuloPrueba()).rejects.toThrow(
      /CRÍTICO: MockOdontologoContextAdapter deshabilitado por política de seguridad/
    );

    // Caso Staging
    process.env.NODE_ENV = 'staging';
    await expect(crearModuloPrueba()).rejects.toThrow(
      /CRÍTICO: MockOdontologoContextAdapter deshabilitado por política de seguridad/
    );

    // Caso Undefined / vacío
    delete process.env.NODE_ENV;
    await expect(crearModuloPrueba()).rejects.toThrow(
      /CRÍTICO: MockOdontologoContextAdapter deshabilitado por política de seguridad/
    );
  });

  // 9. Arranque sin ejecutar escrituras clínicas
  it('9. el arranque y resolución de dependencias no debe ejecutar escrituras clínicas ni llamar a create/updateOne', async () => {
    const guardarInicialSpy = vi.spyOn(MongoOdontogramaRepository.prototype, 'guardarInicial');
    const aplicarRevisionSpy = vi.spyOn(MongoOdontogramaRepository.prototype, 'aplicarRevisionTransaccional');

    await crearModuloPrueba();

    expect(guardarInicialSpy).not.toHaveBeenCalled();
    expect(aplicarRevisionSpy).not.toHaveBeenCalled();
    expect(mockModel.create).not.toHaveBeenCalled();
    expect(mockModel.updateOne).not.toHaveBeenCalled();
  });

  // 10. Registro y resolución de OdontogramasController y OdontologoAuthGuard
  it('10. debe registrar y resolver OdontogramasController y OdontologoAuthGuard en OdontogramasModule', async () => {
    const controllers = Reflect.getMetadata('controllers', OdontogramasModule) || [];
    expect(controllers).toContain(OdontogramasController);
    expect(controllers.length).toBe(1);

    const moduleRef = await crearModuloPrueba();
    const controller = moduleRef.get<OdontogramasController>(OdontogramasController);
    expect(controller).toBeDefined();
    expect(controller).toBeInstanceOf(OdontogramasController);

    const guard = moduleRef.get<OdontologoAuthGuard>(OdontologoAuthGuard);
    expect(guard).toBeDefined();
    expect(guard).toBeInstanceOf(OdontologoAuthGuard);
  });

  // 11. Verificación de configuración segura de Mongoose (autoIndex y autoCreate desactivados)
  it('11. los esquemas de Odontograma y RevisionOdontograma deben tener autoIndex: false y autoCreate: false', () => {
    expect(OdontogramaSchema.get('autoIndex')).toBe(false);
    expect(OdontogramaSchema.get('autoCreate')).toBe(false);

    expect(RevisionOdontogramaSchema.get('autoIndex')).toBe(false);
    expect(RevisionOdontogramaSchema.get('autoCreate')).toBe(false);
  });

  // 12. Verificación de configuración de arranque en desarrollo y negativa del adaptador en entornos no autorizados
  describe('12. Política de arranque local y seguridad fail-closed del adaptador odontológico', () => {
    it('debe configurar NODE_ENV=development explícitamente en start:dev y start:debug sin contaminar start:prod', () => {
      const packageJsonPath = resolve(process.cwd(), 'package.json');
      expect(existsSync(packageJsonPath)).toBe(true);

      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
      expect(pkg.scripts).toBeDefined();

      // start:dev debe ejecutar el script multiplataforma de desarrollo
      expect(pkg.scripts['start:dev']).toBe('node scripts/start-dev.js --watch');
      expect(pkg.scripts['start:debug']).toBe('node scripts/start-dev.js --debug --watch');

      // start:prod NO debe incluir desarrollo ni usar el runner sintético
      expect(pkg.scripts['start:prod']).toBe('node dist/main');
      expect(pkg.scripts['start:prod']).not.toContain('development');
      expect(pkg.scripts['start:prod']).not.toContain('start-dev.js');

      // El runner multiplataforma de desarrollo debe existir y contener la definición explícita de desarrollo
      const runnerPath = resolve(process.cwd(), 'scripts/start-dev.js');
      expect(existsSync(runnerPath)).toBe(true);
      const runnerCode = readFileSync(runnerPath, 'utf8');
      expect(runnerCode).toContain("process.env.NODE_ENV = 'development'");
    });

    it('debe negar taxativamente el uso de MockOdontologoContextAdapter en producción, staging o entorno no configurado', async () => {
      const entornosNoAutorizados = ['production', 'staging', 'qa', '', undefined];

      for (const env of entornosNoAutorizados) {
        if (env === undefined) {
          delete process.env.NODE_ENV;
        } else {
          process.env.NODE_ENV = env;
        }

        await expect(crearModuloPrueba()).rejects.toThrow(
          /CRÍTICO: MockOdontologoContextAdapter deshabilitado por política de seguridad/
        );
      }
    });

    it('debe permitir la inicialización única y exclusivamente en entornos development y test', async () => {
      // Test
      process.env.NODE_ENV = 'test';
      const moduleTest = await crearModuloPrueba();
      expect(moduleTest.get(ODONTOLOGO_CONTEXT_PORT)).toBeInstanceOf(MockOdontologoContextAdapter);

      // Development
      process.env.NODE_ENV = 'development';
      const moduleDev = await crearModuloPrueba();
      expect(moduleDev.get(ODONTOLOGO_CONTEXT_PORT)).toBeInstanceOf(MockOdontologoContextAdapter);
    });
  });
});
