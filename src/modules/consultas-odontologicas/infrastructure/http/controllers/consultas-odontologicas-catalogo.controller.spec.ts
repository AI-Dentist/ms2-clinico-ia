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
import { MockCatalogoServiciosAdapter } from '../../adapters/mock-catalogo-servicios.adapter.js';
import { GraphqlMs1CatalogoServiciosAdapter } from '../../adapters/graphql-ms1-catalogo-servicios.adapter.js';

describe('ConsultasOdontologicasController - Catálogo de Servicios & DI', () => {
  let controller: ConsultasOdontologicasController;
  let useCaseMock: {
    listar: ReturnType<typeof vi.fn>;
    obtenerPorId: ReturnType<typeof vi.fn>;
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

    controller = new ConsultasOdontologicasController(
      {} as RegistrarAperturaConsultaUseCase,
      {} as ObtenerConsultaPorIdUseCase,
      {} as ListarConsultasPorHistoriaUseCase,
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
  });
});
