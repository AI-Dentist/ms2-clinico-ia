import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockCatalogoServiciosAdapter } from './mock-catalogo-servicios.adapter.js';

describe('MockCatalogoServiciosAdapter', () => {
  let adapter: MockCatalogoServiciosAdapter;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    adapter = new MockCatalogoServiciosAdapter();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('1. Debe listar servicios activos de semilla en ambiente de prueba/desarrollo', async () => {
    const servicios = await adapter.listarServiciosActivos();
    expect(servicios.length).toBeGreaterThan(0);
    expect(servicios.every((s) => s.activo)).toBe(true);
    expect(servicios[0].precioBaseBs).toMatch(/^\d+\.\d{2}$/);
  });

  it('2. Debe filtrar por especialidadId si se provee', async () => {
    const especialidadId = '22222222-2222-4222-8222-222222222221';
    const filtrados = await adapter.listarServiciosActivos(especialidadId);
    expect(filtrados.length).toBeGreaterThan(0);
    expect(filtrados.every((s) => s.especialidad?.id === especialidadId)).toBe(true);
  });

  it('3. Debe obtener un servicio por ID si existe', async () => {
    const todos = await adapter.listarServiciosActivos();
    const target = todos[0];

    const encontrado = await adapter.obtenerServicioPorId(target.id);
    expect(encontrado).toEqual(target);
  });

  it('4. Debe retornar null si el servicio no existe', async () => {
    const encontrado = await adapter.obtenerServicioPorId('inexistente-uuid');
    expect(encontrado).toBeNull();
  });

  it('5. Debe prohibir su ejecución en producción arrojando un error explícito', async () => {
    process.env.NODE_ENV = 'production';
    const prodAdapter = new MockCatalogoServiciosAdapter();

    await expect(prodAdapter.listarServiciosActivos()).rejects.toThrow(
      /MockCatalogoServiciosAdapter no está permitido/,
    );
    await expect(prodAdapter.obtenerServicioPorId('any-id')).rejects.toThrow(
      /MockCatalogoServiciosAdapter no está permitido/,
    );
  });
});
