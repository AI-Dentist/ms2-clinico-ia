import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import {
  GraphqlMs1PacienteValidatorAdapter,
  OBTENER_PACIENTE_QUERY,
} from './graphql-ms1-paciente-validator.adapter.js';
import type { IMs1CredentialsProvider } from './ms1-credentials-provider.port.js';
import {
  PacienteNoDisponibleError,
  AutenticacionMs1Error,
  Ms1GraphqlError,
  IdPacienteInvalidoError,
} from './errors/index.js';

describe('GraphqlMs1PacienteValidatorAdapter', () => {
  let adapter: GraphqlMs1PacienteValidatorAdapter;
  let mockCredentialsProvider: IMs1CredentialsProvider;
  let mockConfigService: ConfigService;
  const originalFetch = globalThis.fetch;

  const VALID_UUID = '33333333-3333-4333-8333-333333333333';
  const GRAPHQL_URL = 'http://127.0.0.1:8081/graphql';

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

    adapter = new GraphqlMs1PacienteValidatorAdapter(
      mockCredentialsProvider,
      mockConfigService,
    );
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('1. Paciente existente: debe retornar true cuando MS1 responde con paciente activo', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        data: {
          obtenerPacientePorId: {
            id: VALID_UUID,
            activo: true,
          },
        },
      }),
    });
    globalThis.fetch = fetchMock;

    const result = await adapter.existePaciente(VALID_UUID);

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      GRAPHQL_URL,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer jwt-token-valido-ms1',
        }),
        body: JSON.stringify({
          query: OBTENER_PACIENTE_QUERY,
          variables: { id: VALID_UUID },
        }),
      }),
    );
  });

  it('2. Paciente inexistente: debe retornar false cuando MS1 responde con obtenerPacientePorId = null', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        data: {
          obtenerPacientePorId: null,
        },
      }),
    });
    globalThis.fetch = fetchMock;

    const result = await adapter.existePaciente(VALID_UUID);

    expect(result).toBe(false);
  });

  it('2b. Paciente inactivo: debe retornar false si el paciente existe en MS1 pero activo es false', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        data: {
          obtenerPacientePorId: {
            id: VALID_UUID,
            activo: false,
          },
        },
      }),
    });
    globalThis.fetch = fetchMock;

    const result = await adapter.existePaciente(VALID_UUID);

    expect(result).toBe(false);
  });

  it('3. UUID inválido: debe lanzar IdPacienteInvalidoError sin ejecutar petición HTTP', async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;

    await expect(adapter.existePaciente('paciente_sin_formato_uuid')).rejects.toThrow(
      IdPacienteInvalidoError,
    );
    await expect(adapter.existePaciente('')).rejects.toThrow(IdPacienteInvalidoError);
    await expect(adapter.existePaciente('   ')).rejects.toThrow(IdPacienteInvalidoError);
    await expect(adapter.existePaciente('12345')).rejects.toThrow(IdPacienteInvalidoError);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('4. Respuesta GraphQL con errores: debe lanzar Ms1GraphqlError ante errores de negocio de GraphQL', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        data: null,
        errors: [
          {
            message: "Validation error on field 'id': invalid UUID syntax",
            locations: [{ line: 1, column: 2 }],
          },
        ],
      }),
    });
    globalThis.fetch = fetchMock;

    await expect(adapter.existePaciente(VALID_UUID)).rejects.toThrow(Ms1GraphqlError);
  });

  it('5. Error 401: debe lanzar AutenticacionMs1Error ante respuesta HTTP 401 Unauthorized', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    });
    globalThis.fetch = fetchMock;

    const promise = adapter.existePaciente(VALID_UUID);

    await expect(promise).rejects.toThrow(AutenticacionMs1Error);
    await expect(promise).rejects.toThrow(/401/);
  });

  it('6. Error 403: debe lanzar AutenticacionMs1Error ante respuesta HTTP 403 Forbidden', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
    });
    globalThis.fetch = fetchMock;

    const promise = adapter.existePaciente(VALID_UUID);

    await expect(promise).rejects.toThrow(AutenticacionMs1Error);
    await expect(promise).rejects.toThrow(/403/);
  });

  it('6b. Error 403 en extensions GraphQL: debe detectar errores de autorización dentro del payload GraphQL', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        errors: [
          {
            message: 'Access Denied: insufficient roles to read patients',
            extensions: { code: 'FORBIDDEN' },
          },
        ],
      }),
    });
    globalThis.fetch = fetchMock;

    await expect(adapter.existePaciente(VALID_UUID)).rejects.toThrow(AutenticacionMs1Error);
  });

  it('7. Timeout: debe lanzar PacienteNoDisponibleError cuando la petición excede el tiempo límite', async () => {
    const timeoutError = new Error('The operation was aborted due to timeout');
    timeoutError.name = 'TimeoutError';

    const fetchMock = vi.fn().mockRejectedValue(timeoutError);
    globalThis.fetch = fetchMock;

    await expect(adapter.existePaciente(VALID_UUID)).rejects.toThrow(
      PacienteNoDisponibleError,
    );
    await expect(adapter.existePaciente(VALID_UUID)).rejects.toThrow(/Timeout/);
  });

  it('8. Error de conexión: debe lanzar PacienteNoDisponibleError ante fallo de socket / ECONNREFUSED', async () => {
    const connectionError = new Error('fetch failed: connect ECONNREFUSED 127.0.0.1:8081');

    const fetchMock = vi.fn().mockRejectedValue(connectionError);
    globalThis.fetch = fetchMock;

    await expect(adapter.existePaciente(VALID_UUID)).rejects.toThrow(
      PacienteNoDisponibleError,
    );
    await expect(adapter.existePaciente(VALID_UUID)).rejects.toThrow(/conexión/);
  });

  it('8b. Nunca interpretar un error de MS1 como paciente inexistente', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
    });
    globalThis.fetch = fetchMock;

    await expect(adapter.existePaciente(VALID_UUID)).rejects.toThrow(
      PacienteNoDisponibleError,
    );
  });

  it('debe enviar la petición sin cabecera Authorization si no hay credenciales provistas', async () => {
    vi.spyOn(mockCredentialsProvider, 'getBearerToken').mockResolvedValue(null);

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        data: { obtenerPacientePorId: { id: VALID_UUID, activo: true } },
      }),
    });
    globalThis.fetch = fetchMock;

    await adapter.existePaciente(VALID_UUID);

    expect(fetchMock).toHaveBeenCalledWith(
      GRAPHQL_URL,
      expect.objectContaining({
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }),
    );
  });
});

