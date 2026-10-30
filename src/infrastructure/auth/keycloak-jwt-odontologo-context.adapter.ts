import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jose from 'jose';
import type {
  IOdontologoContextPort,
  OdontologoContexto,
} from '../../modules/historias-clinicas/domain/ports/odontologo-context.port.js';
import { AutenticacionRequeridaError } from '../../modules/historias-clinicas/application/errors/autenticacion-requerida.error.js';

@Injectable()
export class KeycloakJwtOdontologoContextAdapter implements IOdontologoContextPort {
  private readonly logger = new Logger(KeycloakJwtOdontologoContextAdapter.name);

  // Lista blanca sintética para entornos de desarrollo y testing
  private readonly tokensPermitidosDev = new Map<string, { odontologoId: string; roles: string[] }>([
    ['token_valido', { odontologoId: 'od_dev_001', roles: ['ODONTOLOGO', 'ADMIN'] }],
    ['token_valido_123', { odontologoId: 'od_operador_001', roles: ['ODONTOLOGO'] }],
    ['token_valido_editor', { odontologoId: 'od_editor_005', roles: ['ODONTOLOGO'] }],
    ['token_dev_henry', { odontologoId: 'od_henry_principal', roles: ['ODONTOLOGO', 'ADMIN'] }],
    ['token_e2e_principal', { odontologoId: 'od_e2e_001', roles: ['ODONTOLOGO', 'ADMIN'] }],
    ['token_e2e_secundario', { odontologoId: 'od_e2e_002', roles: ['ODONTOLOGO'] }],
  ]);

  private remoteJwks: ReturnType<typeof jose.createRemoteJWKSet> | null = null;
  private cachedJwksUrl: string | null = null;

  constructor(@Optional() private readonly configService?: ConfigService) {}

  async obtenerOdontologoActual(token: string): Promise<OdontologoContexto> {
    const t = token?.trim().replace(/^Bearer\s+/i, '');
    if (!t) {
      throw new AutenticacionRequeridaError('Token de autenticación no proporcionado.');
    }

    const isProduction =
      (this.configService?.get<string>('NODE_ENV') ?? process.env.NODE_ENV) === 'production';

    // 1. En entornos de test/dev, verificar si coincide con tokens sintéticos de lista blanca
    if (!isProduction && this.tokensPermitidosDev.has(t)) {
      const syn = this.tokensPermitidosDev.get(t)!;
      return {
        odontologoId: syn.odontologoId,
        roles: syn.roles,
        nombre: 'Odontólogo de Desarrollo',
      };
    }

    // 2. Si no es un JWT con formato header.payload.signature
    const parts = t.split('.');
    if (parts.length !== 3) {
      if (isProduction) {
        throw new AutenticacionRequeridaError(
          'El token proporcionado no cuenta con formato JWT válido.',
        );
      }
      this.logger.warn('Token no reconocido en lista blanca sintética ni como JWT válido.');
      throw new AutenticacionRequeridaError('Token de autenticación inválido o no reconocido.');
    }

    // 3. Procesamiento y verificación criptográfica JWT
    const keycloakUrl =
      this.configService?.get<string>('KEYCLOAK_URL') ??
      process.env.KEYCLOAK_URL ??
      'http://localhost:8080';
    const realm =
      this.configService?.get<string>('KEYCLOAK_REALM') ??
      process.env.KEYCLOAK_REALM ??
      'dental-platform';
    const rawPublicKey =
      this.configService?.get<string>('KEYCLOAK_PUBLIC_KEY') ??
      process.env.KEYCLOAK_PUBLIC_KEY;
    const jwtSecret =
      this.configService?.get<string>('JWT_SECRET') ?? process.env.JWT_SECRET;

    try {
      let payload: jose.JWTPayload;

      if (rawPublicKey) {
        // Clave pública directa configurada (RS256)
        const pem = this.formatPublicKey(rawPublicKey);
        const publicKey = await jose.importSPKI(pem, 'RS256');
        const verification = await jose.jwtVerify(t, publicKey, {
          algorithms: ['RS256'],
        });
        payload = verification.payload;
      } else if (jwtSecret) {
        // Secreto simétrico configurado (HS256)
        const secretBytes = new TextEncoder().encode(jwtSecret);
        const verification = await jose.jwtVerify(t, secretBytes);
        payload = verification.payload;
      } else {
        // Endpoint JWKS de Keycloak
        const jwksUrlString = `${keycloakUrl.replace(/\/+$/, '')}/realms/${encodeURIComponent(realm)}/protocol/openid-connect/certs`;
        if (!this.remoteJwks || this.cachedJwksUrl !== jwksUrlString) {
          this.cachedJwksUrl = jwksUrlString;
          this.remoteJwks = jose.createRemoteJWKSet(new URL(jwksUrlString));
        }
        try {
          const verification = await jose.jwtVerify(t, this.remoteJwks);
          payload = verification.payload;
        } catch (jwksErr) {
          if (!isProduction) {
            // En desarrollo/test con Keycloak offline, permitir decodificación con verificación de caducidad
            this.logger.warn(
              `Keycloak JWKS no disponible (${(jwksErr as Error).message}). Decodificando JWT en modo tolerante dev/test.`,
            );
            payload = jose.decodeJwt(t);
            const nowSec = Math.floor(Date.now() / 1000);
            if (typeof payload.exp === 'number' && payload.exp < nowSec) {
              throw new AutenticacionRequeridaError('Token JWT expirado.');
            }
            if (typeof payload.nbf === 'number' && payload.nbf > nowSec) {
              throw new AutenticacionRequeridaError('Token JWT aún no es válido (nbf).');
            }
          } else {
            throw jwksErr;
          }
        }
      }

      if (!payload.sub || typeof payload.sub !== 'string' || !payload.sub.trim()) {
        throw new AutenticacionRequeridaError(
          "El token JWT no contiene el 'sub' obligatorio con el ID del operador.",
        );
      }

      const roles = this.extraerRoles(payload);

      return {
        odontologoId: payload.sub.trim(),
        roles,
        email: typeof payload.email === 'string' ? payload.email : undefined,
        nombre:
          typeof payload.name === 'string'
            ? payload.name
            : typeof payload.preferred_username === 'string'
              ? payload.preferred_username
              : undefined,
      };
    } catch (err: any) {
      if (err instanceof AutenticacionRequeridaError) {
        throw err;
      }
      this.logger.warn(`Fallo de verificación de token JWT: ${err.message}`);
      throw new AutenticacionRequeridaError(
        `Token JWT inválido, expirado o con firma no verificada: ${err.message}`,
      );
    }
  }

