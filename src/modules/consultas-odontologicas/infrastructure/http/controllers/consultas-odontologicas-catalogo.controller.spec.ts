import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ConsultasOdontologicasController } from './consultas-odontologicas.controller.js';
import {
  RegistrarAperturaConsultaUseCase,
  ObtenerConsultaPorIdUseCase,
  ListarConsultasPorHistoriaUseCase,
  ActualizarAtencionConsultaUseCase,
  CompletarConsultaUseCase,
  CancelarConsultaUseCase,
  ConsultarCatalogoServiciosUseCase,
  CATALOGO_SERVICIOS_PORT,
  type ServicioCatalogoDto,
} from '../../../application/index.js';
import { BadRequestException } from '@nestjs/common';
import { MockCatalogoServiciosAdapter } from '../../adapters/mock-catalogo-servicios.adapter.js';
import { GraphqlMs1CatalogoServiciosAdapter } from '../../adapters/graphql-ms1-catalogo-servicios.adapter.js';
import { CITA_VALIDATOR_PORT } from '../../../domain/ports/cita-validator.port.js';
import { MockCitaValidatorAdapter } from '../../adapters/mock-cita-validator.adapter.js';
import { HttpMs3CitaValidatorAdapter } from '../../adapters/http-ms3-cita-validator.adapter.js';

