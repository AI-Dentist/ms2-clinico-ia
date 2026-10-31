import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  ICitaValidatorPort,
  ResultadoValidacionCita,
} from '../../domain/ports/cita-validator.port.js';

interface Ms3CitaRaw {
  id?: string;
  paciente_id?: string;
  pacienteId?: string;
  odontologo_id?: string;
  odontologoId?: string;
  consultorio_id?: string;
  consultorioId?: string;
  fecha_hora?: string;
  fechaHora?: string;
  estado?: string;
  paciente?: { id?: string };
}

interface Ms3CitaResponse {
  success?: boolean;
  data?: Ms3CitaRaw | { citas?: Ms3CitaRaw[]; total?: number };
  citas?: Ms3CitaRaw[];
  cita?: Ms3CitaRaw;
  error?: string;
  code?: string;
}

const ESTADOS_VALIDOS_ATENCION = new Set([
  'RESERVADA',
  'CONFIRMADA',
  'EN_ATENCION',
  'PROGRAMADA',
  'PENDIENTE',
  'REPROGRAMADA',
]);

/**
 * Adaptador HTTP real para ICitaValidatorPort que valida citas en MS3 (Agendamiento & Stock - Laravel/DynamoDB).
 *
 * Características:
 * - Configura la URL base y timeout mediante variables de entorno (MS3_HTTP_URL, MS3_TIMEOUT_MS, MS3_BEARER_TOKEN).
 * - Consulta directamente la cita por ID (/api/agendamiento/citas/{id}) con fallback resiliente al listado (/api/agendamiento/citas).
 * - Valida pertenencia del paciente al expediente esperado (paciente_id vs pacienteId).
 * - Evalúa estados clínicos aptos para iniciar atención (RESERVADA, CONFIRMADA, EN_ATENCION, REPROGRAMADA, etc.)
 *   rechazando CANCELADA, COMPLETADA o NO_ASISTIO con motivos descriptivos.
 * - Maneja timeouts y fallas de red sin quebrar la ejecución, retornando un ResultadoValidacionCita limpio.
 */
@Injectable()
export class HttpMs3CitaValidatorAdapter implements ICitaValidatorPort {
  private readonly logger = new Logger(HttpMs3CitaValidatorAdapter.name);
  private readonly ms3BaseUrl: string;
  private readonly timeoutMs: number;
  private readonly bearerToken?: string;

  constructor(@Optional() private readonly configService?: ConfigService) {
    const rawUrl =
      this.configService?.get<string>('MS3_HTTP_URL') ??
      process.env.MS3_HTTP_URL ??
      'http://127.0.0.1:8000';
    const trimmedUrl = rawUrl.replace(/\/+$/, '');
    this.ms3BaseUrl = trimmedUrl.endsWith('/api/agendamiento')
      ? trimmedUrl
      : `${trimmedUrl}/api/agendamiento`;

    const configuredTimeout =
      this.configService?.get<number>('MS3_TIMEOUT_MS') ??
      (process.env.MS3_TIMEOUT_MS ? Number(process.env.MS3_TIMEOUT_MS) : undefined);
    this.timeoutMs =
      configuredTimeout !== undefined && !isNaN(configuredTimeout) && configuredTimeout > 0
        ? configuredTimeout
        : 2000;

    const rawToken =
      this.configService?.get<string>('MS3_BEARER_TOKEN') ??
      process.env.MS3_BEARER_TOKEN;
    this.bearerToken = rawToken && rawToken.trim() ? rawToken.trim() : undefined;
  }

