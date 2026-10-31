import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { HttpMs3CitaValidatorAdapter } from './http-ms3-cita-validator.adapter.js';

describe('HttpMs3CitaValidatorAdapter', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function createAdapter(config: Record<string, unknown> = {}) {
    const configService = {
      get: vi.fn((key: string) => config[key]),
    } as unknown as ConfigService;
    return new HttpMs3CitaValidatorAdapter(configService);
  }

  it('debe rechazar citaId vacío o solo espacios', async () => {
    const adapter = createAdapter();
    const res = await adapter.validarCitaParaAtencion('   ', 'pac_001');
    expect(res.esValida).toBe(false);
    expect(res.motivoInvalidez).toContain('no puede estar vacío');
  });

  it('debe validar exitosamente cuando el endpoint directo responde una cita RESERVADA para el paciente', async () => {
    const adapter = createAdapter({
      MS3_HTTP_URL: 'http://ms3.local:8000',
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          id: 'cita_123',
          paciente_id: 'pac_001',
          estado: 'RESERVADA',
          fecha_hora: '2026-11-01 10:00:00',
        },
      }),
    });

    const res = await adapter.validarCitaParaAtencion('cita_123', 'pac_001');

    expect(res.esValida).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://ms3.local:8000/api/agendamiento/citas/cita_123',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Accept: 'application/json',
        }),
      }),
    );
  });

  it('debe aceptar estados clínicos válidos alternativos: CONFIRMADA, EN_ATENCION, PROGRAMADA', async () => {
    const adapter = createAdapter();

    for (const estado of ['CONFIRMADA', 'EN_ATENCION', 'PROGRAMADA', 'PENDIENTE']) {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            id: 'cita_valid',
            paciente_id: 'pac_001',
            estado,
          },
        }),
      });

      const res = await adapter.validarCitaParaAtencion('cita_valid', 'pac_001');
      expect(res.esValida).toBe(true);
    }
  });

  it('debe reconocer pacienteId en formato camelCase', async () => {
    const adapter = createAdapter();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          id: 'cita_camel',
          pacienteId: 'pac_001',
          estado: 'RESERVADA',
        },
      }),
    });

    const res = await adapter.validarCitaParaAtencion('cita_camel', 'pac_001');
    expect(res.esValida).toBe(true);
  });

  it('debe rechazar cuando la cita pertenece a otro paciente', async () => {
    const adapter = createAdapter();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          id: 'cita_ajena',
          paciente_id: 'pac_impostor',
          estado: 'RESERVADA',
        },
      }),
    });

    const res = await adapter.validarCitaParaAtencion('cita_ajena', 'pac_esperado');
    expect(res.esValida).toBe(false);
    expect(res.motivoInvalidez).toContain('pertenece a otro paciente');
  });

  it('debe rechazar con motivo explícito si la cita está CANCELADA', async () => {
    const adapter = createAdapter();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          id: 'cita_cancelada',
          paciente_id: 'pac_001',
          estado: 'CANCELADA',
        },
      }),
    });

    const res = await adapter.validarCitaParaAtencion('cita_cancelada', 'pac_001');
    expect(res.esValida).toBe(false);
    expect(res.motivoInvalidez).toContain('CANCELADA');
  });

  it('debe rechazar con motivo explícito si la cita ya está COMPLETADA', async () => {
    const adapter = createAdapter();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          id: 'cita_fin',
          paciente_id: 'pac_001',
          estado: 'COMPLETADA',
        },
      }),
    });

    const res = await adapter.validarCitaParaAtencion('cita_fin', 'pac_001');
    expect(res.esValida).toBe(false);
    expect(res.motivoInvalidez).toContain('COMPLETADA');
  });

  it('debe rechazar con motivo explícito si la cita fue marcada como NO_ASISTIO', async () => {
    const adapter = createAdapter();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          id: 'cita_noshow',
          paciente_id: 'pac_001',
          estado: 'NO_ASISTIO',
        },
      }),
    });

    const res = await adapter.validarCitaParaAtencion('cita_noshow', 'pac_001');
    expect(res.esValida).toBe(false);
    expect(res.motivoInvalidez).toContain('NO ASISTIÓ');
  });

  it('debe validar exitosamente cuando la cita está REPROGRAMADA (S4: attendible sin confirmación adicional)', async () => {
    const adapter = createAdapter();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          id: 'cita_reprog',
          paciente_id: 'pac_001',
          estado: 'REPROGRAMADA',
          fecha_hora: '2026-11-05 14:30:00',
        },
      }),
    });

    const res = await adapter.validarCitaParaAtencion('cita_reprog', 'pac_001');
    expect(res.esValida).toBe(true);
    expect(res.motivoInvalidez).toBeUndefined();
  });

  it('debe rechazar cita REPROGRAMADA si el paciente no coincide con el expediente', async () => {
    const adapter = createAdapter();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          id: 'cita_reprog',
          paciente_id: 'pac_otro',
          estado: 'REPROGRAMADA',
          fecha_hora: '2026-11-05 14:30:00',
        },
      }),
    });

    const res = await adapter.validarCitaParaAtencion('cita_reprog', 'pac_001');
    expect(res.esValida).toBe(false);
    expect(res.motivoInvalidez).toContain('pertenece a otro paciente');
  });

  it('debe activar fallback al listado general /citas si el endpoint individual devuelve 404', async () => {
    const adapter = createAdapter({
      MS3_HTTP_URL: 'http://ms3.test',
    });

    const fetchMock = vi
      .fn()
      // Primer llamado: GET /citas/cita_fallback -> 404
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
      })
      // Segundo llamado (fallback): GET /citas -> 200 con listado
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            citas: [
              {
                id: 'cita_otra',
                paciente_id: 'pac_otro',
                estado: 'RESERVADA',
              },
              {
                id: 'cita_fallback',
                paciente_id: 'pac_001',
                estado: 'RESERVADA',
              },
            ],
            total: 2,
          },
        }),
      });

    global.fetch = fetchMock;

    const res = await adapter.validarCitaParaAtencion('cita_fallback', 'pac_001');

    expect(res.esValida).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://ms3.test/api/agendamiento/citas/cita_fallback',
      expect.anything(),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://ms3.test/api/agendamiento/citas',
      expect.anything(),
    );
  });

  it('debe rechazar si la cita no existe ni en endpoint individual ni en listado fallback', async () => {
    const adapter = createAdapter();

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            citas: [],
            total: 0,
          },
        }),
      });

    const res = await adapter.validarCitaParaAtencion('cita_inexistente', 'pac_001');

    expect(res.esValida).toBe(false);
    expect(res.motivoInvalidez).toContain('no existe en la agenda de MS3');
  });

  it('debe rechazar con mensaje de autorización si MS3 responde 401 o 403', async () => {
    const adapter = createAdapter();

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
    });

    const res = await adapter.validarCitaParaAtencion('cita_auth', 'pac_001');
    expect(res.esValida).toBe(false);
    expect(res.motivoInvalidez).toContain('HTTP 401');
  });

  it('debe manejar timeout de red limpiamente sin lanzar excepciones no controladas', async () => {
    const adapter = createAdapter({
      MS3_TIMEOUT_MS: 1500,
    });

    const timeoutError = new Error('The operation was aborted');
    timeoutError.name = 'TimeoutError';
    global.fetch = vi.fn().mockRejectedValue(timeoutError);

    const res = await adapter.validarCitaParaAtencion('cita_timeout', 'pac_001');

    expect(res.esValida).toBe(false);
    expect(res.motivoInvalidez).toContain('Timeout tras 1500ms');
  });

  it('debe manejar error de conexión de red limpiamente', async () => {
    const adapter = createAdapter();

    global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    const res = await adapter.validarCitaParaAtencion('cita_conn', 'pac_001');

    expect(res.esValida).toBe(false);
    expect(res.motivoInvalidez).toContain('Error de red');
    expect(res.motivoInvalidez).toContain('ECONNREFUSED');
  });

  it('debe incluir Authorization Bearer header cuando MS3_BEARER_TOKEN está configurado', async () => {
    const adapter = createAdapter({
      MS3_BEARER_TOKEN: 'token_ms3_seguro_123',
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          id: 'cita_auth_header',
          paciente_id: 'pac_001',
          estado: 'RESERVADA',
        },
      }),
    });

    await adapter.validarCitaParaAtencion('cita_auth_header', 'pac_001');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer token_ms3_seguro_123',
        }),
      }),
    );
  });

  it('debe evitar duplicar el prefijo /api/agendamiento si MS3_HTTP_URL ya lo incluye', async () => {
    const adapter = createAdapter({
      MS3_HTTP_URL: 'http://gateway.local:8080/api/agendamiento/',
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          id: 'cita_gateway',
          paciente_id: 'pac_001',
          estado: 'RESERVADA',
        },
      }),
    });

    const res = await adapter.validarCitaParaAtencion('cita_gateway', 'pac_001');

    expect(res.esValida).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://gateway.local:8080/api/agendamiento/citas/cita_gateway',
      expect.anything(),
    );
  });

  it('debe rechazar la cita si MS3 no tiene paciente asignado y se esperaba titularidad', async () => {
    const adapter = createAdapter();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          id: 'cita_sin_paciente',
          estado: 'RESERVADA',
        },
      }),
    });

    const res = await adapter.validarCitaParaAtencion('cita_sin_paciente', 'pac_esperado');

    expect(res.esValida).toBe(false);
    expect(res.motivoInvalidez).toContain('no tiene un paciente asignado en MS3');
  });

  it('debe extraer la cita cuando viene anidada en data.cita', async () => {
    const adapter = createAdapter();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          cita: {
            id: 'cita_nested',
            paciente_id: 'pac_001',
            estado: 'RESERVADA',
          },
        },
      }),
    });

    const res = await adapter.validarCitaParaAtencion('cita_nested', 'pac_001');

    expect(res.esValida).toBe(true);
  });
});
