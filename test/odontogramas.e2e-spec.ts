import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, ValidationPipe, HttpStatus } from '@nestjs/common';
import request from 'supertest';

import { OdontogramasController } from '../src/modules/odontogramas/infrastructure/http/controllers/odontogramas.controller.js';
import { OdontologoAuthGuard } from '../src/modules/odontogramas/infrastructure/http/guards/odontologo-auth.guard.js';
import { ProblemDetailsFilter } from '../src/modules/historias-clinicas/infrastructure/http/filters/problem-details.filter.js';
import {
  ODONTOLOGO_CONTEXT_PORT,
  type IOdontologoContextPort,
  type OdontologoContexto,
} from '../src/modules/odontogramas/application/ports/odontologo-context.port.js';
import { AutenticacionRequeridaError } from '../src/modules/odontogramas/infrastructure/adapters/errors/autenticacion-requerida.error.js';

import {
  InicializarOdontogramaUseCase,
  ObtenerOdontogramaActualUseCase,
  RegistrarRevisionOdontogramaUseCase,
  ListarHistorialRevisionesUseCase,
  ObtenerSnapshotRevisionUseCase,
  ObtenerSnapshotsPorConsultaUseCase,
  type OdontogramaActualDto,
  type RevisionOdontogramaDto,
  type ListadoRevisionesPaginadoDto,
} from '../src/modules/odontogramas/application/index.js';

import { OdontogramaNoEncontradoError } from '../src/modules/odontogramas/domain/errors/odontograma-no-encontrado.error.js';
import { OdontogramaDuplicadoError } from '../src/modules/odontogramas/domain/errors/odontograma-duplicado.error.js';
import { ConflictoConcurrenteOdontogramaError } from '../src/modules/odontogramas/domain/errors/conflicto-concurrente-odontograma.error.js';
import { PiezaDentalOdontogramaDuplicadaError } from '../src/modules/odontogramas/domain/errors/pieza-dental-odontograma-duplicada.error.js';
import { EstadoAnatomicoIncompatibleError } from '../src/modules/odontogramas/domain/errors/estado-anatomico-incompatible.error.js';
import { SuperficieIncisalIncompatibleError } from '../src/modules/odontogramas/domain/errors/superficie-incisal-incompatible.error.js';
import { EnmiendaCorrectivaInvalidaError } from '../src/modules/odontogramas/domain/errors/enmienda-correctiva-invalida.error.js';
import { RevisionInvalidaError } from '../src/modules/odontogramas/application/errors/revision-invalida.error.js';
import { HistoriaClinicaInvalidaError } from '../src/modules/odontogramas/application/errors/historia-clinica-invalida.error.js';
import { ConsultaInvalidaError } from '../src/modules/odontogramas/application/errors/consulta-invalida.error.js';
import { TransaccionNoSoportadaError } from '../src/modules/odontogramas/infrastructure/persistence/mongo/errors/transaccion-no-soportada.error.js';

import { TipoRevisionOdontograma } from '../src/modules/odontogramas/domain/value-objects/tipo-revision-odontograma.enum.js';
import { EstadoAnatomicoPieza } from '../src/modules/odontogramas/domain/value-objects/estado-anatomico-pieza.enum.js';
import { TipoSuperficie } from '../src/modules/odontogramas/domain/value-objects/tipo-superficie.enum.js';
import { CondicionSuperficie } from '../src/modules/odontogramas/domain/value-objects/condicion-superficie.enum.js';