  async validarCitaParaAtencion(
    citaId: string,
    pacienteId: string,
  ): Promise<ResultadoValidacionCita> {
    const idLimpio = citaId?.trim();
    if (!idLimpio) {
      return {
        esValida: false,
        motivoInvalidez: 'El identificador de cita no puede estar vacío.',
      };
    }

    const pacienteEsperado = pacienteId?.trim();
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    if (this.bearerToken) {
      headers['Authorization'] = `Bearer ${this.bearerToken}`;
    }

    // 1. Intento primario: consultar endpoint individual /api/agendamiento/citas/{id}
    const directUrl = `${this.ms3BaseUrl}/citas/${encodeURIComponent(idLimpio)}`;
    try {
      const response = await fetch(directUrl, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (response.ok) {
        const body = (await response.json()) as Ms3CitaResponse;
        const cita = this.extraerCitaDeRespuesta(body);
        if (cita) {
          return this.evaluarCita(cita, idLimpio, pacienteEsperado);
        }
      }

      if (response.status === 401 || response.status === 403) {
        this.logger.warn(
          `[HttpMs3CitaValidatorAdapter] Acceso no autorizado o prohibido al consultar cita '${idLimpio}' en MS3 (HTTP ${response.status}).`,
        );
        return {
          esValida: false,
          motivoInvalidez: `MS3 denegó el acceso al consultar la cita '${idLimpio}' (HTTP ${response.status}). Verifique credenciales de servicio.`,
        };
      }

      // Si el endpoint individual devuelve 404 (puede ser que la cita no existe o que MS3 solo expone /citas)
      if (response.status === 404) {
        // Ejecutar fallback al listado general para mayor compatibilidad
        return await this.consultarEnListadoFallback(idLimpio, pacienteEsperado, headers);
      }

      return {
        esValida: false,
        motivoInvalidez: `MS3 respondió con código de error HTTP ${response.status} al validar la cita '${idLimpio}'.`,
      };
    } catch (error: unknown) {
      return this.manejarErrorRed(error, idLimpio);
    }
  }

  private async consultarEnListadoFallback(
    citaId: string,
    pacienteEsperado: string,
    headers: Record<string, string>,
  ): Promise<ResultadoValidacionCita> {
    const listUrl = `${this.ms3BaseUrl}/citas`;
    try {
      const listResponse = await fetch(listUrl, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!listResponse.ok) {
        if (listResponse.status === 401 || listResponse.status === 403) {
          return {
            esValida: false,
            motivoInvalidez: `MS3 denegó el acceso al listar citas (HTTP ${listResponse.status}).`,
          };
        }
        return {
          esValida: false,
          motivoInvalidez: `La cita '${citaId}' no existe en la agenda de MS3 o no se encuentra confirmada.`,
        };
      }

      const listBody = (await listResponse.json()) as Ms3CitaResponse;
      const citas = this.extraerArrayDeCitas(listBody);
      const encontrada = citas.find(
        (c) => c.id && String(c.id).trim().toLowerCase() === citaId.toLowerCase(),
      );

      if (!encontrada) {
        return {
          esValida: false,
          motivoInvalidez: `La cita '${citaId}' no existe en la agenda de MS3 o no se encuentra confirmada.`,
        };
      }

      return this.evaluarCita(encontrada, citaId, pacienteEsperado);
    } catch (error: unknown) {
      return this.manejarErrorRed(error, citaId);
    }
  }

  private evaluarCita(
    cita: Ms3CitaRaw,
    citaId: string,
    pacienteEsperado: string,
  ): ResultadoValidacionCita {
    // 1. Validar titularidad del paciente
    const citaPacienteId = String(
      cita.paciente_id ?? cita.pacienteId ?? cita.paciente?.id ?? '',
    ).trim();

    if (pacienteEsperado && !citaPacienteId) {
      this.logger.debug(
        `Cita '${citaId}' rechazada: la cita en MS3 no tiene un paciente asociado para verificar titularidad.`,
      );
      return {
        esValida: false,
        motivoInvalidez: `La cita '${citaId}' no tiene un paciente asignado en MS3.`,
      };
    }

    if (
      citaPacienteId &&
      pacienteEsperado &&
      citaPacienteId.toLowerCase() !== pacienteEsperado.toLowerCase()
    ) {
      this.logger.debug(
        `Cita '${citaId}' rechazada: pertenece al paciente '${citaPacienteId}', pero la consulta es para '${pacienteEsperado}'.`,
      );
      return {
        esValida: false,
        motivoInvalidez: `La cita '${citaId}' pertenece a otro paciente en MS3.`,
      };
    }

    // 2. Validar estado de la cita
    const estado = String(cita.estado ?? '').trim().toUpperCase();

    if (estado === 'CANCELADA') {
      return {
        esValida: false,
        motivoInvalidez: `La cita '${citaId}' se encuentra CANCELADA en MS3.`,
      };
    }

    if (estado === 'COMPLETADA') {
      return {
        esValida: false,
        motivoInvalidez: `La cita '${citaId}' ya se encuentra COMPLETADA en MS3.`,
      };
    }

    if (estado === 'NO_ASISTIO') {
      return {
        esValida: false,
        motivoInvalidez: `La cita '${citaId}' se encuentra registrada como NO ASISTIÓ en MS3.`,
      };
    }

    if (!ESTADOS_VALIDOS_ATENCION.has(estado)) {
      return {
        esValida: false,
        motivoInvalidez: `La cita '${citaId}' tiene un estado no apto para atención clínica en MS3: '${estado}'.`,
      };
    }

    return { esValida: true };
  }

  private extraerCitaDeRespuesta(body: Ms3CitaResponse): Ms3CitaRaw | null {
    if (!body) return null;
    if (body.cita) return body.cita;
    if (body.data && !Array.isArray(body.data) && typeof body.data === 'object') {
      const dataObj = body.data as Record<string, unknown>;
      if ('cita' in dataObj && dataObj.cita && typeof dataObj.cita === 'object') {
        return dataObj.cita as Ms3CitaRaw;
      }
      if (!('citas' in dataObj)) {
        return body.data as Ms3CitaRaw;
      }
    }
    if (typeof body === 'object' && 'id' in body) {
      return body as unknown as Ms3CitaRaw;
    }
    return null;
  }

  private extraerArrayDeCitas(body: Ms3CitaResponse): Ms3CitaRaw[] {
    if (!body) return [];
    if (Array.isArray(body.citas)) return body.citas;
    if (body.data && typeof body.data === 'object') {
      const dataObj = body.data as { citas?: Ms3CitaRaw[] };
      if (Array.isArray(dataObj.citas)) return dataObj.citas;
      if (Array.isArray(body.data)) return body.data as Ms3CitaRaw[];
    }
    if (Array.isArray(body)) return body as Ms3CitaRaw[];
    return [];
  }

  private manejarErrorRed(error: unknown, citaId: string): ResultadoValidacionCita {
    const isTimeout =
      error instanceof Error &&
      (error.name === 'TimeoutError' ||
        error.name === 'AbortError' ||
        error.message.toLowerCase().includes('timeout') ||
        error.message.toLowerCase().includes('aborted'));

    const msg = isTimeout
      ? `Timeout tras ${this.timeoutMs}ms consultando la cita '${citaId}' en MS3 (${this.ms3BaseUrl}).`
      : `Error de red o conexión al consultar la cita '${citaId}' en MS3 (${this.ms3BaseUrl}): ${error instanceof Error ? error.message : String(error)}`;

    this.logger.warn(`[HttpMs3CitaValidatorAdapter] ${msg}`);
    return {
      esValida: false,
      motivoInvalidez: msg,
    };
  }
}
