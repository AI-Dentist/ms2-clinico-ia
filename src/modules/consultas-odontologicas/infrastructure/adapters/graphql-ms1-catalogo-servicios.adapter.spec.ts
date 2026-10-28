import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import {
  GraphqlMs1CatalogoServiciosAdapter,
  LISTAR_SERVICIOS_QUERY,
} from './graphql-ms1-catalogo-servicios.adapter.js';
import type { IMs1CredentialsProvider } from '../../../historias-clinicas/infrastructure/adapters/ms1-credentials-provider.port.js';
import {
  AutenticacionMs1Error,
  Ms1GraphqlError,
} from '../../../historias-clinicas/infrastructure/adapters/errors/index.js';
import {
  CatalogoServiciosNoDisponibleError,
  IdServicioInvalidoError,
} from './errors/index.js';

describe('GraphqlMs1CatalogoServiciosAdapter', () => {
  let adapter: GraphqlMs1CatalogoServiciosAdapter;
  let mockCredentialsProvider: IMs1CredentialsProvider;
  let mockConfigService: ConfigService;
  const originalFetch = globalThis.fetch;

  const GRAPHQL_URL = 'http://127.0.0.1:8081/graphql';
  const VALID_UUID_1 = '550e8400-e29b-41d4-a716-446655440001';
  const VALID_UUID_2 = '550e8400-e29b-41d4-a716-446655440002';
  const VALID_ESPECIALIDAD_UUID = '60000000-0000-0000-0000-000000000010';

  const MOCK_SERVICIOS_RAW = [
    {
      id: VALID_UUID_1,
      codigo: 'LIM-001',
      nombre: 'Limpieza Dental Ultrasonido',
      descripcion: 'Profilaxis dental completa',
      precioBaseBs: 150.0,
      activo: true,
      especialidad: {
        id: VALID_ESPECIALIDAD_UUID,
        codigo: 'ODO-GEN',
        nombre: 'Odontología General',
        descripcion: 'Atención primaria',
        activo: true,
      },
    },
    {
      id: VALID_UUID_2,
      codigo: 'EXT-002',
      nombre: 'Extracción Simple',
      descripcion: 'Extracción de pieza dental unirradicular',
      precioBaseBs: '200.50',
      activo: true,
      especialidad: {
        id: VALID_ESPECIALIDAD_UUID,
        codigo: 'ODO-GEN',
        nombre: 'Odontología General',
        descripcion: 'Atención primaria',
        activo: true,
      },
    },
  ];

  beforeEach(() => {
    mockCredentialsProvider = {
      getBearerToken: vi.fn().mockResolvedValue('jwt-token-valido-ms1'),
    };

    mockConfigService = {
      get: vi.fn((key: string, defaultValue?: unknown) => {
        if (key === 'MS1_GRAPHQL_URL') return GRAPHQL_URL;
        if (key === 'MS1_TIMEOUT_MS') return 2000;
        return defaultValue;
      }),
    } as unknown as ConfigService;

    adapter = new GraphqlMs1CatalogoServiciosAdapter(
      mockCredentialsProvider,
      mockConfigService,
    );
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('listarServiciosActivos', () => {
    it('1. Debe listar servicios activos y formatear precioBaseBs como string decimal exacto', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          data: {
            listarServiciosOdontologicos: MOCK_SERVICIOS_RAW,
          },
        }),
      });
      globalThis.fetch = fetchMock;

      const resultado = await adapter.listarServiciosActivos();

      expect(resultado).toHaveLength(2);
      expect(resultado[0]).toEqual({
        id: VALID_UUID_1,
        codigo: 'LIM-001',
        nombre: 'Limpieza Dental Ultrasonido',
        descripcion: 'Profilaxis dental completa',
        precioBaseBs: '150.00',
        activo: true,
        especialidad: {
          id: VALID_ESPECIALIDAD_UUID,
          codigo: 'ODO-GEN',
          nombre: 'Odontología General',
          descripcion: 'Atención primaria',
          activo: true,
        },
      });
      expect(resultado[1].precioBaseBs).toBe('200.50');

      expect(fetchMock).toHaveBeenCalledWith(
        GRAPHQL_URL,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer jwt-token-valido-ms1',
          }),
          body: JSON.stringify({
            query: LISTAR_SERVICIOS_QUERY,
            variables: { especialidadId: null },
          }),
        }),
      );
    });

    it('2. Debe enviar especialidadId cuando se provee y es UUID válido', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          data: {
            listarServiciosOdontologicos: [MOCK_SERVICIOS_RAW[0]],
          },
        }),
      });
      globalThis.fetch = fetchMock;

      const resultado = await adapter.listarServiciosActivos(VALID_ESPECIALIDAD_UUID);

      expect(resultado).toHaveLength(1);
      expect(fetchMock).toHaveBeenCalledWith(
        GRAPHQL_URL,
        expect.objectContaining({
          body: JSON.stringify({
            query: LISTAR_SERVICIOS_QUERY,
            variables: { especialidadId: VALID_ESPECIALIDAD_UUID },
          }),
        }),
      );
    });

    it('3. Debe lanzar IdServicioInvalidoError si especialidadId tiene formato inválido', async () => {
      await expect(adapter.listarServiciosActivos('id-invalido-123')).rejects.toThrow(
        IdServicioInvalidoError,
      );
    });
  });

  describe('obtenerServicioPorId', () => {
    it('4. Debe retornar el servicio correspondiente si existe', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          data: {
            listarServiciosOdontologicos: MOCK_SERVICIOS_RAW,
          },
        }),
      });
      globalThis.fetch = fetchMock;

      const servicio = await adapter.obtenerServicioPorId(VALID_UUID_2);

      expect(servicio).toBeDefined();
      expect(servicio?.id).toBe(VALID_UUID_2);
      expect(servicio?.precioBaseBs).toBe('200.50');
    });

    it('5. Debe retornar null si el servicio no está en el catálogo', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          data: {
            listarServiciosOdontologicos: MOCK_SERVICIOS_RAW,
          },
        }),
      });
      globalThis.fetch = fetchMock;

      const servicio = await adapter.obtenerServicioPorId(
        '550e8400-e29b-41d4-a716-446655449999',
      );

      expect(servicio).toBeNull();
    });

    it('6. Debe lanzar IdServicioInvalidoError si servicioId no es UUID RFC 4122', async () => {
      await expect(adapter.obtenerServicioPorId('no-es-uuid')).rejects.toThrow(
        IdServicioInvalidoError,
      );
    });
  });

  describe('Manejo de errores HTTP y de red', () => {
    it('7. HTTP 401 debe lanzar AutenticacionMs1Error', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      await expect(adapter.listarServiciosActivos()).rejects.toThrow(
        AutenticacionMs1Error,
      );
    });

    it('8. HTTP 403 debe lanzar AutenticacionMs1Error', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      });

      await expect(adapter.listarServiciosActivos()).rejects.toThrow(
        AutenticacionMs1Error,
      );
    });

    it('9. Fallo de red (fetch rechaza) debe lanzar CatalogoServiciosNoDisponibleError', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(adapter.listarServiciosActivos()).rejects.toThrow(
        CatalogoServiciosNoDisponibleError,
      );
    });

    it('10. Timeout / AbortError debe lanzar CatalogoServiciosNoDisponibleError', async () => {
      const timeoutError = new Error('The operation was aborted');
      timeoutError.name = 'AbortError';
      globalThis.fetch = vi.fn().mockRejectedValue(timeoutError);

      await expect(adapter.listarServiciosActivos()).rejects.toThrow(
        CatalogoServiciosNoDisponibleError,
      );
    });

    it('11. Errores GraphQL en la respuesta deben lanzar Ms1GraphqlError', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          data: null,
          errors: [
            {
              message: 'Syntax error or unexpected token at line 1',
              locations: [],
            },
          ],
        }),
      });

      await expect(adapter.listarServiciosActivos()).rejects.toThrow(
        Ms1GraphqlError,
      );
    });
  });
});
