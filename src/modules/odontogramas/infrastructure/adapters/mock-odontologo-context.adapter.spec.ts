import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockOdontologoContextAdapter } from './mock-odontologo-context.adapter.js';
import { AutenticacionRequeridaError } from './errors/autenticacion-requerida.error.js';

describe('MockOdontologoContextAdapter (Unit Tests)', () => {
  let adapter: MockOdontologoContextAdapter;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    adapter = new MockOdontologoContextAdapter();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('debe permitir la ejecución en entorno development y retornar la identidad sintética', async () => {
    process.env.NODE_ENV = 'development';
    const devAdapter = new MockOdontologoContextAdapter();
    const resultado = await devAdapter.obtenerOdontologoActual('token_dev_henry');

    expect(resultado).toEqual({
      odontologoId: 'od_henry_principal',
    });
  });

  it('debe retornar la identidad sintética correspondiente para un token autorizado', async () => {
    const resultado = await adapter.obtenerOdontologoActual('token_dev_henry');

    expect(resultado).toEqual({
      odontologoId: 'od_henry_principal',
    });
  });

  it('debe lanzar AutenticacionRequeridaError si no se envía token o está vacío', async () => {
    await expect(adapter.obtenerOdontologoActual('')).rejects.toThrow(
      AutenticacionRequeridaError
    );
    await expect(adapter.obtenerOdontologoActual(undefined)).rejects.toThrow(
      AutenticacionRequeridaError
    );
  });

  it('debe rechazar tokens que no pertenezcan a la lista blanca sintética sin revelar el token', async () => {
    await expect(
      adapter.obtenerOdontologoActual('token_malicioso_arbitrario')
    ).rejects.toThrow('Token de autenticación inválido o no reconocido.');
  });

  it('debe abortar con error crítico al instanciar o ejecutar en entorno production', async () => {
    process.env.NODE_ENV = 'production';

    expect(() => new MockOdontologoContextAdapter()).toThrow(
      /CRÍTICO: MockOdontologoContextAdapter deshabilitado por política de seguridad/
    );
  });

  it('debe abortar con error crítico en entorno staging o entornos desconocidos', async () => {
    process.env.NODE_ENV = 'staging';

    expect(() => new MockOdontologoContextAdapter()).toThrow(
      /CRÍTICO: MockOdontologoContextAdapter deshabilitado por política de seguridad/
    );
  });

  it('debe abortar con error crítico si NODE_ENV no está configurado (undefined)', async () => {
    delete process.env.NODE_ENV;

    expect(() => new MockOdontologoContextAdapter()).toThrow(
      /CRÍTICO: MockOdontologoContextAdapter deshabilitado por política de seguridad/
    );
  });
});
