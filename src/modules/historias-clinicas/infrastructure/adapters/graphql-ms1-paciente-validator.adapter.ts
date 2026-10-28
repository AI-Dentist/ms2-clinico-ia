import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { IPacienteValidatorPort } from '../../domain/ports/paciente-validator.port.js';
import {
  MS1_CREDENTIALS_PROVIDER,
  type IMs1CredentialsProvider,
} from './ms1-credentials-provider.port.js';
import {
  PacienteNoDisponibleError,
  AutenticacionMs1Error,
  Ms1GraphqlError,
  IdPacienteInvalidoError,
} from './errors/index.js';

export const OBTENER_PACIENTE_QUERY = `query ObtenerPaciente($id: UUID!) {
  obtenerPacientePorId(id: $id) {
    id
    activo
  }
}`;

const RFC_4122_UUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

interface GraphQLResponse {
  data?: {
    obtenerPacientePorId?: {
      id: string;
      activo: boolean;
    } | null;
  } | null;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: string[];
    extensions?: Record<string, unknown>;
  }>;
}

/**
 * Adaptador GraphQL real para verificar pacientes existentes en MS1 (Spring Boot).
 * Consulta la operación 'obtenerPacientePorId(id: UUID!)' en el endpoint GraphQL de MS1.
 *
 * Características:
 * - Valida sintaxis UUID antes de invocar la red para evitar errores de deserialización.
 * - Soporta timeout configurable (por defecto 2000 ms) usando AbortSignal.
 * - Utiliza proveedor de credenciales desacoplado para adjuntar token Bearer.
 * - Distingue paciente inexistente (retorna false) de fallos de infraestructura/auth (lanza error).
 * - Nunca interpreta un timeout, error de conexión o 401/403 como paciente inexistente.
 */
@Injectable()
export class GraphqlMs1PacienteValidatorAdapter implements IPacienteValidatorPort {
  private readonly logger = new Logger(GraphqlMs1PacienteValidatorAdapter.name);
  private readonly ms1GraphqlUrl: string;
  private readonly timeoutMs: number;

  constructor(
    @Inject(MS1_CREDENTIALS_PROVIDER)
    private readonly credentialsProvider: IMs1CredentialsProvider,
    @Optional()
    private readonly configService?: ConfigService,
  ) {
    this.ms1GraphqlUrl =
      this.configService?.get<string>('MS1_GRAPHQL_URL') ??
      process.env.MS1_GRAPHQL_URL ??
      'http://127.0.0.1:8081/graphql';

    const configuredTimeout =
      this.configService?.get<number>('MS1_TIMEOUT_MS') ??
      (process.env.MS1_TIMEOUT_MS ? Number(process.env.MS1_TIMEOUT_MS) : undefined);

    this.timeoutMs =
      configuredTimeout !== undefined && !isNaN(configuredTimeout) && configuredTimeout > 0
        ? configuredTimeout
        : 2000;
  }

  async existePaciente(pacienteId: string): Promise<boolean> {
    const idLimpio = pacienteId?.trim();

    // 1. Validar formato UUID (RFC 4122) requerido por MS1
    if (!idLimpio || !RFC_4122_UUID_REGEX.test(idLimpio)) {
      throw new IdPacienteInvalidoError(pacienteId);
    }

    // 2. Obtener token Bearer desde el proveedor de credenciales
    const bearerToken = await this.credentialsProvider.getBearerToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    if (bearerToken) {
      headers['Authorization'] = `Bearer ${bearerToken}`;
    }

    // 3. Ejecutar petición HTTP POST a MS1 con timeout configurable
    let response: Response;
    try {
      response = await fetch(this.ms1GraphqlUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query: OBTENER_PACIENTE_QUERY,
          variables: { id: idLimpio },
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        (error.name === 'TimeoutError' ||
          error.name === 'AbortError' ||
          error.message.toLowerCase().includes('timeout') ||
          error.message.toLowerCase().includes('aborted'))
      ) {
        throw new PacienteNoDisponibleError(
          `Timeout tras ${this.timeoutMs}ms consultando catálogo de pacientes en MS1 (${this.ms1GraphqlUrl}).`,
          error,
        );
      }

      throw new PacienteNoDisponibleError(
        `Error de red o conexión al consultar catálogo de pacientes en MS1 (${this.ms1GraphqlUrl}): ${error instanceof Error ? error.message : String(error)}`,
        error,
      );
    }

    // 4. Manejo de códigos HTTP de transporte
    if (response.status === 401) {
      throw new AutenticacionMs1Error(
        401,
        'MS1 rechazó la consulta: token de autenticación requerido, inválido o expirado.',
      );
    }

    if (response.status === 403) {
      throw new AutenticacionMs1Error(
        403,
        'MS1 denegó el acceso: permisos insuficientes para consultar el catálogo de pacientes.',
      );
    }

    if (!response.ok) {
      throw new PacienteNoDisponibleError(
        `MS1 respondió con código de estado HTTP no exitoso: ${response.status} ${response.statusText}.`,
      );
    }

    // 5. Deserializar y validar payload GraphQL
    let jsonBody: GraphQLResponse;
    try {
      jsonBody = (await response.json()) as GraphQLResponse;
    } catch (error: unknown) {
      throw new PacienteNoDisponibleError(
        'La respuesta devuelta por MS1 no corresponde a un documento JSON válido.',
        error,
      );
    }

    // 6. Manejo de errores a nivel de aplicación GraphQL
    if (jsonBody.errors && Array.isArray(jsonBody.errors) && jsonBody.errors.length > 0) {
      const isAuthError = jsonBody.errors.some(
        (err) =>
          err.extensions?.code === 'UNAUTHORIZED' ||
          err.extensions?.code === 'FORBIDDEN' ||
          err.message?.toLowerCase().includes('unauthorized') ||
          err.message?.toLowerCase().includes('forbidden') ||
          err.message?.toLowerCase().includes('access denied'),
      );

      if (isAuthError) {
        throw new AutenticacionMs1Error(
          403,
          jsonBody.errors.map((e) => e.message).join('; '),
        );
      }

      throw new Ms1GraphqlError(jsonBody.errors);
    }

    // 7. Interpretar resultado del paciente en MS1
    const paciente = jsonBody.data?.obtenerPacientePorId;
    if (!paciente) {
      this.logger.debug(`Paciente '${idLimpio}' no existe en MS1 (obtenerPacientePorId retornó null).`);
      return false;
    }

    if (paciente.activo === false) {
      this.logger.debug(`Paciente '${idLimpio}' existe en MS1 pero se encuentra inactivo (baja lógica).`);
      return false;
    }

    return true;
  }
}

