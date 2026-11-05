import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Reflector } from '@nestjs/core';
import { GUARDS_METADATA } from '@nestjs/common/constants.js';
import { OutboxController } from './outbox.controller.js';
import { OdontologoAuthGuard } from './guards/odontologo-auth.guard.js';
import { RolesGuard } from '../../../../infrastructure/auth/roles.guard.js';
import { ROLES_KEY } from '../../../../infrastructure/auth/roles.decorator.js';
import { OUTBOX_REPOSITORY_PORT } from '../../domain/ports/outbox-repository.port.js';
import { KeycloakJwtOdontologoContextAdapter } from '../../../../infrastructure/auth/keycloak-jwt-odontologo-context.adapter.js';

describe('OutboxController - Seguridad, Guards y Roles (Bloqueo 1)', () => {
  let app: INestApplication;
  let mockRepo: { obtenerEstado: ReturnType<typeof vi.fn> };
  let mockAuthAdapter: { obtenerOdontologoActual: ReturnType<typeof vi.fn> };

  const mockFecha = new Date('2026-11-05T09:00:00Z');

  beforeEach(async () => {
    mockRepo = {
      obtenerEstado: vi.fn().mockResolvedValue({
        pendientes: 2,
        enProceso: 0,
        publicados: 45,
        fatales: 1,
        eventosFatales: [
          {
            id: 'evt-fatal-1',
            aggregateId: 'agg-consulta-123',
            attempts: 5,
            maxAttempts: 5,
            lastError: 'Broker connection refused',
            actualizadoEn: mockFecha,
          },
        ],
      }),
    };

    mockAuthAdapter = {
      obtenerOdontologoActual: vi.fn().mockImplementation(async (token: string) => {
        if (token === 'token_admin') {
          return { odontologoId: 'od_admin_001', roles: ['ADMIN'] };
        }
        if (token === 'token_odontologo') {
          return { odontologoId: 'od_user_002', roles: ['ODONTOLOGO'] };
        }
        throw new Error('Token no reconocido');
      }),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [OutboxController],
      providers: [
        {
          provide: OUTBOX_REPOSITORY_PORT,
          useValue: mockRepo,
        },
        OdontologoAuthGuard,
        RolesGuard,
        Reflector,
        {
          provide: KeycloakJwtOdontologoContextAdapter,
          useValue: mockAuthAdapter,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('1. Debe tener decoradores @UseGuards(OdontologoAuthGuard, RolesGuard) y @Roles(ADMIN)', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, OutboxController);
    expect(guards).toBeDefined();
    expect(guards).toContain(OdontologoAuthGuard);
    expect(guards).toContain(RolesGuard);

    const handler = Object.getOwnPropertyDescriptor(
      OutboxController.prototype,
      'obtenerEstado',
    )?.value;
    const roles = Reflect.getMetadata(ROLES_KEY, handler);
    expect(roles).toEqual(['ADMIN']);
  });

  it('2. GET /outbox/status sin cabecera Authorization debe responder 401 Unauthorized', async () => {
    const res = await request(app.getHttpServer()).get('/outbox/status');

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/Header Authorization no proporcionado/i);
    expect(mockRepo.obtenerEstado).not.toHaveBeenCalled();
  });

  it('3. GET /outbox/status con rol ODONTOLOGO debe responder 403 Forbidden', async () => {
    const res = await request(app.getHttpServer())
      .get('/outbox/status')
      .set('Authorization', 'Bearer token_odontologo');

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/Acceso denegado.*ADMIN/i);
    expect(mockRepo.obtenerEstado).not.toHaveBeenCalled();
  });

  it('4. GET /outbox/status con rol ADMIN debe responder 200 OK y no exponer payload clínico', async () => {
    const res = await request(app.getHttpServer())
      .get('/outbox/status')
      .set('Authorization', 'Bearer token_admin');

    expect(res.status).toBe(200);
    expect(res.body.pendientes).toBe(2);
    expect(res.body.fatales).toBe(1);
    expect(res.body.eventosFatales).toHaveLength(1);

    const fatal = res.body.eventosFatales[0];
    expect(fatal.id).toBe('evt-fatal-1');
    expect(fatal.aggregateId).toBe('agg-consulta-123');
    expect(fatal.lastError).toBe('Broker connection refused');
    // Invariante de seguridad: NO debe existir el campo payload
    expect(fatal.payload).toBeUndefined();
    expect((res.body as any).payload).toBeUndefined();

    expect(mockRepo.obtenerEstado).toHaveBeenCalled();
  });
});