describe('Odontogramas API REST — Integración HTTP E2E (Supertest)', () => {
  let app: INestApplication;

  let mockOdontologoContextPort: IOdontologoContextPort;
  let mockInicializarUseCase: Partial<InicializarOdontogramaUseCase>;
  let mockObtenerActualUseCase: Partial<ObtenerOdontogramaActualUseCase>;
  let mockRegistrarRevisionUseCase: Partial<RegistrarRevisionOdontogramaUseCase>;
  let mockListarHistorialUseCase: Partial<ListarHistorialRevisionesUseCase>;
  let mockObtenerSnapshotUseCase: Partial<ObtenerSnapshotRevisionUseCase>;
  let mockObtenerPorConsultaUseCase: Partial<ObtenerSnapshotsPorConsultaUseCase>;

  const AUTH_VALID_HEADER = {
    Authorization: 'Bearer token_e2e_principal',
  };

  const mockOdontogramaActual: OdontogramaActualDto = {
    id: 'odo_e2e_001',
    historiaClinicaId: 'hc_e2e_001',
    pacienteId: 'pac_e2e_001',
    revisionActualId: 'rev_e2e_basal',
    totalRevisiones: 1,
    version: 1,
    creadoEn: '2026-10-26T08:00:00.000Z',
    actualizadoEn: '2026-10-26T08:00:00.000Z',
    actualizadoPor: 'od_001',
    piezas: [
      {
        numeroFDI: 16,
        estadoAnatomico: EstadoAnatomicoPieza.DESCONOCIDO,
        estadoEvaluacion: 'NO_EVALUADO',
        superficies: {
          OCLUSAL_INCISAL: {
            superficie: TipoSuperficie.OCLUSAL_INCISAL,
            condicion: CondicionSuperficie.NO_EVALUADA,
            evaluada: false,
          },
        },
        tratamientosEstructurales: [],
        observaciones: null,
      },
    ],
  };

  const mockRevision: RevisionOdontogramaDto = {
    id: 'rev_e2e_001',
    odontogramaId: 'odo_e2e_001',
    historiaClinicaId: 'hc_e2e_001',
    consultaId: 'cons_e2e_001',
    numeroRevision: 2,
    tipoRevision: TipoRevisionOdontograma.NUEVA_OBSERVACION,
    revisionCorregidaId: null,
    aplicaAlEstadoActual: true,
    fechaRegistro: '2026-10-26T08:30:00.000Z',
    fechaObservacionClinica: '2026-10-26T08:30:00.000Z',
    registradoPor: 'od_001',
    motivoRevision: 'Restauración oclusal de molar superior derecho',
    cambiosAplicados: [
      {
        numeroFDI: 16,
        estadoAnatomicoNuevo: EstadoAnatomicoPieza.PRESENTE,
        superficiesModificadas: [
          {
            superficie: TipoSuperficie.OCLUSAL_INCISAL,
            condicionAnterior: CondicionSuperficie.NO_EVALUADA,
            condicionNueva: CondicionSuperficie.OBTURACION_RESINA,
          },
        ],
      },
    ],
    snapshotPiezas: [],
  };

  const mockHistorialPaginado: ListadoRevisionesPaginadoDto = {
    total: 1,
    limite: 20,
    offset: 0,
    revisiones: [mockRevision],
  };

  beforeAll(async () => {
    mockOdontologoContextPort = {
      obtenerOdontologoActual: vi.fn().mockImplementation(async (token?: string): Promise<OdontologoContexto> => {
        if (token === 'token_e2e_principal' || token === 'token_valido_123') {
          return { odontologoId: 'od_operador_001' };
        }
        throw new AutenticacionRequeridaError('Token de autenticación inválido o no reconocido.');
      }),
    };

    mockInicializarUseCase = {
      ejecutar: vi.fn().mockResolvedValue(mockOdontogramaActual),
    };
    mockObtenerActualUseCase = {
      ejecutar: vi.fn().mockResolvedValue(mockOdontogramaActual),
    };
    mockRegistrarRevisionUseCase = {
      ejecutar: vi.fn().mockResolvedValue(mockRevision),
    };
    mockListarHistorialUseCase = {
      ejecutar: vi.fn().mockResolvedValue(mockHistorialPaginado),
    };
    mockObtenerSnapshotUseCase = {
      ejecutar: vi.fn().mockResolvedValue(mockRevision),
    };
    mockObtenerPorConsultaUseCase = {
      ejecutar: vi.fn().mockResolvedValue([mockRevision]),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [OdontogramasController],
      providers: [
        OdontologoAuthGuard,
        {
          provide: ODONTOLOGO_CONTEXT_PORT,
          useValue: mockOdontologoContextPort,
        },
        {
          provide: InicializarOdontogramaUseCase,
          useValue: mockInicializarUseCase,
        },
        {
          provide: ObtenerOdontogramaActualUseCase,
          useValue: mockObtenerActualUseCase,
        },
        {
          provide: RegistrarRevisionOdontogramaUseCase,
          useValue: mockRegistrarRevisionUseCase,
        },
        {
          provide: ListarHistorialRevisionesUseCase,
          useValue: mockListarHistorialUseCase,
        },
        {
          provide: ObtenerSnapshotRevisionUseCase,
          useValue: mockObtenerSnapshotUseCase,
        },
        {
          provide: ObtenerSnapshotsPorConsultaUseCase,
          useValue: mockObtenerPorConsultaUseCase,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/expediente');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new ProblemDetailsFilter());

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // SECCIÓN 1: AUTENTICACIÓN EN LOS SEIS ENDPOINTS REST
  // =========================================================================
  describe('1. Autenticación y Guard Odontológico en los 6 endpoints', () => {
    it('1.1 POST /inicializar - sin token debe responder 401 y no ejecutar el caso de uso', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/expediente/odontogramas/inicializar')
        .send({ historiaClinicaId: 'hc_e2e_001' })
        .expect(HttpStatus.UNAUTHORIZED);

      expect(res.body.title).toBe('Autenticación requerida');
      expect(mockInicializarUseCase.ejecutar).not.toHaveBeenCalled();
    });

    it('1.2 POST /inicializar - con esquema no Bearer (ej. Basic) debe responder 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/expediente/odontogramas/inicializar')
        .set('Authorization', 'Basic dXNlcjpwYXNz')
        .send({ historiaClinicaId: 'hc_e2e_001' })
        .expect(HttpStatus.UNAUTHORIZED);

      expect(res.body.status).toBe(401);
      expect(mockInicializarUseCase.ejecutar).not.toHaveBeenCalled();
    });

    it('1.3 POST /inicializar - con token desconocido fuera de lista blanca debe responder 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/expediente/odontogramas/inicializar')
        .set('Authorization', 'Bearer token_intruso_desconocido')
        .send({ historiaClinicaId: 'hc_e2e_001' })
        .expect(HttpStatus.UNAUTHORIZED);

      expect(res.body.status).toBe(401);
      expect(mockInicializarUseCase.ejecutar).not.toHaveBeenCalled();
    });

    it('1.4 GET /historia/:historiaClinicaId - sin token debe responder 401', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/expediente/odontogramas/historia/hc_e2e_001')
        .expect(HttpStatus.UNAUTHORIZED);

      expect(res.body.title).toBe('Autenticación requerida');
      expect(mockObtenerActualUseCase.ejecutar).not.toHaveBeenCalled();
    });

    it('1.5 GET /consulta/:consultaId - sin token debe responder 401', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/expediente/odontogramas/consulta/cons_e2e_001')
        .expect(HttpStatus.UNAUTHORIZED);

      expect(res.body.status).toBe(401);
      expect(mockObtenerPorConsultaUseCase.ejecutar).not.toHaveBeenCalled();
    });

    it('1.6 GET /:id/historial - sin token debe responder 401', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/expediente/odontogramas/odo_e2e_001/historial')
        .expect(HttpStatus.UNAUTHORIZED);

      expect(res.body.status).toBe(401);
      expect(mockListarHistorialUseCase.ejecutar).not.toHaveBeenCalled();
    });

    it('1.7 GET /:id/revisiones/:revisionId - sin token debe responder 401', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/expediente/odontogramas/odo_e2e_001/revisiones/rev_e2e_001')
        .expect(HttpStatus.UNAUTHORIZED);

      expect(res.body.status).toBe(401);
      expect(mockObtenerSnapshotUseCase.ejecutar).not.toHaveBeenCalled();
    });

    it('1.8 POST /:id/revisiones - sin token debe responder 401 y no invocar caso de uso', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/expediente/odontogramas/odo_e2e_001/revisiones')
        .send({
          versionEsperada: 1,
          tipoRevision: TipoRevisionOdontograma.NUEVA_OBSERVACION,
          fechaObservacionClinica: '2026-10-26T08:30:00.000Z',
          motivoRevision: 'Revisión periódica',
          deltas: [],
          aplicaAlEstadoActual: true,
        })
        .expect(HttpStatus.UNAUTHORIZED);

      expect(res.body.status).toBe(401);
      expect(mockRegistrarRevisionUseCase.ejecutar).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // SECCIÓN 2: VALIDACIÓN DE DTOs Y CONTRATOS HTTP (HTTP 400 PROBLEM DETAILS)
  // =========================================================================
  describe('2. Validación estricta de DTOs y parámetros HTTP (400)', () => {
    it('2.1 debe responder 400 cuando falta historiaClinicaId en inicializar', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/expediente/odontogramas/inicializar')
        .set(AUTH_VALID_HEADER)
        .send({})
        .expect(HttpStatus.BAD_REQUEST);

      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.body.status).toBe(400);
      expect(res.body.title).toBe('Solicitud incorrecta');
      expect(res.body.invalidParams).toBeDefined();
    });

    it('2.2 debe responder 400 cuando se intenta inyectar pacienteId u odontologoId en el body', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/expediente/odontogramas/inicializar')
        .set(AUTH_VALID_HEADER)
        .send({
          historiaClinicaId: 'hc_e2e_001',
          pacienteId: 'paciente_arbitrario_hacker',
          odontologoId: 'od_falso',
        })
        .expect(HttpStatus.BAD_REQUEST);

      expect(res.body.status).toBe(400);
      expect(mockInicializarUseCase.ejecutar).not.toHaveBeenCalled();
    });

    it('2.3 debe responder 400 si falta versionEsperada o es menor a 1 en registro de revisión', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/expediente/odontogramas/odo_e2e_001/revisiones')
        .set(AUTH_VALID_HEADER)
        .send({
          versionEsperada: 0,
          tipoRevision: TipoRevisionOdontograma.NUEVA_OBSERVACION,
          fechaObservacionClinica: '2026-10-26T08:30:00.000Z',
          motivoRevision: 'Test versión cero',
          deltas: [],
          aplicaAlEstadoActual: true,
        })
        .expect(HttpStatus.BAD_REQUEST);

      expect(res.body.status).toBe(400);
      expect(mockRegistrarRevisionUseCase.ejecutar).not.toHaveBeenCalled();
    });

    it('2.4 debe responder 400 cuando el número FDI no pertenece a las 52 posiciones válidas (ej: 19)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/expediente/odontogramas/odo_e2e_001/revisiones')
        .set(AUTH_VALID_HEADER)
        .send({
          versionEsperada: 1,
          tipoRevision: TipoRevisionOdontograma.NUEVA_OBSERVACION,
          fechaObservacionClinica: '2026-10-26T08:30:00.000Z',
          motivoRevision: 'Pieza inexistente 19',
          deltas: [
            {
              numeroFDI: 19,
              estadoAnatomicoNuevo: EstadoAnatomicoPieza.PRESENTE,
            },
          ],
          aplicaAlEstadoActual: true,
        })
        .expect(HttpStatus.BAD_REQUEST);

      expect(res.body.status).toBe(400);
      expect(res.body.detail).toContain('validaciones requeridas');
      expect(mockRegistrarRevisionUseCase.ejecutar).not.toHaveBeenCalled();
    });

    it('2.5 debe responder 400 si tipoRevision contiene un enum inventado', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/expediente/odontogramas/odo_e2e_001/revisiones')
        .set(AUTH_VALID_HEADER)
        .send({
          versionEsperada: 1,
          tipoRevision: 'TIPO_INVENTADO_NO_VALIDO',
          fechaObservacionClinica: '2026-10-26T08:30:00.000Z',
          motivoRevision: 'Enum inválido',
          deltas: [],
          aplicaAlEstadoActual: true,
        })
        .expect(HttpStatus.BAD_REQUEST);

      expect(res.body.status).toBe(400);
    });

    it('2.6 debe responder 400 cuando deltas anidados contienen superficies no reconocidas', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/expediente/odontogramas/odo_e2e_001/revisiones')
        .set(AUTH_VALID_HEADER)
        .send({
          versionEsperada: 1,
          tipoRevision: TipoRevisionOdontograma.NUEVA_OBSERVACION,
          fechaObservacionClinica: '2026-10-26T08:30:00.000Z',
          motivoRevision: 'Superficie falsa',
          deltas: [
            {
              numeroFDI: 16,
              superficiesModificadas: [
                {
                  superficie: 'SUPERFICIE_INVENTADA',
                  condicionAnterior: CondicionSuperficie.SANA,
                  condicionNueva: CondicionSuperficie.CARIES,
                },
              ],
            },
          ],
          aplicaAlEstadoActual: true,
        })
        .expect(HttpStatus.BAD_REQUEST);

      expect(res.body.status).toBe(400);
    });

    it('2.7 debe responder 400 si la fechaObservacionClinica no cumple formato ISO 8601', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/expediente/odontogramas/odo_e2e_001/revisiones')
        .set(AUTH_VALID_HEADER)
        .send({
          versionEsperada: 1,
          tipoRevision: TipoRevisionOdontograma.NUEVA_OBSERVACION,
          fechaObservacionClinica: '26/10/2026',
          motivoRevision: 'Fecha no ISO',
          deltas: [],
          aplicaAlEstadoActual: true,
        })
        .expect(HttpStatus.BAD_REQUEST);

      expect(res.body.status).toBe(400);
    });

    it('2.8 debe responder 400 si la paginación contiene limite > 100 u offset negativo', async () => {
      const resLimite = await request(app.getHttpServer())
        .get('/api/expediente/odontogramas/odo_e2e_001/historial?limite=200')
        .set(AUTH_VALID_HEADER)
        .expect(HttpStatus.BAD_REQUEST);

      expect(resLimite.body.status).toBe(400);

      const resOffset = await request(app.getHttpServer())
        .get('/api/expediente/odontogramas/odo_e2e_001/historial?offset=-5')
        .set(AUTH_VALID_HEADER)
        .expect(HttpStatus.BAD_REQUEST);

      expect(resOffset.body.status).toBe(400);
    });
  });

  // =========================================================================
  // SECCIÓN 3: FLUJOS EXITOSOS (201 CREATED Y 200 OK)
  // =========================================================================
  describe('3. Flujos exitosos en los 6 endpoints REST', () => {
    it('3.1 POST /inicializar - debe retornar 201 Created y preservar estados basales', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/expediente/odontogramas/inicializar')
        .set(AUTH_VALID_HEADER)
        .send({ historiaClinicaId: 'hc_e2e_001' })
        .expect(HttpStatus.CREATED);

      expect(res.body.id).toBe('odo_e2e_001');
      expect(res.body.piezas[0].numeroFDI).toBe(16);
      expect(res.body.piezas[0].estadoAnatomico).toBe(EstadoAnatomicoPieza.DESCONOCIDO);
      expect(res.body.piezas[0].estadoEvaluacion).toBe('NO_EVALUADO');
      expect(mockInicializarUseCase.ejecutar).toHaveBeenCalledWith({
        historiaClinicaId: 'hc_e2e_001',
        tokenOdontologo: 'token_e2e_principal',
      });
    });

    it('3.2 GET /historia/:historiaClinicaId - debe retornar 200 OK con odontograma actual consolidado', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/expediente/odontogramas/historia/hc_e2e_001')
        .set(AUTH_VALID_HEADER)
        .expect(HttpStatus.OK);

      expect(res.body.id).toBe('odo_e2e_001');
      expect(res.body.piezas[0].estadoAnatomico).toBe(EstadoAnatomicoPieza.DESCONOCIDO);
      expect(mockObtenerActualUseCase.ejecutar).toHaveBeenCalledWith({
        historiaClinicaId: 'hc_e2e_001',
      });
    });

    it('3.3 POST /:id/revisiones - debe retornar 201 Created con la revisión registrada', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/expediente/odontogramas/odo_e2e_001/revisiones')
        .set(AUTH_VALID_HEADER)
        .send({
          versionEsperada: 1,
          tipoRevision: TipoRevisionOdontograma.NUEVA_OBSERVACION,
          consultaId: 'cons_e2e_001',
          fechaObservacionClinica: '2026-10-26T08:30:00.000Z',
          motivoRevision: 'Restauración oclusal de molar superior derecho',
          deltas: [
            {
              numeroFDI: 16,
              estadoAnatomicoNuevo: EstadoAnatomicoPieza.PRESENTE,
              superficiesModificadas: [
                {
                  superficie: TipoSuperficie.OCLUSAL_INCISAL,
                  condicionAnterior: CondicionSuperficie.NO_EVALUADA,
                  condicionNueva: CondicionSuperficie.OBTURACION_RESINA,
                },
              ],
            },
          ],
          aplicaAlEstadoActual: true,
        })
        .expect(HttpStatus.CREATED);

      expect(res.body.id).toBe('rev_e2e_001');
      expect(res.body.numeroRevision).toBe(2);
      expect(mockRegistrarRevisionUseCase.ejecutar).toHaveBeenCalledWith({
        odontogramaId: 'odo_e2e_001',
        versionEsperada: 1,
        tipoRevision: TipoRevisionOdontograma.NUEVA_OBSERVACION,
        consultaId: 'cons_e2e_001',
        fechaObservacionClinica: '2026-10-26T08:30:00.000Z',
        motivoRevision: 'Restauración oclusal de molar superior derecho',
        deltas: expect.any(Array),
        revisionCorregidaId: undefined,
        aplicaAlEstadoActual: true,
        tokenOdontologo: 'token_e2e_principal',
      });
    });

    it('3.4 GET /:id/historial - debe retornar 200 OK paginado con total, límite y offset', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/expediente/odontogramas/odo_e2e_001/historial?limite=10&offset=0')
        .set(AUTH_VALID_HEADER)
        .expect(HttpStatus.OK);

      expect(res.body.total).toBe(1);
      expect(res.body.limite).toBe(20); // DTO defaults/returned
      expect(res.body.revisiones).toHaveLength(1);
      expect(mockListarHistorialUseCase.ejecutar).toHaveBeenCalledWith({
        odontogramaId: 'odo_e2e_001',
        limite: 10,
        offset: 0,
      });
    });

    it('3.5 GET /:id/revisiones/:revisionId - debe retornar 200 OK con el snapshot solicitado', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/expediente/odontogramas/odo_e2e_001/revisiones/rev_e2e_001')
        .set(AUTH_VALID_HEADER)
        .expect(HttpStatus.OK);

      expect(res.body.id).toBe('rev_e2e_001');
      expect(mockObtenerSnapshotUseCase.ejecutar).toHaveBeenCalledWith({
        odontogramaId: 'odo_e2e_001',
        revisionId: 'rev_e2e_001',
      });
    });

    it('3.6 GET /consulta/:consultaId - debe retornar 200 OK con múltiples revisiones si existen', async () => {
      const segundaRevision: RevisionOdontogramaDto = {
        ...mockRevision,
        id: 'rev_e2e_002',
        numeroRevision: 3,
      };
      mockObtenerPorConsultaUseCase.ejecutar = vi.fn().mockResolvedValue([mockRevision, segundaRevision]);

      const res = await request(app.getHttpServer())
        .get('/api/expediente/odontogramas/consulta/cons_e2e_001')
        .set(AUTH_VALID_HEADER)
        .expect(HttpStatus.OK);

      expect(res.body).toHaveLength(2);
      expect(res.body[0].id).toBe('rev_e2e_001');
      expect(res.body[1].id).toBe('rev_e2e_002');
      expect(mockObtenerPorConsultaUseCase.ejecutar).toHaveBeenCalledWith({
        consultaId: 'cons_e2e_001',
      });
    });
  });

  // =========================================================================
  // SECCIÓN 4: MANEJO DE EXCEPCIONES Y TRADUCCIÓN A PROBLEM DETAILS (RFC 7807)
  // =========================================================================
  describe('4. Mapeo semántico de excepciones hacia Problem Details (RFC 7807)', () => {
    it('4.1 Odontograma no encontrado -> debe responder 404', async () => {
      mockObtenerActualUseCase.ejecutar = vi.fn().mockRejectedValue(
        new OdontogramaNoEncontradoError('hc_inexistente'),
      );

      const res = await request(app.getHttpServer())
        .get('/api/expediente/odontogramas/historia/hc_inexistente')
        .set(AUTH_VALID_HEADER)
        .expect(HttpStatus.NOT_FOUND);

      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.body.status).toBe(404);
      expect(res.body.title).toBe('Odontograma no encontrado');
    });

    it('4.2 Revisión no encontrada -> debe responder 404', async () => {
      mockObtenerSnapshotUseCase.ejecutar = vi.fn().mockRejectedValue(
        RevisionInvalidaError.noEncontrada('rev_inexistente'),
      );

      const res = await request(app.getHttpServer())
        .get('/api/expediente/odontogramas/odo_e2e_001/revisiones/rev_inexistente')
        .set(AUTH_VALID_HEADER)
        .expect(HttpStatus.NOT_FOUND);

      expect(res.body.status).toBe(404);
      expect(res.body.title).toBe('Revisión no encontrada');
    });

    it('4.3 Odontograma duplicado -> debe responder 409 Conflict', async () => {
      mockInicializarUseCase.ejecutar = vi.fn().mockRejectedValue(
        new OdontogramaDuplicadoError('hc_ya_tiene_odo'),
      );

      const res = await request(app.getHttpServer())
        .post('/api/expediente/odontogramas/inicializar')
        .set(AUTH_VALID_HEADER)
        .send({ historiaClinicaId: 'hc_ya_tiene_odo' })
        .expect(HttpStatus.CONFLICT);

      expect(res.body.status).toBe(409);
      expect(res.body.title).toBe('Odontograma duplicado');
    });

    it('4.4 Conflicto de concurrencia optimista -> debe responder 409 Conflict', async () => {
      mockRegistrarRevisionUseCase.ejecutar = vi.fn().mockRejectedValue(
        new ConflictoConcurrenteOdontogramaError('odo_e2e_001', 1),
      );

      const res = await request(app.getHttpServer())
        .post('/api/expediente/odontogramas/odo_e2e_001/revisiones')
        .set(AUTH_VALID_HEADER)
        .send({
          versionEsperada: 1,
          tipoRevision: TipoRevisionOdontograma.NUEVA_OBSERVACION,
          fechaObservacionClinica: '2026-10-26T08:30:00.000Z',
          motivoRevision: 'Colisión de versión',
          deltas: [],
          aplicaAlEstadoActual: true,
        })
        .expect(HttpStatus.CONFLICT);

      expect(res.body.status).toBe(409);
      expect(res.body.title).toBe('Conflicto de concurrencia optimista en odontograma');
    });

    it('4.5 Pieza dental duplicada en odontograma -> debe responder 409 Conflict', async () => {
      mockRegistrarRevisionUseCase.ejecutar = vi.fn().mockRejectedValue(
        new PiezaDentalOdontogramaDuplicadaError(16),
      );

      const res = await request(app.getHttpServer())
        .post('/api/expediente/odontogramas/odo_e2e_001/revisiones')
        .set(AUTH_VALID_HEADER)
        .send({
          versionEsperada: 1,
          tipoRevision: TipoRevisionOdontograma.NUEVA_OBSERVACION,
          fechaObservacionClinica: '2026-10-26T08:30:00.000Z',
          motivoRevision: 'Pieza duplicada',
          deltas: [],
          aplicaAlEstadoActual: true,
        })
        .expect(HttpStatus.CONFLICT);

      expect(res.body.status).toBe(409);
      expect(res.body.title).toBe('Pieza dental duplicada en odontograma');
    });

    it('4.6 Condición anatómica incompatible -> debe responder 422 Unprocessable Entity', async () => {
      mockRegistrarRevisionUseCase.ejecutar = vi.fn().mockRejectedValue(
        new EstadoAnatomicoIncompatibleError(16, EstadoAnatomicoPieza.AUSENTE, CondicionSuperficie.CARIES),
      );

      const res = await request(app.getHttpServer())
        .post('/api/expediente/odontogramas/odo_e2e_001/revisiones')
        .set(AUTH_VALID_HEADER)
        .send({
          versionEsperada: 1,
          tipoRevision: TipoRevisionOdontograma.NUEVA_OBSERVACION,
          fechaObservacionClinica: '2026-10-26T08:30:00.000Z',
          motivoRevision: 'Incompatibilidad anatómica',
          deltas: [],
          aplicaAlEstadoActual: true,
        })
        .expect(HttpStatus.UNPROCESSABLE_ENTITY);

      expect(res.body.status).toBe(422);
      expect(res.body.title).toBe('Condición anatómica incompatible');
    });

    it('4.7 Superficie incisal incompatible -> debe responder 422 Unprocessable Entity', async () => {
      mockRegistrarRevisionUseCase.ejecutar = vi.fn().mockRejectedValue(
        new SuperficieIncisalIncompatibleError(11),
      );

      const res = await request(app.getHttpServer())
        .post('/api/expediente/odontogramas/odo_e2e_001/revisiones')
        .set(AUTH_VALID_HEADER)
        .send({
          versionEsperada: 1,
          tipoRevision: TipoRevisionOdontograma.NUEVA_OBSERVACION,
          fechaObservacionClinica: '2026-10-26T08:30:00.000Z',
          motivoRevision: 'Incompatibilidad incisal',
          deltas: [],
          aplicaAlEstadoActual: true,
        })
        .expect(HttpStatus.UNPROCESSABLE_ENTITY);

      expect(res.body.status).toBe(422);
      expect(res.body.title).toBe('Superficie incisal incompatible');
    });

    it('4.8 Enmienda correctiva inválida -> debe responder 422 Unprocessable Entity', async () => {
      mockRegistrarRevisionUseCase.ejecutar = vi.fn().mockRejectedValue(
        new EnmiendaCorrectivaInvalidaError('No se especificó la revisión corregida'),
      );

      const res = await request(app.getHttpServer())
        .post('/api/expediente/odontogramas/odo_e2e_001/revisiones')
        .set(AUTH_VALID_HEADER)
        .send({
          versionEsperada: 1,
          tipoRevision: TipoRevisionOdontograma.ENMIENDA_CORRECTIVA,
          fechaObservacionClinica: '2026-10-26T08:30:00.000Z',
          motivoRevision: 'Enmienda sin base',
          deltas: [],
          aplicaAlEstadoActual: true,
        })
        .expect(HttpStatus.UNPROCESSABLE_ENTITY);

      expect(res.body.status).toBe(422);
      expect(res.body.title).toBe('Enmienda correctiva inválida');
    });

    it('4.9 Historia clínica no activa -> debe responder 422 Unprocessable Entity', async () => {
      mockInicializarUseCase.ejecutar = vi.fn().mockRejectedValue(
        HistoriaClinicaInvalidaError.noActiva('hc_e2e_001', 'CERRADA'),
      );

      const res = await request(app.getHttpServer())
        .post('/api/expediente/odontogramas/inicializar')
        .set(AUTH_VALID_HEADER)
        .send({ historiaClinicaId: 'hc_e2e_001' })
        .expect(HttpStatus.UNPROCESSABLE_ENTITY);

      expect(res.body.status).toBe(422);
      expect(res.body.title).toBe('Historia clínica no activa');
    });

    it('4.10 Consulta con incompatibilidad clínica -> debe responder 422 Unprocessable Entity', async () => {
      mockRegistrarRevisionUseCase.ejecutar = vi.fn().mockRejectedValue(
        ConsultaInvalidaError.historiaDiferente('cons_001', 'hc_001', 'hc_002'),
      );

      const res = await request(app.getHttpServer())
        .post('/api/expediente/odontogramas/odo_e2e_001/revisiones')
        .set(AUTH_VALID_HEADER)
        .send({
          versionEsperada: 1,
          tipoRevision: TipoRevisionOdontograma.NUEVA_OBSERVACION,
          fechaObservacionClinica: '2026-10-26T08:30:00.000Z',
          motivoRevision: 'Consulta de otra historia',
          deltas: [],
          aplicaAlEstadoActual: true,
        })
        .expect(HttpStatus.UNPROCESSABLE_ENTITY);

      expect(res.body.status).toBe(422);
      expect(res.body.title).toBe('Incompatibilidad clínica con consulta');
    });

    it('4.11 Transacción no soportada (MongoDB Standalone) -> debe responder 503 con mensaje técnico seguro', async () => {
      mockRegistrarRevisionUseCase.ejecutar = vi.fn().mockRejectedValue(
        new TransaccionNoSoportadaError(),
      );

      const res = await request(app.getHttpServer())
        .post('/api/expediente/odontogramas/odo_e2e_001/revisiones')
        .set(AUTH_VALID_HEADER)
        .send({
          versionEsperada: 1,
          tipoRevision: TipoRevisionOdontograma.NUEVA_OBSERVACION,
          fechaObservacionClinica: '2026-10-26T08:30:00.000Z',
          motivoRevision: 'Operación transaccional en standalone',
          deltas: [],
          aplicaAlEstadoActual: true,
        })
        .expect(HttpStatus.SERVICE_UNAVAILABLE);

      expect(res.body.status).toBe(503);
      expect(res.body.title).toBe('Servicio de persistencia clínica no disponible');
      expect(res.body.detail).not.toContain('Standalone');
      expect(res.body.detail).not.toContain('Replica Set');
    });

    it('4.12 Error inesperado no controlado -> debe responder 500 sanitizado sin fugar stack ni credenciales', async () => {
      mockInicializarUseCase.ejecutar = vi.fn().mockRejectedValue(
        new Error('Password leak attempt: mongodb://admin:secret123@localhost:27017'),
      );

      const res = await request(app.getHttpServer())
        .post('/api/expediente/odontogramas/inicializar')
        .set(AUTH_VALID_HEADER)
        .send({ historiaClinicaId: 'hc_e2e_001' })
        .expect(HttpStatus.INTERNAL_SERVER_ERROR);

      expect(res.body.status).toBe(500);
      expect(res.body.title).toBe('Error interno del servidor');
      expect(res.body.detail).toBe('Ocurrió un error inesperado al procesar la solicitud.');
      expect(res.body.detail).not.toContain('secret123');
      expect(res.body.detail).not.toContain('admin');
    });
  });
});
