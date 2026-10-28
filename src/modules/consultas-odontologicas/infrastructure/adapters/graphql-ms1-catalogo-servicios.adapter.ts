import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  ICatalogoServiciosPort,
  ServicioCatalogoDto,
} from '../../application/ports/catalogo-servicios.port.js';
import {
  MS1_CREDENTIALS_PROVIDER,
  type IMs1CredentialsProvider,
} from '../../../historias-clinicas/infrastructure/adapters/ms1-credentials-provider.port.js';
import {
  AutenticacionMs1Error,
  Ms1GraphqlError,
} from '../../../historias-clinicas/infrastructure/adapters/errors/index.js';
import { CatalogoServiciosNoDisponibleError } from './errors/catalogo-servicios-no-disponible.error.js';
import { IdServicioInvalidoError } from './errors/id-servicio-invalido.error.js';

export const LISTAR_SERVICIOS_QUERY = `query ListarServiciosOdontologicos($especialidadId: UUID) {
  listarServiciosOdontologicos(especialidadId: $especialidadId) {
    id
    codigo
    nombre
    descripcion
    precioBaseBs
    activo
    especialidad {
      id
      codigo
      nombre
      descripcion
      activo
    }
  }
}`;

const RFC_4122_UUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

interface RawServicioGraphQL {
  id: string;
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  precioBaseBs: number | string;
  activo: boolean;
  especialidad?: {
    id: string;
    codigo: string;
    nombre: string;
    descripcion?: string | null;
    activo: boolean;
  } | null;
}

interface ListarServiciosGraphQLResponse {
  data?: {
    listarServiciosOdontologicos?: RawServicioGraphQL[] | null;
  } | null;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: string[];
    extensions?: Record<string, unknown>;
  }>;
}

/**
 * Convierte el valor monetario a string decimal exacto con 2 decimales
 * garantizando precisión financiera sin depender de redondeos de coma flotante.
 */
export function formatearPrecioDecimal(valor: unknown): string {
  if (typeof valor === 'string') {
    const num = Number(valor.trim());
    if (isNaN(num) || num < 0) {
      throw new Error(`Precio base inválido: '${valor}'`);
    }
    return num.toFixed(2);
  }
  if (typeof valor === 'number') {
    if (isNaN(valor) || valor < 0) {
      throw new Error(`Precio base inválido: '${valor}'`);
    }
    return valor.toFixed(2);
  }
  throw new Error(`Precio base inválido o ausente: '${String(valor)}'`);
}

/**
 * Adaptador GraphQL real para consultar el catálogo maestro de servicios odontológicos de MS1.
 */
@Injectable()
export class GraphqlMs1CatalogoServiciosAdapter implements ICatalogoServiciosPort {
  private readonly logger = new Logger(GraphqlMs1CatalogoServiciosAdapter.name);
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

  async listarServiciosActivos(especialidadId?: string): Promise<ServicioCatalogoDto[]> {
    let espIdFiltrada: string | null = null;
    if (especialidadId !== undefined && especialidadId !== null && especialidadId.trim() !== '') {
      const limpia = especialidadId.trim();
      if (!RFC_4122_UUID_REGEX.test(limpia)) {
        throw new IdServicioInvalidoError(especialidadId);
      }
      espIdFiltrada = limpia;
    }

    const bearerToken = await this.credentialsProvider.getBearerToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    if (bearerToken) {
      headers['Authorization'] = `Bearer ${bearerToken}`;
    }

    let response: Response;
    try {
      response = await fetch(this.ms1GraphqlUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query: LISTAR_SERVICIOS_QUERY,
          variables: { especialidadId: espIdFiltrada },
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
        throw new CatalogoServiciosNoDisponibleError(
          `Timeout tras ${this.timeoutMs}ms consultando catálogo de servicios en MS1 (${this.ms1GraphqlUrl}).`,
          error,
        );
      }

      throw new CatalogoServiciosNoDisponibleError(
        `Error de red o conexión al consultar catálogo de servicios en MS1 (${this.ms1GraphqlUrl}): ${error instanceof Error ? error.message : String(error)}`,
        error,
      );
    }

    if (response.status === 401) {
      throw new AutenticacionMs1Error(
        401,
        'MS1 rechazó la consulta del catálogo: token de autenticación requerido, inválido o expirado.',
      );
    }

    if (response.status === 403) {
      throw new AutenticacionMs1Error(
        403,
        'MS1 denegó el acceso: permisos insuficientes para consultar el catálogo de servicios odontológicos.',
      );
    }

    if (!response.ok) {
      throw new CatalogoServiciosNoDisponibleError(
        `MS1 respondió con código HTTP no exitoso: ${response.status} ${response.statusText}.`,
      );
    }

    let jsonBody: ListarServiciosGraphQLResponse;
    try {
      jsonBody = (await response.json()) as ListarServiciosGraphQLResponse;
    } catch (error: unknown) {
      throw new CatalogoServiciosNoDisponibleError(
        'La respuesta devuelta por MS1 no corresponde a un documento JSON válido.',
        error,
      );
    }

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

    const items = jsonBody.data?.listarServiciosOdontologicos ?? [];
    return items
      .filter((item) => item.activo)
      .map((item) => ({
        id: item.id,
        codigo: item.codigo,
        nombre: item.nombre,
        descripcion: item.descripcion ?? null,
        precioBaseBs: formatearPrecioDecimal(item.precioBaseBs),
        activo: item.activo,
        especialidad: item.especialidad
          ? {
              id: item.especialidad.id,
              codigo: item.especialidad.codigo,
              nombre: item.especialidad.nombre,
              descripcion: item.especialidad.descripcion ?? null,
              activo: item.especialidad.activo,
            }
          : null,
      }));
  }

  async obtenerServicioPorId(servicioId: string): Promise<ServicioCatalogoDto | null> {
    const idLimpio = servicioId?.trim();
    if (!idLimpio || !RFC_4122_UUID_REGEX.test(idLimpio)) {
      throw new IdServicioInvalidoError(servicioId);
    }

    const servicios = await this.listarServiciosActivos();
    const encontrado = servicios.find((s) => s.id.toLowerCase() === idLimpio.toLowerCase());
    return encontrado ?? null;
  }
}