describe('ConsultasOdontologicasController - Catálogo de Servicios & DI', () => {
  let controller: ConsultasOdontologicasController;
  let useCaseMock: {
    listar: ReturnType<typeof vi.fn>;
    obtenerPorId: ReturnType<typeof vi.fn>;
  };

  let listarConsultasMock: {
    execute: ReturnType<typeof vi.fn>;
  };

  const mockServicio: ServicioCatalogoDto = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    codigo: 'LIM-001',
    nombre: 'Limpieza Dental Ultrasonido',
    descripcion: 'Profilaxis dental completa',
    precioBaseBs: '150.00',
    activo: true,
  };

  beforeEach(() => {
    useCaseMock = {
      listar: vi.fn().mockResolvedValue([mockServicio]),
      obtenerPorId: vi.fn().mockResolvedValue(mockServicio),
    };

    listarConsultasMock = {
      execute: vi.fn().mockResolvedValue({
        consultas: [],
        total: 0,
        limite: 10,
        offset: 0,
      }),
    };

    controller = new ConsultasOdontologicasController(
      {} as RegistrarAperturaConsultaUseCase,
      {} as ObtenerConsultaPorIdUseCase,
      listarConsultasMock as unknown as ListarConsultasPorHistoriaUseCase,
      {} as ActualizarAtencionConsultaUseCase,
      {} as CompletarConsultaUseCase,
      {} as CancelarConsultaUseCase,
      useCaseMock as unknown as ConsultarCatalogoServiciosUseCase,
    );
  });

  describe('Endpoints del Catálogo', () => {
    it('1. GET catalogo-servicios debe delegar al caso de uso con filtro opcional', async () => {
      const result = await controller.listarCatalogoServicios('esp-uuid-1');

      expect(useCaseMock.listar).toHaveBeenCalledWith('esp-uuid-1');
      expect(result).toEqual([mockServicio]);
    });

    it('2. GET catalogo-servicios/:servicioId debe delegar al caso de uso por ID', async () => {
      const result = await controller.obtenerServicioCatalogoPorId(mockServicio.id);

      expect(useCaseMock.obtenerPorId).toHaveBeenCalledWith(mockServicio.id);
      expect(result).toEqual(mockServicio);
    });
  });

  describe('Retrocompatibilidad y Alias de Rutas REST', () => {
    it('debe registrar los prefijos de ruta "consultas-odontologicas" y "consultas" en el controlador', () => {
      const pathMetadata = Reflect.getMetadata('path', ConsultasOdontologicasController);
      expect(pathMetadata).toEqual(['consultas-odontologicas', 'consultas']);
    });

    it('GET / con historiaClinicaId query param debe delegar al caso de uso de listar', async () => {
      const result = await controller.listarPorHistoriaClinicaQuery(
        'hc_test_123',
        { limite: 20, offset: 5 },
        'token_operador',
      );

      expect(listarConsultasMock.execute).toHaveBeenCalledWith({
        tokenAutenticacion: 'token_operador',
        historiaClinicaId: 'hc_test_123',
        limite: 20,
        offset: 5,
      });
      expect(result).toEqual({
        consultas: [],
        total: 0,
        limite: 10,
        offset: 0,
      });
    });

    it('GET / sin historiaClinicaId query param debe lanzar BadRequestException (HTTP 400)', async () => {
      await expect(
        controller.listarPorHistoriaClinicaQuery('', {}, 'token_operador'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Resolución de Inyección de Dependencias (DI Factory)', () => {
    it('3. Resuelve MockCatalogoServiciosAdapter por defecto cuando no se configura CATALOGO_SERVICIOS_ADAPTER', async () => {
      const mockAdapterInstance = new MockCatalogoServiciosAdapter();
      const graphqlAdapterInstance = {} as GraphqlMs1CatalogoServiciosAdapter;

      const moduleRef: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: MockCatalogoServiciosAdapter,
            useValue: mockAdapterInstance,
          },
          {
            provide: GraphqlMs1CatalogoServiciosAdapter,
            useValue: graphqlAdapterInstance,
          },
          {
            provide: ConfigService,
            useValue: {
              get: vi.fn().mockReturnValue(undefined),
            },
          },
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
        ],
      }).compile();

      const resolved = moduleRef.get(CATALOGO_SERVICIOS_PORT);
      expect(resolved).toBe(mockAdapterInstance);
    });

    it('4. Resuelve GraphqlMs1CatalogoServiciosAdapter cuando CATALOGO_SERVICIOS_ADAPTER=graphql', async () => {
      const mockAdapterInstance = new MockCatalogoServiciosAdapter();
      const graphqlAdapterInstance = {} as GraphqlMs1CatalogoServiciosAdapter;

      const moduleRef: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: MockCatalogoServiciosAdapter,
            useValue: mockAdapterInstance,
          },
          {
            provide: GraphqlMs1CatalogoServiciosAdapter,
            useValue: graphqlAdapterInstance,
          },
          {
            provide: ConfigService,
            useValue: {
              get: vi.fn().mockImplementation((key: string) => {
                if (key === 'CATALOGO_SERVICIOS_ADAPTER') return 'graphql';
                return undefined;
              }),
            },
          },
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
        ],
      }).compile();

      const resolved = moduleRef.get(CATALOGO_SERVICIOS_PORT);
      expect(resolved).toBe(graphqlAdapterInstance);
    });

    it('5. Resuelve MockCitaValidatorAdapter por defecto cuando CITA_VALIDATOR_ADAPTER no está definido o es mock', async () => {
      const mockAdapterInstance = new MockCitaValidatorAdapter();
      const httpAdapterInstance = {} as HttpMs3CitaValidatorAdapter;

      const moduleRef: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: MockCitaValidatorAdapter,
            useValue: mockAdapterInstance,
          },
          {
            provide: HttpMs3CitaValidatorAdapter,
            useValue: httpAdapterInstance,
          },
          {
            provide: ConfigService,
            useValue: {
              get: vi.fn().mockReturnValue(undefined),
            },
          },
          {
            provide: CITA_VALIDATOR_PORT,
            useFactory: (
              mockAdapter: MockCitaValidatorAdapter,
              httpAdapter: HttpMs3CitaValidatorAdapter,
              configService?: ConfigService,
            ) => {
              const raw = configService?.get<string>('CITA_VALIDATOR_ADAPTER');
              const modo =
                typeof raw === 'string'
                  ? raw.trim().toLowerCase()
                  : (process.env.CITA_VALIDATOR_ADAPTER ?? 'mock').trim().toLowerCase();

              if (modo === 'http') {
                return httpAdapter;
              }
              return mockAdapter;
            },
            inject: [
              MockCitaValidatorAdapter,
              HttpMs3CitaValidatorAdapter,
              { token: ConfigService, optional: true },
            ],
          },
        ],
      }).compile();

      const resolved = moduleRef.get(CITA_VALIDATOR_PORT);
      expect(resolved).toBe(mockAdapterInstance);
    });

    it('6. Resuelve HttpMs3CitaValidatorAdapter cuando CITA_VALIDATOR_ADAPTER=http', async () => {
      const mockAdapterInstance = new MockCitaValidatorAdapter();
      const httpAdapterInstance = {} as HttpMs3CitaValidatorAdapter;

      const moduleRef: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: MockCitaValidatorAdapter,
            useValue: mockAdapterInstance,
          },
          {
            provide: HttpMs3CitaValidatorAdapter,
            useValue: httpAdapterInstance,
          },
          {
            provide: ConfigService,
            useValue: {
              get: vi.fn().mockImplementation((key: string) => {
                if (key === 'CITA_VALIDATOR_ADAPTER') return 'http';
                return undefined;
              }),
            },
          },
          {
            provide: CITA_VALIDATOR_PORT,
            useFactory: (
              mockAdapter: MockCitaValidatorAdapter,
              httpAdapter: HttpMs3CitaValidatorAdapter,
              configService?: ConfigService,
            ) => {
              const raw = configService?.get<string>('CITA_VALIDATOR_ADAPTER');
              const modo =
                typeof raw === 'string'
                  ? raw.trim().toLowerCase()
                  : (process.env.CITA_VALIDATOR_ADAPTER ?? 'mock').trim().toLowerCase();

              if (modo === 'http') {
                return httpAdapter;
              }
              return mockAdapter;
            },
            inject: [
              MockCitaValidatorAdapter,
              HttpMs3CitaValidatorAdapter,
              { token: ConfigService, optional: true },
            ],
          },
        ],
      }).compile();

      const resolved = moduleRef.get(CITA_VALIDATOR_PORT);
      expect(resolved).toBe(httpAdapterInstance);
    });
  });
});
