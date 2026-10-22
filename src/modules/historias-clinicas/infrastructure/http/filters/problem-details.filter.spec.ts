import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ArgumentsHost, BadRequestException, HttpStatus } from '@nestjs/common';
import { ProblemDetailsFilter } from './problem-details.filter.js';
import { HistoriaClinicaNoEncontradaError } from '../../../domain/errors/historia-clinica-no-encontrada.error.js';
import { ConflictoConcurrenteError } from '../../../domain/errors/conflicto-concurrente.error.js';
import { HistoriaClinicaDuplicadaError } from '../../../domain/errors/historia-clinica-duplicada.error.js';
import { HistoriaClinicaNoEditableError } from '../../../domain/errors/historia-clinica-no-editable.error.js';
import { TransicionEstadoInvalidaError } from '../../../domain/errors/transicion-estado-invalida.error.js';
import { AlergiaDuplicadaError } from '../../../domain/errors/alergia-duplicada.error.js';
import { PacienteInexistenteError } from '../../../application/errors/paciente-inexistente.error.js';
import { AutenticacionRequeridaError } from '../../../application/errors/autenticacion-requerida.error.js';
import { EstadoHistoria } from '../../../domain/value-objects/estado-historia.enum.js';

describe('ProblemDetailsFilter', () => {
  let filter: ProblemDetailsFilter;
  let mockStatus: ReturnType<typeof vi.fn>;
  let mockHeader: ReturnType<typeof vi.fn>;
  let mockJson: ReturnType<typeof vi.fn>;
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new ProblemDetailsFilter();
    mockJson = vi.fn();
    mockHeader = vi.fn().mockReturnThis();
    mockStatus = vi.fn().mockReturnValue({
      header: mockHeader,
      json: mockJson,
    });

    const mockRequest = {
      originalUrl: '/api/expediente/historias-clinicas/test-id',
      method: 'GET',
    };

    const mockResponse = {
      status: mockStatus,
    };

    mockHost = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    } as unknown as ArgumentsHost;
  });

  it('debe mapear HistoriaClinicaNoEncontradaError a HTTP 404', () => {
    const error = new HistoriaClinicaNoEncontradaError('pac-001');
    filter.catch(error, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(mockHeader).toHaveBeenCalledWith('Content-Type', 'application/problem+json');
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 404,
        title: 'Historia clínica no encontrada',
        detail: "No existe historia clínica para el paciente 'pac-001'.",
        type: 'https://api.odontoclinic.local/errors/not-found',
      }),
    );
  });

  it('debe mapear ConflictoConcurrenteError a HTTP 409', () => {
    const error = new ConflictoConcurrenteError(2);
    filter.catch(error, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 409,
        title: 'Conflicto de concurrencia optimista',
      }),
    );
  });

  it('debe mapear HistoriaClinicaDuplicadaError a HTTP 409', () => {
    const error = new HistoriaClinicaDuplicadaError('pac-001');
    filter.catch(error, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 409,
        title: 'Expediente clínico duplicado',
      }),
    );
  });

  it('debe mapear AutenticacionRequeridaError a HTTP 401', () => {
    const error = new AutenticacionRequeridaError('Token inválido');
    filter.catch(error, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 401,
        title: 'Autenticación requerida',
      }),
    );
  });

  it('debe mapear PacienteInexistenteError a HTTP 422', () => {
    const error = new PacienteInexistenteError('pac-inexistente');
    filter.catch(error, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 422,
        title: 'Paciente no válido o inexistente',
      }),
    );
  });

  it('debe mapear HistoriaClinicaNoEditableError a HTTP 422', () => {
    const error = new HistoriaClinicaNoEditableError(EstadoHistoria.CERRADA);
    filter.catch(error, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 422,
        title: 'Expediente no editable',
      }),
    );
  });

  it('debe mapear TransicionEstadoInvalidaError a HTTP 422', () => {
    const error = new TransicionEstadoInvalidaError(EstadoHistoria.ARCHIVADA, EstadoHistoria.ACTIVA);
    filter.catch(error, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 422,
        title: 'Transición de estado inválida',
      }),
    );
  });

  it('debe mapear AlergiaDuplicadaError a HTTP 422', () => {
    const error = new AlergiaDuplicadaError('Penicilina');
    filter.catch(error, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 422,
        title: 'Alergia duplicada',
      }),
    );
  });

  it('debe mapear BadRequestException con invalidParams para errores de validación', () => {
    const badRequest = new BadRequestException({
      error: 'Bad Request',
      message: ['pacienteId no debe estar vacío', 'versionEsperada debe ser mayor o igual a 1'],
    });

    filter.catch(badRequest, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 400,
        invalidParams: [
          { name: 'pacienteId', reason: 'pacienteId no debe estar vacío' },
          { name: 'versionEsperada', reason: 'versionEsperada debe ser mayor o igual a 1' },
        ],
      }),
    );
  });

  it('debe mapear errores desconocidos a HTTP 500 sin exponer detalles sensibles', () => {
    const errorDesconocido = new Error('Database password was leaked in raw string');
    filter.catch(errorDesconocido, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 500,
        title: 'Error interno del servidor',
        detail: 'Ocurrió un error inesperado al procesar la solicitud.',
      }),
    );
  });
});
