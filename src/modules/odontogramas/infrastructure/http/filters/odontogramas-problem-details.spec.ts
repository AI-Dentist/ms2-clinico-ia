import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ArgumentsHost, BadRequestException, HttpStatus } from '@nestjs/common';
import { ProblemDetailsFilter } from '../../../../historias-clinicas/infrastructure/http/filters/problem-details.filter.js';
import { OdontogramaNoEncontradoError } from '../../../domain/errors/odontograma-no-encontrado.error.js';
import { OdontogramaDuplicadoError } from '../../../domain/errors/odontograma-duplicado.error.js';
import { ConflictoConcurrenteOdontogramaError } from '../../../domain/errors/conflicto-concurrente-odontograma.error.js';
import { PiezaDentalOdontogramaDuplicadaError } from '../../../domain/errors/pieza-dental-odontograma-duplicada.error.js';
import { EstadoAnatomicoIncompatibleError } from '../../../domain/errors/estado-anatomico-incompatible.error.js';
import { EstadoAnatomicoPieza } from '../../../domain/value-objects/estado-anatomico-pieza.enum.js';
import { CondicionSuperficie } from '../../../domain/value-objects/condicion-superficie.enum.js';
import { SuperficieIncisalIncompatibleError } from '../../../domain/errors/superficie-incisal-incompatible.error.js';
import { EnmiendaCorrectivaInvalidaError } from '../../../domain/errors/enmienda-correctiva-invalida.error.js';
import { RevisionInvalidaError } from '../../../application/errors/revision-invalida.error.js';
import { HistoriaClinicaInvalidaError } from '../../../application/errors/historia-clinica-invalida.error.js';
import { ConsultaInvalidaError } from '../../../application/errors/consulta-invalida.error.js';
import { TransaccionNoSoportadaError } from '../../persistence/mongo/errors/transaccion-no-soportada.error.js';
import { AutenticacionRequeridaError } from '../../adapters/errors/autenticacion-requerida.error.js';

