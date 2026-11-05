import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ICanonicalDoctorResolver } from './canonical-doctor-resolver.port.js';
import { AutenticacionRequeridaError } from '../../modules/historias-clinicas/application/errors/autenticacion-requerida.error.js';
import { ServicioIdentidadNoDisponibleError } from './servicio-identidad-no-disponible.error.js';

export const OBTENER_MI_ODONTOLOGO_ID_QUERY = `query ObtenerMiOdontologoId {
  obtenerMiOdontologoId
}`;

const RFC_4122_UUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

interface GraphQLResponse {
  data?: {
    obtenerMiOdontologoId?: string | null;
  } | null;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: string[];
    extensions?: Record<string, unknown>;
  }>;
}

/**
 * Adaptador GraphQL para resolver la identidad canónica del odontólogo en MS1 (Spring Boot / ERP).
 *
 * Ejecuta la consulta 'query ObtenerMiOdontologoId { obtenerMiOdontologoId }'
 * reenviando exclusivamente el token Bearer del llamador actual (Caller Identity).
 *
 * Invariantes de seguridad:
 * 1. NUNCA utiliza credenciales estáticas de servicio (MS1_BEARER_TOKEN) para auto-identidad.
 * 2. Sin estado mutable ni caché global de tokens/identidades entre peticiones concurrentes.
 * 3. Valida estrictamente que el valor devuelto sea un UUID (RFC 4122).
 * 4. Falla cerrado ante timeout, errores de red, HTTP 401/403/500, GraphQL errors o null (usuario no vinculado).
 */
@Injectable()
export class GraphqlMs1CanonicalDoctorResolverAdapter implements ICanonicalDoctorResolver {
  private readonly logger = new Logger(GraphqlMs1CanonicalDoctorResolverAdapter.name);
  private readonly ms1GraphqlUrl: string;
  private readonly timeoutMs: number;

  constructor(@Optional() private readonly configService?: ConfigService) {
    this.ms1GraphqlUrl =
      this.configService?.get<string>('MS1_GRAPHQL_URL') ??
      process.env.MS1_GRAPHQL_URL ??
      'http://127.0.0.1:8081/graphql';

    const rawTimeout =
      this.configService?.get<string | number>('MS1_TIMEOUT_MS') ?? process.env.MS1_TIMEOUT_MS;
    const parsedTimeout = rawTimeout !== undefined ? Number(rawTimeout) : undefined;

    this.timeoutMs =
      parsedTimeout !== undefined && !isNaN(parsedTimeout) && parsedTimeout > 0
        ? parsedTimeout
        : 2000;
  }

  async resolverOdontologoId(callerBearerToken: string): Promise<string> {
    const token = callerBearerToken?.trim().replace(/^Bearer\s+/i, '');
    if (!token) {
      throw new AutenticacionRequeridaError('Token de autenticación no proporcionado.');
    }

    let response: Response;
    try {
      response = await fetch(this.ms1GraphqlUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          // Reenviar estrictamente el token del llamador. NUNCA usar MS1_BEARER_TOKEN para self-identity.
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          query: OBTENER_MI_ODONTOLOGO_ID_QUERY,
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        (err.name === 'TimeoutError' ||
          err.name === 'AbortError' ||
          err.message.toLowerCase().includes('timeout') ||
          err.message.toLowerCase().includes('aborted'))
      ) {
        throw new ServicioIdentidadNoDisponibleError(
          `Timeout tras ${this.timeoutMs}ms consultando identidad de odontólogo en MS1 (${this.ms1GraphqlUrl}).`,
          err,
        );
      }

      throw new ServicioIdentidadNoDisponibleError(
        `Error de red o conexión al consultar identidad de odontólogo en MS1 (${this.ms1GraphqlUrl}): ${err instanceof Error ? err.message : String(err)}`,
        err,
      );
    }

    if (response.status === 401) {
      throw new AutenticacionRequeridaError(
        'MS1 rechazó la autenticación del operador (HTTP 401): token requerido, inválido o expirado.',
      );
    }

    if (response.status === 403) {
      throw new AutenticacionRequeridaError(
        'MS1 denegó el acceso (HTTP 403): permisos insuficientes para resolver la identidad del odontólogo.',
      );
    }

    if (response.status >= 500) {
      throw new ServicioIdentidadNoDisponibleError(
        `MS1 respondió con error de servidor HTTP ${response.status} ${response.statusText} al resolver identidad del odontólogo.`,
      );
    }

    if (!response.ok) {
      throw new AutenticacionRequeridaError(
        `MS1 respondió con error HTTP ${response.status} ${response.statusText} al resolver identidad del odontólogo.`,
      );
    }

    let jsonBody: GraphQLResponse;
    try {
      jsonBody = (await response.json()) as GraphQLResponse;
    } catch {
      throw new AutenticacionRequeridaError(
        'La respuesta devuelta por MS1 al resolver identidad no corresponde a un documento JSON válido.',
      );
    }

    if (Array.isArray(jsonBody.errors) && jsonBody.errors.length > 0) {
      const msg = jsonBody.errors.map((e) => e.message).join('; ');
      throw new AutenticacionRequeridaError(
        `MS1 no pudo resolver el odontólogo vinculado: ${msg}`,
      );
    }

    const rawId = jsonBody.data?.obtenerMiOdontologoId;
    if (!rawId || typeof rawId !== 'string' || !rawId.trim()) {
      throw new AutenticacionRequeridaError(
        'El usuario autenticado no está vinculado a un odontólogo activo en MS1.',
      );
    }

    const doctorUuid = rawId.trim();
    if (!RFC_4122_UUID_REGEX.test(doctorUuid)) {
      throw new AutenticacionRequeridaError(
        `El identificador de odontólogo devuelto por MS1 no tiene formato UUID válido: '${doctorUuid}'.`,
      );
    }

    return doctorUuid;
  }
}
