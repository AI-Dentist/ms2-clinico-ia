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
import {
  PacienteNoDisponibleError,
  AutenticacionMs1Error,
  Ms1GraphqlError,
  IdPacienteInvalidoError,
} from '../../adapters/errors/index.js';
import {
  CatalogoServiciosNoDisponibleError,
  IdServicioInvalidoError,
} from '../../../../consultas-odontologicas/infrastructure/adapters/errors/index.js';
import { ServicioCatalogoNoEncontradoError } from '../../../../consultas-odontologicas/application/errors/servicio-catalogo-no-encontrado.error.js';
import { ServicioFacturableInvalidoError } from '../../../../consultas-odontologicas/domain/errors/servicio-facturable-invalido.error.js';
import { ConsultaNoEncontradaError } from '../../../../consultas-odontologicas/domain/errors/consulta-no-encontrada.error.js';
import { ConflictoConcurrenteConsultaError } from '../../../../consultas-odontologicas/domain/errors/conflicto-concurrente-consulta.error.js';
import { CitaInvalidaParaConsultaError } from '../../../../consultas-odontologicas/domain/errors/cita-invalida-para-consulta.error.js';
import { HistoriaClinicaNoHabilitadaError } from '../../../../consultas-odontologicas/domain/errors/historia-clinica-no-habilitada.error.js';
import { ConsultaNoEditableError } from '../../../../consultas-odontologicas/domain/errors/consulta-no-editable.error.js';
import { RequisitosCierreConsultaIncumplidosError } from '../../../../consultas-odontologicas/domain/errors/requisitos-cierre-consulta-incumplidos.error.js';
import { JustificacionCancelacionRequeridaError } from '../../../../consultas-odontologicas/domain/errors/justificacion-cancelacion-requerida.error.js';
import { TransicionEstadoConsultaInvalidaError } from '../../../../consultas-odontologicas/domain/errors/transicion-estado-consulta-invalida.error.js';
import { PiezaDentalFDIInvalidaError } from '../../../../consultas-odontologicas/domain/errors/pieza-dental-fdi-invalida.error.js';
import { PacienteNoCoincideError } from '../../../../consultas-odontologicas/application/errors/paciente-no-coincide.error.js';
import { AutenticacionRequeridaError as AutenticacionRequeridaConsultasError } from '../../../../consultas-odontologicas/application/errors/autenticacion-requerida.error.js';
import { OdontogramaNoEncontradoError } from '../../../../odontogramas/domain/errors/odontograma-no-encontrado.error.js';
import { OdontogramaDuplicadoError } from '../../../../odontogramas/domain/errors/odontograma-duplicado.error.js';
import { ConflictoConcurrenteOdontogramaError } from '../../../../odontogramas/domain/errors/conflicto-concurrente-odontograma.error.js';
import { PiezaDentalOdontogramaDuplicadaError } from '../../../../odontogramas/domain/errors/pieza-dental-odontograma-duplicada.error.js';
import { EstadoAnatomicoIncompatibleError } from '../../../../odontogramas/domain/errors/estado-anatomico-incompatible.error.js';
import { SuperficieIncisalIncompatibleError } from '../../../../odontogramas/domain/errors/superficie-incisal-incompatible.error.js';
import { EnmiendaCorrectivaInvalidaError } from '../../../../odontogramas/domain/errors/enmienda-correctiva-invalida.error.js';
import { RevisionInvalidaError } from '../../../../odontogramas/application/errors/revision-invalida.error.js';
import { HistoriaClinicaInvalidaError } from '../../../../odontogramas/application/errors/historia-clinica-invalida.error.js';
import { ConsultaInvalidaError } from '../../../../odontogramas/application/errors/consulta-invalida.error.js';
import { TransaccionNoSoportadaError } from '../../../../odontogramas/infrastructure/persistence/mongo/errors/transaccion-no-soportada.error.js';
import { AutenticacionRequeridaError as AutenticacionRequeridaOdontogramasError } from '../../../../odontogramas/infrastructure/adapters/errors/autenticacion-requerida.error.js';

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
    } else if (exception instanceof IdPacienteInvalidoError) {
      status = HttpStatus.UNPROCESSABLE_ENTITY;
      title = 'Identificador de paciente inválido';
      detail = exception.message;
      type = 'https://api.odontoclinic.local/errors/invalid-patient-id';
    } else if (exception instanceof PacienteNoDisponibleError) {
      status = HttpStatus.SERVICE_UNAVAILABLE;
      title = 'Servicio de catálogo de pacientes no disponible';
      detail = exception.message;
      type = 'https://api.odontoclinic.local/errors/service-unavailable';
    } else if (exception instanceof CatalogoServiciosNoDisponibleError) {
      status = HttpStatus.SERVICE_UNAVAILABLE;
      title = 'Servicio de catálogo de servicios no disponible';
      detail = exception.message;
      type = 'https://api.odontoclinic.local/errors/service-unavailable';
    } else if (exception instanceof IdServicioInvalidoError) {
      status = HttpStatus.UNPROCESSABLE_ENTITY;
      title = 'Identificador de servicio inválido';
      detail = exception.message;
      type = 'https://api.odontoclinic.local/errors/invalid-service-id';
    } else if (exception instanceof ServicioCatalogoNoEncontradoError) {
      status = HttpStatus.NOT_FOUND;
      title = 'Servicio no encontrado en el catálogo';
      detail = exception.message;
      type = 'https://api.odontoclinic.local/errors/service-not-found';
    } else if (exception instanceof ServicioFacturableInvalidoError) {
      status = HttpStatus.UNPROCESSABLE_ENTITY;
      title = 'Servicio facturable inválido';
      detail = exception.message;
      type = 'https://api.odontoclinic.local/errors/invalid-billable-service';
    } else if (exception instanceof AutenticacionMs1Error) {
      status = HttpStatus.BAD_GATEWAY;
      title = 'Error de autenticación con catálogo externo';
      detail = exception.message;
      type = 'https://api.odontoclinic.local/errors/upstream-auth-error';
    } else if (exception instanceof Ms1GraphqlError) {
      status = HttpStatus.BAD_GATEWAY;
      title = 'Error en catálogo de pacientes externo';
      detail = exception.message;
      type = 'https://api.odontoclinic.local/errors/upstream-graphql-error';
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
    } else if (exception instanceof ConsultaNoEncontradaError) {
      status = HttpStatus.NOT_FOUND;
      title = 'Consulta odontológica no encontrada';
      detail = exception.message;
      type = 'https://api.odontoclinic.local/errors/not-found';
    } else if (exception instanceof ConflictoConcurrenteConsultaError) {
      status = HttpStatus.CONFLICT;
      title = 'Conflicto de concurrencia optimista en consulta';
      detail = exception.message;
      type = 'https://api.odontoclinic.local/errors/conflict';
    } else if (exception instanceof CitaInvalidaParaConsultaError) {
      const msg = exception.message.toLowerCase();
      if (
        msg.includes('duplicad') ||
        msg.includes('asociada') ||
        msg.includes('vinculada') ||
        msg.includes('ya fue atendida') ||
        msg.includes('colisión') ||
        msg.includes('clave duplicada')
      ) {
        status = HttpStatus.CONFLICT;
        title = 'Cita odontológica ya asignada';
        type = 'https://api.odontoclinic.local/errors/conflict';
      } else {
        status = HttpStatus.UNPROCESSABLE_ENTITY;
        title = 'Cita inválida para consulta';
        type = 'https://api.odontoclinic.local/errors/invalid-appointment';
      }
      detail = exception.message;
    } else if (exception instanceof AutenticacionRequeridaConsultasError) {
      status = HttpStatus.UNAUTHORIZED;
      title = 'Autenticación requerida';
      detail = exception.message;
      type = 'https://api.odontoclinic.local/errors/unauthorized';
    } else if (exception instanceof HistoriaClinicaNoHabilitadaError) {
      status = HttpStatus.UNPROCESSABLE_ENTITY;
      title = 'Historia clínica no habilitada';
      detail = exception.message;
      type = 'https://api.odontoclinic.local/errors/chart-not-eligible';
    } else if (exception instanceof PacienteNoCoincideError) {
      status = HttpStatus.UNPROCESSABLE_ENTITY;
      title = 'Paciente no coincide con la historia clínica';
      detail = exception.message;
      type = 'https://api.odontoclinic.local/errors/patient-mismatch';
    } else if (exception instanceof ConsultaNoEditableError) {
      status = HttpStatus.UNPROCESSABLE_ENTITY;
      title = 'Consulta no editable';
      detail = exception.message;
      type = 'https://api.odontoclinic.local/errors/uneditable-consultation';
    } else if (exception instanceof RequisitosCierreConsultaIncumplidosError) {
      status = HttpStatus.UNPROCESSABLE_ENTITY;
      title = 'Requisitos de cierre clínico incumplidos';
      detail = exception.message;
      type = 'https://api.odontoclinic.local/errors/closure-requirements-unmet';
    } else if (exception instanceof JustificacionCancelacionRequeridaError) {
      status = HttpStatus.UNPROCESSABLE_ENTITY;
      title = 'Justificación de cancelación requerida';
      detail = exception.message;
      type = 'https://api.odontoclinic.local/errors/cancellation-reason-required';
    } else if (exception instanceof TransicionEstadoConsultaInvalidaError) {
      status = HttpStatus.UNPROCESSABLE_ENTITY;
      title = 'Transición de estado de consulta inválida';
      detail = exception.message;
      type = 'https://api.odontoclinic.local/errors/invalid-state-transition';
    } else if (exception instanceof PiezaDentalFDIInvalidaError) {
      status = HttpStatus.UNPROCESSABLE_ENTITY;
      title = 'Pieza dental FDI inválida';
      detail = exception.message;
      type = 'https://api.odontoclinic.local/errors/invalid-fdi-tooth';
    } else if (exception instanceof OdontogramaNoEncontradoError) {
      status = HttpStatus.NOT_FOUND;
      title = 'Odontograma no encontrado';
      detail = exception.message;
      type = 'https://api.odontoclinic.local/errors/not-found';
    } else if (exception instanceof RevisionInvalidaError) {
      if (exception.message.toLowerCase().includes('no fue encontrada')) {
        status = HttpStatus.NOT_FOUND;
        title = 'Revisión no encontrada';
        type = 'https://api.odontoclinic.local/errors/not-found';
      } else {
        status = HttpStatus.UNPROCESSABLE_ENTITY;
        title = 'Revisión inválida';
        type = 'https://api.odontoclinic.local/errors/invalid-revision';
      }
      detail = exception.message;
    } else if (exception instanceof HistoriaClinicaInvalidaError) {
      if (exception.message.toLowerCase().includes('no existe')) {
        status = HttpStatus.NOT_FOUND;
        title = 'Historia clínica no encontrada';
        type = 'https://api.odontoclinic.local/errors/not-found';
      } else {
        status = HttpStatus.UNPROCESSABLE_ENTITY;
        title = 'Historia clínica no activa';
        type = 'https://api.odontoclinic.local/errors/chart-not-eligible';
      }
      detail = exception.message;
    } else if (exception instanceof ConsultaInvalidaError) {
      if (exception.message.toLowerCase().includes('no existe')) {
        status = HttpStatus.NOT_FOUND;
        title = 'Consulta odontológica no encontrada';
        type = 'https://api.odontoclinic.local/errors/not-found';
      } else {
        status = HttpStatus.UNPROCESSABLE_ENTITY;
        title = 'Incompatibilidad clínica con consulta';
        type = 'https://api.odontoclinic.local/errors/invalid-consultation';
      }
      detail = exception.message;
    } else if (exception instanceof OdontogramaDuplicadoError) {
      status = HttpStatus.CONFLICT;
      title = 'Odontograma duplicado';
      detail = exception.message;
      type = 'https://api.odontoclinic.local/errors/duplicate-record';
    } else if (exception instanceof ConflictoConcurrenteOdontogramaError) {
      status = HttpStatus.CONFLICT;
      title = 'Conflicto de concurrencia optimista en odontograma';
      detail = exception.message;
      type = 'https://api.odontoclinic.local/errors/conflict';
    } else if (exception instanceof PiezaDentalOdontogramaDuplicadaError) {
      status = HttpStatus.CONFLICT;
      title = 'Pieza dental duplicada en odontograma';
      detail = exception.message;
      type = 'https://api.odontoclinic.local/errors/conflict';
    } else if (exception instanceof EstadoAnatomicoIncompatibleError) {
      status = HttpStatus.UNPROCESSABLE_ENTITY;
      title = 'Condición anatómica incompatible';
      detail = exception.message;
      type = 'https://api.odontoclinic.local/errors/anatomical-incompatibility';
    } else if (exception instanceof SuperficieIncisalIncompatibleError) {
      status = HttpStatus.UNPROCESSABLE_ENTITY;
      title = 'Superficie incisal incompatible';
      detail = exception.message;
      type = 'https://api.odontoclinic.local/errors/incisal-surface-incompatibility';
    } else if (exception instanceof EnmiendaCorrectivaInvalidaError) {
      status = HttpStatus.UNPROCESSABLE_ENTITY;
      title = 'Enmienda correctiva inválida';
      detail = exception.message;
      type = 'https://api.odontoclinic.local/errors/invalid-amendment';
    } else if (exception instanceof TransaccionNoSoportadaError) {
      status = HttpStatus.SERVICE_UNAVAILABLE;
      title = 'Servicio de persistencia clínica no disponible';
      detail = 'El servicio de persistencia clínica no se encuentra disponible temporalmente para operaciones de escritura transaccional. Por favor intente más tarde.';
      type = 'https://api.odontoclinic.local/errors/service-unavailable';
    } else if (exception instanceof AutenticacionRequeridaOdontogramasError) {
      status = HttpStatus.UNAUTHORIZED;
      title = 'Autenticación requerida';
      detail = exception.message;
      type = 'https://api.odontoclinic.local/errors/unauthorized';
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
