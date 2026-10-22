import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockPacienteValidatorAdapter } from './mock-paciente-validator.adapter.js';

describe('MockPacienteValidatorAdapter', () => {
  let adapter: MockPacienteValidatorAdapter;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    adapter = new MockPacienteValidatorAdapter();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('debe validar como existente un paciente con ID válido', async () => {
    const existe = await adapter.existePaciente('pac_001');
    expect(existe).toBe(true);

    const existeUuid = await adapter.existePaciente('a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d');
    expect(existeUuid).toBe(true);
  });

  it('debe marcar como inexistente si el ID está en la lista negra o contiene no_existe', async () => {
    expect(await adapter.existePaciente('pac_no_existe')).toBe(false);
    expect(await adapter.existePaciente('pac_inexistente')).toBe(false);
    expect(await adapter.existePaciente('paciente_no_existe_en_ms1')).toBe(false);
  });

  it('debe retornar false si el identificador es vacío', async () => {
    expect(await adapter.existePaciente('')).toBe(false);
    expect(await adapter.existePaciente('   ')).toBe(false);
  });

  it('debe bloquear la ejecución en entornos de producción por seguridad', async () => {
    process.env.NODE_ENV = 'production';
    await expect(adapter.existePaciente('pac_001')).rejects.toThrow(
      /no está permitido en entornos de producción/,
    );
  });
});
