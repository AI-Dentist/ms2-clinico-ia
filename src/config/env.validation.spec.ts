import { describe, it, expect } from 'vitest';
import { validateEnv } from './env.validation.js';

describe('validateEnv', () => {
  const baseValidConfig: Record<string, unknown> = {
    PORT: 3001,
    MONGODB_URI: 'mongodb://127.0.0.1:27017/testdb',
    PACIENTE_VALIDATOR_ADAPTER: 'mock',
    CATALOGO_SERVICIOS_ADAPTER: 'mock',
  };

  it('debe asignar valores por defecto para integración MS3 y validador de citas', () => {
    const env = validateEnv({ ...baseValidConfig });
    expect(env.CITA_VALIDATOR_ADAPTER).toBe('mock');
    expect(env.MS3_HTTP_URL).toBe('http://127.0.0.1:8000');
    expect(env.MS3_TIMEOUT_MS).toBe(2000);
    expect(env.MS3_BEARER_TOKEN).toBeUndefined();
  });

  it('debe aceptar configuración explícita de MS3 en modo http', () => {
    const env = validateEnv({
      ...baseValidConfig,
      CITA_VALIDATOR_ADAPTER: 'http',
      MS3_HTTP_URL: 'https://ms3.production.local:8443',
      MS3_TIMEOUT_MS: '4000',
      MS3_BEARER_TOKEN: 'token-secreto-ms3',
    });

    expect(env.CITA_VALIDATOR_ADAPTER).toBe('http');
    expect(env.MS3_HTTP_URL).toBe('https://ms3.production.local:8443');
    expect(env.MS3_TIMEOUT_MS).toBe(4000);
    expect(env.MS3_BEARER_TOKEN).toBe('token-secreto-ms3');
  });

  it('debe fallar si CITA_VALIDATOR_ADAPTER tiene un valor no permitido', () => {
    expect(() =>
      validateEnv({
        ...baseValidConfig,
        CITA_VALIDATOR_ADAPTER: 'invalido',
      }),
    ).toThrow(/CITA_VALIDATOR_ADAPTER/);
  });

  it('debe fallar si MS3_HTTP_URL no comienza con http:// ni https://', () => {
    expect(() =>
      validateEnv({
        ...baseValidConfig,
        MS3_HTTP_URL: 'ftp://ms3.local',
      }),
    ).toThrow(/MS3_HTTP_URL/);
  });

  it('debe fallar si MS3_TIMEOUT_MS es negativo o no numérico', () => {
    expect(() =>
      validateEnv({
        ...baseValidConfig,
        MS3_TIMEOUT_MS: -100,
      }),
    ).toThrow(/MS3_TIMEOUT_MS/);

    expect(() =>
      validateEnv({
        ...baseValidConfig,
        MS3_TIMEOUT_MS: 'no-numero',
      }),
    ).toThrow(/MS3_TIMEOUT_MS/);
  });
});
