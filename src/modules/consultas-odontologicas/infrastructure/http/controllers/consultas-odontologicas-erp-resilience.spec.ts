import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as jose from 'jose';
import { ConsultasOdontologicasController } from './consultas-odontologicas.controller.js';
import { OdontologoAuthGuard } from '../guards/odontologo-auth.guard.js';
import { RolesGuard } from '../../../../../infrastructure/auth/roles.guard.js';
import { ODONTOLOGO_CONTEXT_PORT } from '../../../domain/ports/odontologo-context.port.js';
import { KeycloakJwtOdontologoContextAdapter } from '../../../../../infrastructure/auth/keycloak-jwt-odontologo-context.adapter.js';
import { GraphqlMs1CanonicalDoctorResolverAdapter } from '../../../../../infrastructure/auth/graphql-ms1-canonical-doctor-resolver.adapter.js';
import { CANONICAL_DOCTOR_RESOLVER } from '../../../../../infrastructure/auth/canonical-doctor-resolver.port.js';
import { ProblemDetailsFilter } from '../../../../historias-clinicas/infrastructure/http/filters/problem-details.filter.js';
import {
  RegistrarAperturaConsultaUseCase,
  ObtenerConsultaPorIdUseCase,
  ListarConsultasPorHistoriaUseCase,
  ActualizarAtencionConsultaUseCase,
  CompletarConsultaUseCase,
  CancelarConsultaUseCase,
  ConsultarCatalogoServiciosUseCase,
} from '../../../application/index.js';

describe('HTTP Identity Resilience (Defecto 2): Caída de MS1/ERP debe responder 503 y no 401', () => {
  let app: INestApplication;
  const originalFetch = globalThis.fetch;
  const testSecret = 'test_secret_for_jwt_auth_resilience_12345';
  const issuer = 'http://localhost:8080/realms/dental-platform';
  const audience = 'ms2-clinico-ia';

  let mockObtenerConsultaUseCase: { execute: ReturnType<typeof vi.fn> };

  async function crearTokenValido(sub = '550e8400-e29b-41d4-a716-446655440001'): Promise<string> {
    const secretBytes = new TextEncoder().encode(testSecret);
    return new jose.SignJWT({
      realm_access: { roles: ['ODONTOLOGO'] },
      iss: issuer,
      aud: audience,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(sub)
      .setExpirationTime('2h')
      .sign(secretBytes);
  }

  beforeEach(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = testSecret;

    mockObtenerConsultaUseCase = {
      execute: vi.fn().mockResolvedValue({
        id: 'cons_70000000-0000-4000-a000-000000000001',
        estado: 'EN_CURSO',
      }),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ConsultasOdontologicasController],
      providers: [
        {
          provide: RegistrarAperturaConsultaUseCase,
          useValue: {},
        },
        {
          provide: ObtenerConsultaPorIdUseCase,
          useValue: mockObtenerConsultaUseCase,
        },
        {
          provide: ListarConsultasPorHistoriaUseCase,
          useValue: {},
        },
        {
          provide: ActualizarAtencionConsultaUseCase,
          useValue: {},
        },
        {
          provide: CompletarConsultaUseCase,
          useValue: {},
        },
        {
          provide: CancelarConsultaUseCase,
          useValue: {},
        },
        {
          provide: ConsultarCatalogoServiciosUseCase,
          useValue: {},
        },
        GraphqlMs1CanonicalDoctorResolverAdapter,
        {
          provide: CANONICAL_DOCTOR_RESOLVER,
          useClass: GraphqlMs1CanonicalDoctorResolverAdapter,
        },
        KeycloakJwtOdontologoContextAdapter,
        {
          provide: ODONTOLOGO_CONTEXT_PORT,
          useExisting: KeycloakJwtOdontologoContextAdapter,
        },
        OdontologoAuthGuard,
        RolesGuard,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new ProblemDetailsFilter());
    await app.init();
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    delete process.env.JWT_SECRET;
    if (app) {
      await app.close();
    }
  });

  it('1. GET /consultas/:id ante timeout consultando identidad a MS1 debe responder 503 (no 401)', async () => {
    // Simular que el fetch al resolver identidad en MS1 expira (TimeoutError)
    globalThis.fetch = vi.fn().mockRejectedValue(
      new DOMException('The operation timed out.', 'TimeoutError'),
    );

    const token = await crearTokenValido();
    const res = await request(app.getHttpServer())
      .get('/consultas/cons_70000000-0000-4000-a000-000000000001')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(503);
    expect(res.body.type).toBe('https://api.odontoclinic.local/errors/service-unavailable');
    expect(res.body.detail).toMatch(/Timeout.*identidad.*MS1/i);
    expect(mockObtenerConsultaUseCase.execute).not.toHaveBeenCalled();
  });

  it('2. GET /consultas/:id ante caída de red / conexión rechazada en MS1 debe responder 503 (no 401)', async () => {
    // Simular ECONNREFUSED
    globalThis.fetch = vi.fn().mockRejectedValue(
      new Error('fetch failed: connect ECONNREFUSED 127.0.0.1:8081'),
    );

    const token = await crearTokenValido();
    const res = await request(app.getHttpServer())
      .get('/consultas/cons_70000000-0000-4000-a000-000000000001')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(503);
    expect(res.body.type).toBe('https://api.odontoclinic.local/errors/service-unavailable');
    expect(res.body.detail).toMatch(/Error de red o conexión.*MS1/i);
    expect(mockObtenerConsultaUseCase.execute).not.toHaveBeenCalled();
  });

  it('3. GET /consultas/:id ante error 5xx (500 Internal Server Error) de MS1 debe responder 503 (no 401)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({ message: 'Database connection down' }),
    });

    const token = await crearTokenValido();
    const res = await request(app.getHttpServer())
      .get('/consultas/cons_70000000-0000-4000-a000-000000000001')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(503);
    expect(res.body.type).toBe('https://api.odontoclinic.local/errors/service-unavailable');
    expect(res.body.detail).toMatch(/MS1 respondió con error de servidor HTTP 500/i);
    expect(mockObtenerConsultaUseCase.execute).not.toHaveBeenCalled();
  });

  it('4. GET /consultas/:id sin token debe responder 401 Unauthorized', async () => {
    const res = await request(app.getHttpServer())
      .get('/consultas/cons_70000000-0000-4000-a000-000000000001');

    expect(res.status).toBe(401);
    expect(res.body.type).toBe('https://api.odontoclinic.local/errors/unauthorized');
  });

  it('5. GET /consultas/:id cuando MS1 rechaza explícitamente con 401 debe responder 401', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({}),
    });

    const token = await crearTokenValido();
    const res = await request(app.getHttpServer())
      .get('/consultas/cons_70000000-0000-4000-a000-000000000001')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body.type).toBe('https://api.odontoclinic.local/errors/unauthorized');
  });
});
