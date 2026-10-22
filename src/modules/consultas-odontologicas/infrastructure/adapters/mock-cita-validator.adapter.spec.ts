import { describe, it, expect } from 'vitest';
import { MockCitaValidatorAdapter } from './mock-cita-validator.adapter.js';

describe('MockCitaValidatorAdapter', () => {
  const adapter = new MockCitaValidatorAdapter();

  it('debe validar exitosamente citas que se encuentren en la lista blanca sintética', async () => {
    const res1 = await adapter.validarCitaParaAtencion('cita_dev_001', 'pac_test_001');
    expect(res1.esValida).toBe(true);

    const res2 = await adapter.validarCitaParaAtencion('cita_e2e_urgencia', 'pac_test_001');
    expect(res2.esValida).toBe(true);
  });

  it('debe rechazar citas con ID vacío', async () => {
    const res = await adapter.validarCitaParaAtencion('', 'pac_test_001');
    expect(res.esValida).toBe(false);
    expect(res.motivoInvalidez).toContain('no puede estar vacío');
  });

  it('debe rechazar citas arbitrarias que no pertenezcan a la lista blanca sintética de MS3', async () => {
    const res = await adapter.validarCitaParaAtencion('cita_arbitraria_desconocida', 'pac_test_001');
    expect(res.esValida).toBe(false);
    expect(res.motivoInvalidez).toContain('no existe en la agenda de MS3');
  });

  it('debe rechazar citas asociadas a pacientes impostores o ajenos en pruebas', async () => {
    const res = await adapter.validarCitaParaAtencion('cita_dev_001', 'pac_impostor_999');
    expect(res.esValida).toBe(false);
    expect(res.motivoInvalidez).toContain('pertenece a otro paciente en MS3');
  });

  it('debe arrojar error si se intenta ejecutar en entorno de producción', async () => {
    const envOriginal = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      await expect(adapter.validarCitaParaAtencion('cita_dev_001', 'pac_001')).rejects.toThrow(
        'CRÍTICO: MockCitaValidatorAdapter no está permitido en entornos de producción.'
      );
    } finally {
      process.env.NODE_ENV = envOriginal;
    }
  });
});
