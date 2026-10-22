import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockOdontologoContextAdapter } from './mock-odontologo-context.adapter.js';
import { AutenticacionRequeridaError } from '../../application/errors/autenticacion-requerida.error.js';

describe('MockOdontologoContextAdapter', () => {
  let adapter: MockOdontologoContextAdapter;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    adapter = new MockOdontologoContextAdapter();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('debe resolver tokens de la lista blanca sintética autorizada', async () => {
    const contexto = await adapter.obtenerOdontologoActual('token_valido');
    expect(contexto.odontologoId).toBe('od_dev_001');

    const contextoEditor = await adapter.obtenerOdontologoActual('token_valido_editor');
    expect(contextoEditor.odontologoId).toBe('od_editor_005');

    const contextoE2e = await adapter.obtenerOdontologoActual('token_e2e_principal');
    expect(contextoE2e.odontologoId).toBe('od_e2e_001');
  });

  it('debe rechazar tokens con patrones dinámicos no registrados explícitamente', async () => {
    await expect(adapter.obtenerOdontologoActual('dev-token-od_no_registrado')).rejects.toThrow(
      AutenticacionRequeridaError,
    );
  });

  it('debe rechazar tokens arbitrarios o no autorizados con AutenticacionRequeridaError', async () => {
    await expect(adapter.obtenerOdontologoActual('token_arbitrario_invalido')).rejects.toThrow(
      AutenticacionRequeridaError,
    );

    await expect(adapter.obtenerOdontologoActual('hacker_fake_token')).rejects.toThrow(
      AutenticacionRequeridaError,
    );
  });

  it('debe rechazar tokens vacíos o solo espacios con AutenticacionRequeridaError', async () => {
    await expect(adapter.obtenerOdontologoActual('')).rejects.toThrow(
      AutenticacionRequeridaError,
    );
    await expect(adapter.obtenerOdontologoActual('   ')).rejects.toThrow(
      AutenticacionRequeridaError,
    );
  });

  it('debe bloquear la ejecución en entornos de producción por seguridad', async () => {
    process.env.NODE_ENV = 'production';
    await expect(adapter.obtenerOdontologoActual('token_valido')).rejects.toThrow(
      /no está permitido en entornos de producción/,
    );
  });
});