  private extraerRoles(payload: jose.JWTPayload): string[] {
    const rolesSet = new Set<string>();

    const addRole = (role: string) => {
      const trimmed = role.trim().toUpperCase();
      if (!trimmed) return;
      rolesSet.add(trimmed);
      if (trimmed.startsWith('ROLE_')) {
        rolesSet.add(trimmed.replace(/^ROLE_/, ''));
      }
    };

    // 1. Keycloak realm_access.roles
    const realmAccess = payload.realm_access as { roles?: string[] } | undefined;
    if (realmAccess && Array.isArray(realmAccess.roles)) {
      for (const r of realmAccess.roles) {
        if (typeof r === 'string') addRole(r);
      }
    }

    // 2. Keycloak resource_access[client].roles
    const resourceAccess = payload.resource_access as
      | Record<string, { roles?: string[] }>
      | undefined;
    if (resourceAccess && typeof resourceAccess === 'object') {
      for (const clientKey of Object.keys(resourceAccess)) {
        const clientObj = resourceAccess[clientKey];
        if (clientObj && Array.isArray(clientObj.roles)) {
          for (const r of clientObj.roles) {
            if (typeof r === 'string') addRole(r);
          }
        }
      }
    }

    // 3. roles directos en payload
    if (Array.isArray(payload.roles)) {
      for (const r of payload.roles) {
        if (typeof r === 'string') addRole(r);
      }
    }

    // 4. scope string
    if (typeof payload.scope === 'string') {
      for (const s of payload.scope.split(' ')) {
        const upper = s.toUpperCase();
        if (upper === 'ADMIN' || upper === 'ODONTOLOGO') {
          addRole(upper);
        }
      }
    }

    return Array.from(rolesSet);
  }

  private formatPublicKey(key: string): string {
    const cleanKey = key.trim().replace(/\\n/g, '\n');
    if (cleanKey.includes('-----BEGIN PUBLIC KEY-----')) {
      return cleanKey;
    }
    return `-----BEGIN PUBLIC KEY-----\n${cleanKey}\n-----END PUBLIC KEY-----`;
  }
}
