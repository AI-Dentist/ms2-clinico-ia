import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import {
  GraphqlMs1CanonicalDoctorResolverAdapter,
  OBTENER_MI_ODONTOLOGO_ID_QUERY,
} from './graphql-ms1-canonical-doctor-resolver.adapter.js';
import { AutenticacionRequeridaError } from '../../modules/historias-clinicas/application/errors/autenticacion-requerida.error.js';

describe('GraphqlMs1CanonicalDoctorResolverAdapter (Public Contract & Invariants)', () => {
  let adapter: GraphqlMs1CanonicalDoctorResolverAdapter;
  let mockConfigService: ConfigService;
  const originalFetch = globalThis.fetch;

  const MS1_GRAPHQL_URL = 'http://127.0.0.1:8081/graphql';
  const CALLER_TOKEN_A = 'ey-token-caller-a-123';
  const CALLER_TOKEN_B = 'ey-token-caller-b-456';
  const CANONICAL_DOCTOR_UUID_A = '70000000-0000-4000-a000-000000000001';
  const CANONICAL_DOCTOR_UUID_B = '70000000-0000-4000-b000-000000000002';

  beforeEach(() => {
    // Configurar MS1_BEARER_TOKEN estático en configuración para verificar que NUNCA sea usado en self-identity
    process.env.MS1_BEARER_TOKEN = 'static_system_service_token_never_used_here';

    mockConfigService = {
      get: vi.fn((key: string, defaultValue?: unknown) => {
        if (key === 'MS1_GRAPHQL_URL') return MS1_GRAPHQL_URL;
        if (key === 'MS1_TIMEOUT_MS') return 1500;
        if (key === 'MS1_BEARER_TOKEN') return 'static_system_service_token_never_used_here';
        return defaultValue;
      }),
    } as unknown as ConfigService;

    adapter = new GraphqlMs1CanonicalDoctorResolverAdapter(mockConfigService);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete process.env.MS1_BEARER_TOKEN;
    vi.restoreAllMocks();
  });

  it('1. Debe ejecutar query exacta ObtenerMiOdontologoId y reenviar Bearer token del llamador', async () => {
    let capturedUrl: string | undefined;
    let capturedHeaders: Record<string, string> | undefined;
    let capturedBody: string | undefined;

    globalThis.fetch = vi.fn().mockImplementation(async (url, init) => {
      capturedUrl = String(url);
      capturedHeaders = init?.headers as Record<string, string>;
      capturedBody = init?.body as string;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            obtenerMiOdontologoId: CANONICAL_DOCTOR_UUID_A,
          },
        }),
      } as Response;
    });

    const doctorId = await adapter.resolverOdontologoId(`Bearer ${CALLER_TOKEN_A}`);

    expect(doctorId).toBe(CANONICAL_DOCTOR_UUID_A);
    expect(capturedUrl).toBe(MS1_GRAPHQL_URL);
    expect(capturedHeaders?.['Authorization']).toBe(`Bearer ${CALLER_TOKEN_A}`);
    expect(capturedHeaders?.['Content-Type']).toBe('application/json');

    const parsedBody = JSON.parse(capturedBody!);
    expect(parsedBody.query.replace(/\s+/g, ' ').trim()).toBe(
      OBTENER_MI_ODONTOLOGO_ID_QUERY.replace(/\s+/g, ' ').trim(),
    );
  });

  it('2. Invariante: NUNCA debe usar MS1_BEARER_TOKEN estático para auto-identidad', async () => {
    let capturedAuthHeader = '';

    globalThis.fetch = vi.fn().mockImplementation(async (_url, init) => {
      capturedAuthHeader = (init?.headers as Record<string, string>)?.['Authorization'] || '';
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            obtenerMiOdontologoId: CANONICAL_DOCTOR_UUID_A,
          },
        }),
      } as Response;
    });

    await adapter.resolverOdontologoId(CALLER_TOKEN_A);

    expect(capturedAuthHeader).toBe(`Bearer ${CALLER_TOKEN_A}`);
    expect(capturedAuthHeader).not.toContain('static_system_service_token_never_used_here');
  });

  it('3. Debe resolver con éxito cuando Keycloak sub es distinto al doctorPK canónico', async () => {
    // sub = '550e8400-e29b-41d4-a716-446655440000', doctorPK = CANONICAL_DOCTOR_UUID_A
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          obtenerMiOdontologoId: CANONICAL_DOCTOR_UUID_A,
        },
      }),
    });

    const resultado = await adapter.resolverOdontologoId(CALLER_TOKEN_A);
    expect(resultado).toBe(CANONICAL_DOCTOR_UUID_A);
  });

  it('4. Debe fallar cerrado si MS1 retorna obtenerMiOdontologoId como null (usuario no vinculado o inactivo)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          obtenerMiOdontologoId: null,
        },
      }),
    });

    await expect(adapter.resolverOdontologoId(CALLER_TOKEN_A)).rejects.toThrow(
      AutenticacionRequeridaError,
    );
    await expect(adapter.resolverOdontologoId(CALLER_TOKEN_A)).rejects.toThrow(
      /no está vinculado a un odontólogo activo/i,
    );
  });

  it('5. Debe fallar cerrado si MS1 devuelve errores en el payload GraphQL', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: null,
        errors: [
          {
            message: 'Acceso denegado: El usuario no posee rol ODONTOLOGO ni ADMIN.',
          },
        ],
      }),
    });

    await expect(adapter.resolverOdontologoId(CALLER_TOKEN_A)).rejects.toThrow(
      AutenticacionRequeridaError,
    );
    await expect(adapter.resolverOdontologoId(CALLER_TOKEN_A)).rejects.toThrow(
      /Acceso denegado/i,
    );
  });

  it('6. Debe fallar cerrado si MS1 devuelve un identificador no UUID o malformado', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          obtenerMiOdontologoId: 'invalid-non-uuid-string-1234',
        },
      }),
    });

    await expect(adapter.resolverOdontologoId(CALLER_TOKEN_A)).rejects.toThrow(
      AutenticacionRequeridaError,
    );
    await expect(adapter.resolverOdontologoId(CALLER_TOKEN_A)).rejects.toThrow(
      /UUID válido/i,
    );
  });

  it('7. Debe fallar cerrado ante error HTTP 401 de MS1', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({}),
    });

    await expect(adapter.resolverOdontologoId(CALLER_TOKEN_A)).rejects.toThrow(
      AutenticacionRequeridaError,
    );
    await expect(adapter.resolverOdontologoId(CALLER_TOKEN_A)).rejects.toThrow(/HTTP 401/i);
  });

  it('8. Debe fallar cerrado ante error HTTP 403 de MS1', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: async () => ({}),
    });

    await expect(adapter.resolverOdontologoId(CALLER_TOKEN_A)).rejects.toThrow(
      AutenticacionRequeridaError,
    );
    await expect(adapter.resolverOdontologoId(CALLER_TOKEN_A)).rejects.toThrow(/HTTP 403/i);
  });

  it('9. Debe fallar cerrado ante timeout en la consulta a MS1', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new DOMException('The operation timed out.', 'TimeoutError'));

    await expect(adapter.resolverOdontologoId(CALLER_TOKEN_A)).rejects.toThrow(
      AutenticacionRequeridaError,
    );
    await expect(adapter.resolverOdontologoId(CALLER_TOKEN_A)).rejects.toThrow(/timeout/i);
  });

  it('10. Concurrencia y Aislamiento: Dos llamadores concurrentes no comparten token ni estado', async () => {
    const receivedAuthHeaders: string[] = [];

    globalThis.fetch = vi.fn().mockImplementation(async (_url, init) => {
      const auth = (init?.headers as Record<string, string>)?.['Authorization'];
      receivedAuthHeaders.push(auth);
      // Simular latencia asíncrona
      await new Promise((r) => setTimeout(r, 10));

      if (auth === `Bearer ${CALLER_TOKEN_A}`) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: { obtenerMiOdontologoId: CANONICAL_DOCTOR_UUID_A } }),
        };
      }
      if (auth === `Bearer ${CALLER_TOKEN_B}`) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: { obtenerMiOdontologoId: CANONICAL_DOCTOR_UUID_B } }),
        };
      }
      return { ok: false, status: 400 };
    });

    // Ejecución estrictamente concurrente
    const [idA, idB] = await Promise.all([
      adapter.resolverOdontologoId(CALLER_TOKEN_A),
      adapter.resolverOdontologoId(CALLER_TOKEN_B),
    ]);

    expect(idA).toBe(CANONICAL_DOCTOR_UUID_A);
    expect(idB).toBe(CANONICAL_DOCTOR_UUID_B);
    expect(receivedAuthHeaders).toContain(`Bearer ${CALLER_TOKEN_A}`);
    expect(receivedAuthHeaders).toContain(`Bearer ${CALLER_TOKEN_B}`);
    expect(receivedAuthHeaders.length).toBe(2);
  });

  it('11. Debe normalizar MS1_TIMEOUT_MS como string ("1500") sin fallar en AbortSignal.timeout', async () => {
    const stringConfig = {
      get: vi.fn((key: string, defaultValue?: unknown) => {
        if (key === 'MS1_GRAPHQL_URL') return MS1_GRAPHQL_URL;
        if (key === 'MS1_TIMEOUT_MS') return '1500';
        return defaultValue;
      }),
    } as unknown as ConfigService;

    const stringAdapter = new GraphqlMs1CanonicalDoctorResolverAdapter(stringConfig);

    let fetchCalled = false;
    let capturedAuthHeader = '';
    globalThis.fetch = vi.fn().mockImplementation(async (_url, init) => {
      fetchCalled = true;
      capturedAuthHeader = (init?.headers as Record<string, string>)?.['Authorization'] || '';
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: { obtenerMiOdontologoId: CANONICAL_DOCTOR_UUID_A },
        }),
      } as Response;
    });

    const doctorId = await stringAdapter.resolverOdontologoId(CALLER_TOKEN_A);

    expect(fetchCalled).toBe(true);
    expect(capturedAuthHeader).toBe(`Bearer ${CALLER_TOKEN_A}`);
    expect(doctorId).toBe(CANONICAL_DOCTOR_UUID_A);
  });
});
