import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as jose from 'jose';
import { KeycloakJwtOdontologoContextAdapter } from './keycloak-jwt-odontologo-context.adapter.js';
import { AutenticacionRequeridaError } from '../../modules/historias-clinicas/application/errors/autenticacion-requerida.error.js';

describe('KeycloakJwtOdontologoContextAdapter', () => {
  let adapter: KeycloakJwtOdontologoContextAdapter;
  const originalEnv = process.env.NODE_ENV;
  const originalJwtSecret = process.env.JWT_SECRET;
  const testSecret = 'super_secret_jwt_key_for_testing_12345';

  const defaultIssuer = 'http://localhost:8080/realms/dental-platform';
  const defaultAudience = 'ms2-clinico-ia';

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = testSecret;
    adapter = new KeycloakJwtOdontologoContextAdapter();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    process.env.JWT_SECRET = originalJwtSecret;
  });

  it('debe resolver tokens de la lista blanca sintética en desarrollo/test', async () => {
    const contexto = await adapter.obtenerOdontologoActual('token_valido');
    expect(contexto.odontologoId).toBe('od_dev_001');
    expect(contexto.roles).toContain('ODONTOLOGO');
  });

  it('debe rechazar tokens vacíos o nulos', async () => {
    await expect(adapter.obtenerOdontologoActual('')).rejects.toThrow(
      AutenticacionRequeridaError,
    );
    await expect(adapter.obtenerOdontologoActual('   ')).rejects.toThrow(
      AutenticacionRequeridaError,
    );
  });

  it('debe decodificar y validar un JWT real, mapeando sub a odontologoId y extrayendo roles', async () => {
    const secretBytes = new TextEncoder().encode(testSecret);
    const token = await new jose.SignJWT({
      realm_access: { roles: ['ODONTOLOGO', 'ADMIN'] },
      email: 'dr.garcia@dental.com',
      preferred_username: 'dr_garcia',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('od_keycloak_sub_999')
      .setIssuer(defaultIssuer)
      .setAudience(defaultAudience)
      .setExpirationTime('2h')
      .sign(secretBytes);

    const contexto = await adapter.obtenerOdontologoActual(token);
    expect(contexto.odontologoId).toBe('od_keycloak_sub_999');
    expect(contexto.roles).toEqual(expect.arrayContaining(['ODONTOLOGO', 'ADMIN']));
    expect(contexto.email).toBe('dr.garcia@dental.com');
  });

  it('debe rechazar un JWT firmado con clave diferente', async () => {
    const wrongSecret = new TextEncoder().encode('otro_secreto_completamente_distinto');
    const token = await new jose.SignJWT({
      realm_access: { roles: ['ODONTOLOGO'] },
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('od_keycloak_sub_999')
      .setIssuer(defaultIssuer)
      .setAudience(defaultAudience)
      .setExpirationTime('2h')
      .sign(wrongSecret);

    await expect(adapter.obtenerOdontologoActual(token)).rejects.toThrow(
      AutenticacionRequeridaError,
    );
  });

  it('debe rechazar un JWT sin subject (sub) o con sub en blanco', async () => {
    const secretBytes = new TextEncoder().encode(testSecret);
    const token = await new jose.SignJWT({
      realm_access: { roles: ['ODONTOLOGO'] },
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(defaultIssuer)
      .setAudience(defaultAudience)
      .setExpirationTime('2h')
      .sign(secretBytes);

    await expect(adapter.obtenerOdontologoActual(token)).rejects.toThrow(
      AutenticacionRequeridaError,
    );

    const tokenSubVacio = await new jose.SignJWT({
      realm_access: { roles: ['ODONTOLOGO'] },
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('   ')
      .setIssuer(defaultIssuer)
      .setAudience(defaultAudience)
      .setExpirationTime('2h')
      .sign(secretBytes);

    await expect(adapter.obtenerOdontologoActual(tokenSubVacio)).rejects.toThrow(
      AutenticacionRequeridaError,
    );
  });

  it('debe rechazar un JWT expirado', async () => {
    const secretBytes = new TextEncoder().encode(testSecret);
    const token = await new jose.SignJWT({
      realm_access: { roles: ['ODONTOLOGO'] },
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('od_keycloak_sub_999')
      .setIssuer(defaultIssuer)
      .setAudience(defaultAudience)
      .setExpirationTime('-1h')
      .sign(secretBytes);

    await expect(adapter.obtenerOdontologoActual(token)).rejects.toThrow(
      AutenticacionRequeridaError,
    );
  });

  it('debe aceptar token con prefijo Bearer y extraerlo limpiamente', async () => {
    const secretBytes = new TextEncoder().encode(testSecret);
    const token = await new jose.SignJWT({
      realm_access: { roles: ['ODONTOLOGO'] },
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('od_sub_bearer_test')
      .setIssuer(defaultIssuer)
      .setAudience(defaultAudience)
      .setExpirationTime('2h')
      .sign(secretBytes);

    const contexto = await adapter.obtenerOdontologoActual(`Bearer ${token}`);
    expect(contexto.odontologoId).toBe('od_sub_bearer_test');
  });

  it('debe normalizar roles con prefijo ROLE_ (e.g. ROLE_ODONTOLOGO -> ODONTOLOGO)', async () => {
    const secretBytes = new TextEncoder().encode(testSecret);
    const token = await new jose.SignJWT({
      realm_access: { roles: ['ROLE_ODONTOLOGO', 'ROLE_ADMIN'] },
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('od_role_prefix_test')
      .setIssuer(defaultIssuer)
      .setAudience(defaultAudience)
      .setExpirationTime('2h')
      .sign(secretBytes);

    const contexto = await adapter.obtenerOdontologoActual(token);
    expect(contexto.roles).toContain('ODONTOLOGO');
    expect(contexto.roles).toContain('ADMIN');
  });

  it('debe validar tokens firmados con RS256 contra KEYCLOAK_PUBLIC_KEY', async () => {
    const keyPair = await jose.generateKeyPair('RS256');
    const exportedSpki = await jose.exportSPKI(keyPair.publicKey);

    delete process.env.JWT_SECRET;
    process.env.KEYCLOAK_PUBLIC_KEY = exportedSpki;

    const rs256Adapter = new KeycloakJwtOdontologoContextAdapter();

    const token = await new jose.SignJWT({
      realm_access: { roles: ['ODONTOLOGO'] },
    })
      .setProtectedHeader({ alg: 'RS256' })
      .setSubject('od_rs256_user')
      .setIssuer(defaultIssuer)
      .setAudience(defaultAudience)
      .setExpirationTime('1h')
      .sign(keyPair.privateKey);

    const contexto = await rs256Adapter.obtenerOdontologoActual(token);
    expect(contexto.odontologoId).toBe('od_rs256_user');
    expect(contexto.roles).toContain('ODONTOLOGO');

    delete process.env.KEYCLOAK_PUBLIC_KEY;
  });

  it('debe rechazar token expirado en modo tolerante dev/test sin servidores externos', async () => {
    delete process.env.JWT_SECRET;
    delete process.env.KEYCLOAK_PUBLIC_KEY;

    const fallbackAdapter = new KeycloakJwtOdontologoContextAdapter();

    // Crear un token firmado con una clave aleatoria pero expirado
    const dummyKey = new TextEncoder().encode('dummy_key_not_known_by_adapter');
    const expiredToken = await new jose.SignJWT({
      realm_access: { roles: ['ODONTOLOGO'] },
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('od_expired_fallback')
      .setIssuer(defaultIssuer)
      .setAudience(defaultAudience)
      .setExpirationTime('-1h')
      .sign(dummyKey);

    await expect(fallbackAdapter.obtenerOdontologoActual(expiredToken)).rejects.toThrow(
      /expirado/,
    );
  });

  it('debe rechazar token en modo tolerante dev/test si el emisor (iss) no coincide', async () => {
    delete process.env.JWT_SECRET;
    delete process.env.KEYCLOAK_PUBLIC_KEY;

    const fallbackAdapter = new KeycloakJwtOdontologoContextAdapter();
    const dummyKey = new TextEncoder().encode('dummy_key_not_known_by_adapter');
    const tokenWrongIssuer = await new jose.SignJWT({
      realm_access: { roles: ['ODONTOLOGO'] },
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('od_wrong_iss_fallback')
      .setIssuer('http://untrusted-idp/realms/dental-platform')
      .setAudience(defaultAudience)
      .setExpirationTime('1h')
      .sign(dummyKey);

    await expect(fallbackAdapter.obtenerOdontologoActual(tokenWrongIssuer)).rejects.toThrow(
      /emisor \(iss\) inválido o ausente/,
    );
  });

  it('debe rechazar token en modo tolerante dev/test si la audiencia (aud) no coincide', async () => {
    delete process.env.JWT_SECRET;
    delete process.env.KEYCLOAK_PUBLIC_KEY;

    const fallbackAdapter = new KeycloakJwtOdontologoContextAdapter();
    const dummyKey = new TextEncoder().encode('dummy_key_not_known_by_adapter');
    const tokenWrongAud = await new jose.SignJWT({
      realm_access: { roles: ['ODONTOLOGO'] },
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('od_wrong_aud_fallback')
      .setIssuer(defaultIssuer)
      .setAudience('dental-platform')
      .setExpirationTime('1h')
      .sign(dummyKey);

    await expect(fallbackAdapter.obtenerOdontologoActual(tokenWrongAud)).rejects.toThrow(
      /audiencia \(aud\) inválida o ausente/,
    );
  });

  it('debe aceptar token en modo tolerante dev/test con emisor y audiencia correctos', async () => {
    delete process.env.JWT_SECRET;
    delete process.env.KEYCLOAK_PUBLIC_KEY;

    const fallbackAdapter = new KeycloakJwtOdontologoContextAdapter();
    const dummyKey = new TextEncoder().encode('dummy_key_not_known_by_adapter');
    const tokenValido = await new jose.SignJWT({
      realm_access: { roles: ['ODONTOLOGO'] },
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('od_valid_fallback')
      .setIssuer(defaultIssuer)
      .setAudience(defaultAudience)
      .setExpirationTime('1h')
      .sign(dummyKey);

    const contexto = await fallbackAdapter.obtenerOdontologoActual(tokenValido);
    expect(contexto.odontologoId).toBe('od_valid_fallback');
    expect(contexto.roles).toContain('ODONTOLOGO');
  });

  describe('Validación estricta de emisor (iss) y audiencia (aud)', () => {
    const validIssuer = 'http://localhost:8080/realms/dental-platform';
    const validAudience = 'ms2-clinico-ia';

    it('debe rechazar JWT sin claim de emisor (iss)', async () => {
      const secretBytes = new TextEncoder().encode(testSecret);
      const token = await new jose.SignJWT({
        realm_access: { roles: ['ODONTOLOGO'] },
        aud: validAudience,
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject('od_keycloak_sub_999')
        .setExpirationTime('2h')
        .sign(secretBytes);

      await expect(adapter.obtenerOdontologoActual(token)).rejects.toThrow(
        AutenticacionRequeridaError,
      );
    });

    it('debe rechazar JWT con emisor (iss) no confiable o no coincidente', async () => {
      const secretBytes = new TextEncoder().encode(testSecret);
      const token = await new jose.SignJWT({
        realm_access: { roles: ['ODONTOLOGO'] },
        iss: 'http://malicious-idp.com/realms/dental-platform',
        aud: validAudience,
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject('od_keycloak_sub_999')
        .setExpirationTime('2h')
        .sign(secretBytes);

      await expect(adapter.obtenerOdontologoActual(token)).rejects.toThrow(
        AutenticacionRequeridaError,
      );
    });

    it('debe rechazar JWT sin claim de audiencia (aud)', async () => {
      const secretBytes = new TextEncoder().encode(testSecret);
      const token = await new jose.SignJWT({
        realm_access: { roles: ['ODONTOLOGO'] },
        iss: validIssuer,
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject('od_keycloak_sub_999')
        .setExpirationTime('2h')
        .sign(secretBytes);

      await expect(adapter.obtenerOdontologoActual(token)).rejects.toThrow(
        AutenticacionRequeridaError,
      );
    });

    it('debe rechazar JWT con audiencia (aud) no coincidente (e.g. nombre de realm "dental-platform")', async () => {
      const secretBytes = new TextEncoder().encode(testSecret);
      const token = await new jose.SignJWT({
        realm_access: { roles: ['ODONTOLOGO'] },
        iss: validIssuer,
        aud: 'dental-platform',
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject('od_keycloak_sub_999')
        .setExpirationTime('2h')
        .sign(secretBytes);

      await expect(adapter.obtenerOdontologoActual(token)).rejects.toThrow(
        AutenticacionRequeridaError,
      );
    });

    it('debe rechazar JWT con audiencia tipo array que no contiene "ms2-clinico-ia"', async () => {
      const secretBytes = new TextEncoder().encode(testSecret);
      const token = await new jose.SignJWT({
        realm_access: { roles: ['ODONTOLOGO'] },
        iss: validIssuer,
        aud: ['ms-erp', 'ms3-agenda-stock'],
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject('od_keycloak_sub_999')
        .setExpirationTime('2h')
        .sign(secretBytes);

      await expect(adapter.obtenerOdontologoActual(token)).rejects.toThrow(
        AutenticacionRequeridaError,
      );
    });

    it('debe aceptar JWT con audiencia válida como string exacto ("ms2-clinico-ia") y emisor válido', async () => {
      const secretBytes = new TextEncoder().encode(testSecret);
      const token = await new jose.SignJWT({
        realm_access: { roles: ['ODONTOLOGO'] },
        iss: validIssuer,
        aud: 'ms2-clinico-ia',
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject('od_keycloak_sub_999')
        .setExpirationTime('2h')
        .sign(secretBytes);

      const ctx = await adapter.obtenerOdontologoActual(token);
      expect(ctx.odontologoId).toBe('od_keycloak_sub_999');
      expect(ctx.roles).toContain('ODONTOLOGO');
    });

    it('debe aceptar JWT con audiencia válida como array de strings que contiene "ms2-clinico-ia"', async () => {
      const secretBytes = new TextEncoder().encode(testSecret);
      const token = await new jose.SignJWT({
        realm_access: { roles: ['ODONTOLOGO'] },
        iss: validIssuer,
        aud: ['ms2-clinico-ia', 'account'],
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject('od_keycloak_sub_array_aud')
        .setExpirationTime('2h')
        .sign(secretBytes);

      const ctx = await adapter.obtenerOdontologoActual(token);
      expect(ctx.odontologoId).toBe('od_keycloak_sub_array_aud');
      expect(ctx.roles).toContain('ODONTOLOGO');
    });

    it('debe respetar configuración personalizada de KEYCLOAK_ISSUER y KEYCLOAK_AUDIENCE', async () => {
      process.env.KEYCLOAK_ISSUER = 'https://auth.clinic.example.com/realms/custom-realm';
      process.env.KEYCLOAK_AUDIENCE = 'custom-clinico-client';

      const customAdapter = new KeycloakJwtOdontologoContextAdapter();
      const secretBytes = new TextEncoder().encode(testSecret);

      const tokenValido = await new jose.SignJWT({
        realm_access: { roles: ['ODONTOLOGO'] },
        iss: 'https://auth.clinic.example.com/realms/custom-realm',
        aud: 'custom-clinico-client',
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject('od_custom_cfg')
        .setExpirationTime('2h')
        .sign(secretBytes);

      const ctx = await customAdapter.obtenerOdontologoActual(tokenValido);
      expect(ctx.odontologoId).toBe('od_custom_cfg');

      delete process.env.KEYCLOAK_ISSUER;
      delete process.env.KEYCLOAK_AUDIENCE;
    });

    it('debe rechazar token firmado con RS256 si la audiencia no coincide', async () => {
      const keyPair = await jose.generateKeyPair('RS256');
      const exportedSpki = await jose.exportSPKI(keyPair.publicKey);

      delete process.env.JWT_SECRET;
      process.env.KEYCLOAK_PUBLIC_KEY = exportedSpki;

      const rs256Adapter = new KeycloakJwtOdontologoContextAdapter();

      const tokenWrongAud = await new jose.SignJWT({
        realm_access: { roles: ['ODONTOLOGO'] },
        iss: defaultIssuer,
        aud: 'dental-platform',
      })
        .setProtectedHeader({ alg: 'RS256' })
        .setSubject('od_rs256_wrong_aud')
        .setExpirationTime('1h')
        .sign(keyPair.privateKey);

      await expect(rs256Adapter.obtenerOdontologoActual(tokenWrongAud)).rejects.toThrow(
        AutenticacionRequeridaError,
      );

      delete process.env.KEYCLOAK_PUBLIC_KEY;
    });

    it('debe rechazar token firmado con RS256 si el emisor no coincide', async () => {
      const keyPair = await jose.generateKeyPair('RS256');
      const exportedSpki = await jose.exportSPKI(keyPair.publicKey);

      delete process.env.JWT_SECRET;
      process.env.KEYCLOAK_PUBLIC_KEY = exportedSpki;

      const rs256Adapter = new KeycloakJwtOdontologoContextAdapter();

      const tokenWrongIss = await new jose.SignJWT({
        realm_access: { roles: ['ODONTOLOGO'] },
        iss: 'http://otro-emisor-no-confiable/realms/dental-platform',
        aud: defaultAudience,
      })
        .setProtectedHeader({ alg: 'RS256' })
        .setSubject('od_rs256_wrong_iss')
        .setExpirationTime('1h')
        .sign(keyPair.privateKey);

      await expect(rs256Adapter.obtenerOdontologoActual(tokenWrongIss)).rejects.toThrow(
        AutenticacionRequeridaError,
      );

      delete process.env.KEYCLOAK_PUBLIC_KEY;
    });
  });
});
