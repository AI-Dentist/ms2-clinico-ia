import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { HistoriaClinicaNoEncontradaError } from '../../../domain/errors/historia-clinica-no-encontrada.error.js';
import { HistoriaClinicaDuplicadaError } from '../../../domain/errors/historia-clinica-duplicada.error.js';
import { ConflictoConcurrenteError } from '../../../domain/errors/conflicto-concurrente.error.js';
import { HistoriaClinicaNoEditableError } from '../../../domain/errors/historia-clinica-no-editable.error.js';
import { TransicionEstadoInvalidaError } from '../../../domain/errors/transicion-estado-invalida.error.js';
import { AlergiaDuplicadaError } from '../../../domain/errors/alergia-duplicada.error.js';
import { PacienteInexistenteError } from '../../../application/errors/paciente-inexistente.error.js';
import { AutenticacionRequeridaError } from '../../../application/errors/autenticacion-requerida.error.js';

export interface InvalidParam {
  name: string;
  reason: string;
}

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  timestamp: string;
  invalidParams?: InvalidParam[];
}

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const instance = request.originalUrl ?? request.url;
    const now = new Date().toISOString();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let title = 'Error interno del servidor';
    let detail = 'Ocurrió un error inesperado al procesar la solicitud.';
    let type = 'https://api.odontoclinic.local/errors/internal-error';
    let invalidParams: InvalidParam[] | undefined;

    // 1. Errores del Dominio y Aplicación de Historia Clínica
    if (exception instanceof HistoriaClinicaNoEncontradaError) {
      status = HttpStatus.NOT_FOUND;
      title = 'Historia clínica no encontrada';
      detail = exception.message;
      type = 'https://api.odontoclinic.local/errors/not-found';
    } else if (exception instanceof ConflictoConcurrenteError) {
      status = HttpStatus.CONFLICT;
      title = 'Conflicto de concurrencia optimista';
      detail = exception.message;
      type = 'https://api.odontoclinic.local/errors/conflict';
    } else if (exception instanceof HistoriaClinicaDuplicadaError) {
      status = HttpStatus.CONFLICT;
      title = 'Expediente clínico duplicado';
      detail = exception.message;
      type = 'https://api.odontoclinic.local/errors/duplicate-record';
    } else if (exception instanceof AutenticacionRequeridaError) {
      status = HttpStatus.UNAUTHORIZED;
      title = 'Autenticación requerida';
      detail = exception.message;
      type = 'https://api.odontoclinic.local/errors/unauthorized';
    } else if (exception instanceof PacienteInexistenteError) {
      status = HttpStatus.UNPROCESSABLE_ENTITY;
      title = 'Paciente no válido o inexistente';
      detail = exception.message;
      type = 'https://api.odontoclinic.local/errors/patient-not-found';
    } else if (exception instanceof HistoriaClinicaNoEditableError) {
      status = HttpStatus.UNPROCESSABLE_ENTITY;
      title = 'Expediente no editable';
      detail = exception.message;
      type = 'https://api.odontoclinic.local/errors/uneditable-chart';
    } else if (exception instanceof TransicionEstadoInvalidaError) {
      status = HttpStatus.UNPROCESSABLE_ENTITY;
      title = 'Transición de estado inválida';
      detail = exception.message;
      type = 'https://api.odontoclinic.local/errors/invalid-state-transition';
    } else if (exception instanceof AlergiaDuplicadaError) {
      status = HttpStatus.UNPROCESSABLE_ENTITY;
      title = 'Alergia duplicada';
      detail = exception.message;
      type = 'https://api.odontoclinic.local/errors/duplicate-allergy';
    } else if (
      exception instanceof Error &&
      exception.message.includes('No existe alergia registrada para la sustancia')
    ) {
      status = HttpStatus.NOT_FOUND;
      title = 'Alergia no encontrada';
      detail = exception.message;
      type = 'https://api.odontoclinic.local/errors/not-found';
    } else if (exception instanceof HttpException) {
      // 2. Excepciones HTTP estándar de NestJS (ValidationPipe, etc.)
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, unknown>;
        title = (resObj.error as string) ?? exception.message;

        // ValidationPipe produce array de mensajes en resObj.message
        if (Array.isArray(resObj.message)) {
          detail = 'Los datos proporcionados en la solicitud no superaron las validaciones requeridas.';
          invalidParams = (resObj.message as string[]).map((msg) => {
            const separator = msg.indexOf(' ');
            return {
              name: separator !== -1 ? msg.substring(0, separator) : 'campo',
              reason: msg,
            };
          });
        } else if (typeof resObj.message === 'string') {
          detail = resObj.message;
        } else {
          detail = exception.message;
        }
      } else {
        detail = exception.message;
      }

      switch (status) {
        case HttpStatus.BAD_REQUEST:
          type = 'https://api.odontoclinic.local/errors/bad-request';
          title = 'Solicitud incorrecta';
          break;
        case HttpStatus.UNAUTHORIZED:
          type = 'https://api.odontoclinic.local/errors/unauthorized';
          title = 'Autenticación requerida';
          break;
        case HttpStatus.FORBIDDEN:
          type = 'https://api.odontoclinic.local/errors/forbidden';
          title = 'Acceso denegado';
          break;
        case HttpStatus.NOT_FOUND:
          type = 'https://api.odontoclinic.local/errors/not-found';
          title = 'Recurso no encontrado';
          break;
        case HttpStatus.CONFLICT:
          type = 'https://api.odontoclinic.local/errors/conflict';
          title = 'Conflicto';
          break;
        case HttpStatus.UNPROCESSABLE_ENTITY:
          type = 'https://api.odontoclinic.local/errors/validation-error';
          title = 'Entidad no procesable';
          break;
        default:
          type = 'https://api.odontoclinic.local/errors/http-error';
      }
    } else {
      // 3. Excepciones imprevistas (sanitizadas para no exponer datos clínicos)
      const errorMsg = exception instanceof Error ? exception.message : String(exception);
      this.logger.error(`Error no controlado en [${request.method} ${instance}]: ${errorMsg}`);
    }

    const problem: ProblemDetails = {
      type,
      title,
      status,
      detail,
      instance,
      timestamp: now,
      ...(invalidParams && invalidParams.length > 0 ? { invalidParams } : {}),
    };

    response.status(status).header('Content-Type', 'application/problem+json').json(problem);
  }
}