describe('ProblemDetailsFilter - Odontogramas Exceptions (RFC 7807)', () => {
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
      originalUrl: '/api/expediente/odontogramas/test-instance',
      method: 'POST',
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

  // 1. 401 Unauthorized
  it('1. debe mapear AutenticacionRequeridaError a HTTP 401 con RFC 7807', () => {
    const error = new AutenticacionRequeridaError('Token de autenticación no proporcionado.');
    filter.catch(error, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    expect(mockHeader).toHaveBeenCalledWith('Content-Type', 'application/problem+json');
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 401,
        title: 'Autenticación requerida',
        detail: 'Token de autenticación no proporcionado.',
        type: 'https://api.odontoclinic.local/errors/unauthorized',
        instance: '/api/expediente/odontogramas/test-instance',
      }),
    );
  });

  // 2. 400 Bad Request
  it('2. debe mapear BadRequestException con invalidParams detallados a HTTP 400', () => {
    const error = new BadRequestException({
      error: 'Bad Request',
      message: ['historiaClinicaId no debe ser vacío', 'versionEsperada debe ser mayor o igual a 1'],
    });
    filter.catch(error, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 400,
        title: 'Solicitud incorrecta',
        type: 'https://api.odontoclinic.local/errors/bad-request',
        invalidParams: expect.arrayContaining([
          expect.objectContaining({ reason: 'historiaClinicaId no debe ser vacío' }),
          expect.objectContaining({ reason: 'versionEsperada debe ser mayor o igual a 1' }),
        ]),
      }),
    );
  });

  // 3. 404 OdontogramaNoEncontradoError
  it('3. debe mapear OdontogramaNoEncontradoError a HTTP 404', () => {
    const error = new OdontogramaNoEncontradoError('odo_inexistente_001');
    filter.catch(error, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 404,
        title: 'Odontograma no encontrado',
        detail: "Odontograma no encontrado con identificador 'odo_inexistente_001'.",
        type: 'https://api.odontoclinic.local/errors/not-found',
      }),
    );
  });

  // 4. 404 RevisionInvalidaError (no encontrada)
  it('4. debe mapear RevisionInvalidaError (no encontrada) a HTTP 404', () => {
    const error = RevisionInvalidaError.noEncontrada('rev_inexistente_999');
    filter.catch(error, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 404,
        title: 'Revisión no encontrada',
        detail: "La revisión histórica con ID 'rev_inexistente_999' no fue encontrada.",
        type: 'https://api.odontoclinic.local/errors/not-found',
      }),
    );
  });

  // 5. 404 HistoriaClinicaInvalidaError (no existe)
  it('5. debe mapear HistoriaClinicaInvalidaError (no existe) a HTTP 404', () => {
    const error = HistoriaClinicaInvalidaError.noEncontrada('hc_inexistente_001');
    filter.catch(error, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 404,
        title: 'Historia clínica no encontrada',
        type: 'https://api.odontoclinic.local/errors/not-found',
      }),
    );
  });

  // 6. 404 ConsultaInvalidaError (no existe)
  it('6. debe mapear ConsultaInvalidaError (no existe) a HTTP 404', () => {
    const error = ConsultaInvalidaError.noEncontrada('cons_inexistente_001');
    filter.catch(error, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 404,
        title: 'Consulta odontológica no encontrada',
        type: 'https://api.odontoclinic.local/errors/not-found',
      }),
    );
  });

  // 7. 409 OdontogramaDuplicadoError
  it('7. debe mapear OdontogramaDuplicadoError a HTTP 409', () => {
    const error = new OdontogramaDuplicadoError('hc_duplicada_001');
    filter.catch(error, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 409,
        title: 'Odontograma duplicado',
        detail: "Ya existe un odontograma registrado para la historia clínica 'hc_duplicada_001'.",
        type: 'https://api.odontoclinic.local/errors/duplicate-record',
      }),
    );
  });

  // 8. 409 ConflictoConcurrenteOdontogramaError
  it('8. debe mapear ConflictoConcurrenteOdontogramaError a HTTP 409', () => {
    const error = new ConflictoConcurrenteOdontogramaError('odo_colision_001', 3);
    filter.catch(error, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 409,
        title: 'Conflicto de concurrencia optimista en odontograma',
        type: 'https://api.odontoclinic.local/errors/conflict',
      }),
    );
  });

  // 9. 409 PiezaDentalOdontogramaDuplicadaError
  it('9. debe mapear PiezaDentalOdontogramaDuplicadaError a HTTP 409', () => {
    const error = new PiezaDentalOdontogramaDuplicadaError(16);
    filter.catch(error, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 409,
        title: 'Pieza dental duplicada en odontograma',
        type: 'https://api.odontoclinic.local/errors/conflict',
      }),
    );
  });

  // 10. 422 EstadoAnatomicoIncompatibleError
  it('10. debe mapear EstadoAnatomicoIncompatibleError a HTTP 422', () => {
    const error = new EstadoAnatomicoIncompatibleError(
      16,
      EstadoAnatomicoPieza.AUSENTE,
      CondicionSuperficie.CARIES,
    );
    filter.catch(error, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 422,
        title: 'Condición anatómica incompatible',
        type: 'https://api.odontoclinic.local/errors/anatomical-incompatibility',
      }),
    );
  });

  // 11. 422 SuperficieIncisalIncompatibleError
  it('11. debe mapear SuperficieIncisalIncompatibleError a HTTP 422', () => {
    const error = new SuperficieIncisalIncompatibleError(11);
    filter.catch(error, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 422,
        title: 'Superficie incisal incompatible',
        type: 'https://api.odontoclinic.local/errors/incisal-surface-incompatibility',
      }),
    );
  });

  // 12. 422 EnmiendaCorrectivaInvalidaError
  it('12. debe mapear EnmiendaCorrectivaInvalidaError a HTTP 422', () => {
    const error = new EnmiendaCorrectivaInvalidaError('No se especificó la revisión corregida');
    filter.catch(error, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 422,
        title: 'Enmienda correctiva inválida',
        type: 'https://api.odontoclinic.local/errors/invalid-amendment',
      }),
    );
  });

  // 13. 422 HistoriaClinicaInvalidaError (no activa)
  it('13. debe mapear HistoriaClinicaInvalidaError (no activa) a HTTP 422', () => {
    const error = HistoriaClinicaInvalidaError.noActiva('hc_001', 'CERRADA');
    filter.catch(error, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 422,
        title: 'Historia clínica no activa',
        type: 'https://api.odontoclinic.local/errors/chart-not-eligible',
      }),
    );
  });

  // 14. 422 ConsultaInvalidaError (incompatibilidad clínica)
  it('14. debe mapear ConsultaInvalidaError (incompatibilidad clínica) a HTTP 422', () => {
    const error = ConsultaInvalidaError.historiaDiferente('cons_001', 'hc_001', 'hc_002');
    filter.catch(error, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 422,
        title: 'Incompatibilidad clínica con consulta',
        type: 'https://api.odontoclinic.local/errors/invalid-consultation',
      }),
    );
  });

  // 15. 503 TransaccionNoSoportadaError (MongoDB Standalone)
  it('15. debe mapear TransaccionNoSoportadaError a HTTP 503 con mensaje técnico seguro sin exponer internals', () => {
    const error = new TransaccionNoSoportadaError();
    filter.catch(error, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 503,
        title: 'Servicio de persistencia clínica no disponible',
        detail:
          'El servicio de persistencia clínica no se encuentra disponible temporalmente para operaciones de escritura transaccional. Por favor intente más tarde.',
        type: 'https://api.odontoclinic.local/errors/service-unavailable',
      }),
    );
    // Verificar que no se exponen palabras de internals como Standalone o Replica Set en la respuesta HTTP
    const respuesta = mockJson.mock.calls[0][0];
    expect(respuesta.detail).not.toContain('Standalone');
    expect(respuesta.detail).not.toContain('Replica Set');
  });

  // 16. 500 Error inesperado sanitizado
  it('16. debe mapear un error inesperado no controlado a HTTP 500 sanitizado sin filtrar stack trace ni credenciales', () => {
    const errorInesperado = new Error('Database password leak: mongodb://admin:secret123@localhost:27017');
    filter.catch(errorInesperado, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 500,
        title: 'Error interno del servidor',
        detail: 'Ocurrió un error inesperado al procesar la solicitud.',
        type: 'https://api.odontoclinic.local/errors/internal-error',
      }),
    );
    const respuesta = mockJson.mock.calls[0][0];
    expect(respuesta.detail).not.toContain('secret123');
    expect(respuesta.detail).not.toContain('admin');
  });
});
