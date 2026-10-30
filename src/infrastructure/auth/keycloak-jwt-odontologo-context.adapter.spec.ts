import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as jose from 'jose';
import { KeycloakJwtOdontologoContextAdapter } from './keycloak-jwt-odontologo-context.adapter.js';
import { AutenticacionRequeridaError } from '../../modules/historias-clinicas/application/errors/autenticacion-requerida.error.js';

describe('KeycloakJwtOdontologoContextAdapter', () => {
  let adapter: KeycloakJwtOdontologoContextAdapter;
  const originalEnv = process.env.NODE_ENV;
  const originalJwtSecret = process.env.JWT_SECRET;
  const testSecret = 'super_secret_jwt_key_for_testing_12345';

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
      .setExpirationTime('-1h')
      .sign(dummyKey);

    await expect(fallbackAdapter.obtenerOdontologoActual(expiredToken)).rejects.toThrow(
      /expirado/,
    );
  });
});
