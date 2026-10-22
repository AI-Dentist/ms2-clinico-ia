import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import request from 'supertest';
import type { Connection } from 'mongoose';
import { AppModule } from '../src/app.module.js';
import { ProblemDetailsFilter } from '../src/modules/historias-clinicas/infrastructure/http/filters/problem-details.filter.js';
import { HistoriaClinicaDocument } from '../src/modules/historias-clinicas/infrastructure/persistence/mongo/schemas/historia-clinica.schema.js';

describe('HistoriasClinicas API REST (e2e)', () => {
  let app: INestApplication;
  let connection: Connection;
  let testDbName: string;
  const originalMongoUri = process.env.MONGODB_URI;
  const originalNodeEnv = process.env.NODE_ENV;

  const AUTH_HEADER = {
    Authorization: 'Bearer token_e2e_principal',
  };

  beforeAll(async () => {
    // 1. Base de datos temporal única y aislada
    testDbName = `test-clinica-e2e-${randomUUID()}`;

    // SALVAGUARDA ESTRICTA
    if (testDbName === 'clinica-dentalDB' || testDbName.includes('clinica-dentalDB')) {
      throw new Error(
        'CRÍTICO: No se permite ejecutar pruebas E2E sobre la base de producción clinica-dentalDB.',
      );
    }

    process.env.MONGODB_URI = `mongodb://127.0.0.1:27017/${testDbName}`;
    process.env.NODE_ENV = 'test';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Replicar configuración exacta de main.ts
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

    connection = app.get<Connection>(getConnectionToken());

    // Sincronizar índices únicos
    const historiaModel = connection.model(HistoriaClinicaDocument.name);
    await historiaModel.syncIndexes();
  }, 25000);

  afterAll(async () => {
    try {
      if (connection) {
        const dbName = connection.db?.databaseName;
        // SALVAGUARDA ESTRICTA DE LIMPIEZA
        if (dbName && dbName.startsWith('test-clinica-e2e-')) {
          await connection.dropDatabase();
        }
      }
      if (app) {
        await app.close();
      }
    } finally {
      process.env.MONGODB_URI = originalMongoUri;
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  // Variables compartidas para el ciclo de vida del expediente
  let historiaId: string;
  const pacienteSinteticoId = `pac_e2e_${randomUUID().substring(0, 8)}`;

  // ==========================================
  // 1. SEGURIDAD Y AUTENTICACIÓN
  // ==========================================
  describe('Protección y Autenticación', () => {
    it('debe rechazar solicitudes sin encabezado Authorization con 401', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/expediente/historias-clinicas/cualquier-id')
        .expect('Content-Type', /application\/problem\+json/)
        .expect(401);

      expect(res.body.status).toBe(401);
      expect(res.body.title).toBe('Autenticación requerida');
    });

    it('debe rechazar solicitudes con tokens no registrados en la lista blanca sintética con 401', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/expediente/historias-clinicas/cualquier-id')
        .set('Authorization', 'Bearer token_no_autorizado_xyz')
        .expect('Content-Type', /application\/problem\+json/)
        .expect(401);

      expect(res.body.status).toBe(401);
      expect(res.body.detail).toContain('Token de autenticación inválido');
    });

    it('debe proteger las consultas GET por pacienteId exigiendo autenticación', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/expediente/historias-clinicas?pacienteId=pac-123')
        .expect('Content-Type', /application\/problem\+json/)
        .expect(401);

      expect(res.body.status).toBe(401);
    });
  });

  // ==========================================
  // 2. ENDPOINT 1: POST (Crear Historia)
  // ==========================================
  describe('POST /api/expediente/historias-clinicas', () => {
    it('debe rechazar datos de entrada inválidos con 400 y RFC 7807 invalidParams', async () => {
      const payloadInvalido = {
        // Falta pacienteId obligatorio
        observacionesGenerales: 'Prueba inválida',
        campoInexistenteNoPermitido: true,
      };

      const res = await request(app.getHttpServer())
        .post('/api/expediente/historias-clinicas')
        .set(AUTH_HEADER)
        .send(payloadInvalido)
        .expect('Content-Type', /application\/problem\+json/)
        .expect(400);

      expect(res.body.status).toBe(400);
      expect(res.body.invalidParams).toBeDefined();
      expect(res.body.invalidParams.length).toBeGreaterThan(0);
    });

    it('debe rechazar la creación si el paciente no existe en MS1 con 422', async () => {
      const payloadPacienteInexistente = {
        pacienteId: 'pac_no_existe',
        antecedentes: {
          enfermedadesCronicas: [],
        },
      };

      const res = await request(app.getHttpServer())
        .post('/api/expediente/historias-clinicas')
        .set(AUTH_HEADER)
        .send(payloadPacienteInexistente)
        .expect('Content-Type', /application\/problem\+json/)
        .expect(422);

      expect(res.body.status).toBe(422);
      expect(res.body.title).toBe('Paciente no válido o inexistente');
    });

    it('debe crear exitosamente una historia clínica con 201 Created', async () => {
      const payload = {
        pacienteId: pacienteSinteticoId,
        odontologoResponsableId: 'od_e2e_001',
        antecedentes: {
          enfermedadesCronicas: [
            { nombre: 'Diabetes', estado: 'CONFIRMADO', detalle: 'Tipo 2 controlada' },
          ],
          antecedentesFamiliares: [
            { nombre: 'Cardiopatía', estado: 'NEGADO' },
          ],
          antecedentesOdontologicos: {
            bruxismo: { estado: 'NO_EVALUADO' },
          },
        },
        observacionesGenerales: 'Expediente E2E de prueba',
      };

      const res = await request(app.getHttpServer())
        .post('/api/expediente/historias-clinicas')
        .set(AUTH_HEADER)
        .send(payload)
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.pacienteId).toBe(pacienteSinteticoId);
      expect(res.body.estado).toBe('ACTIVA');
      expect(res.body.version).toBe(1);
      expect(res.body.historialCambios).toHaveLength(1);
      expect(res.body.historialCambios[0].accion).toBe('CREACION');

      historiaId = res.body.id;
    });

    it('debe rechazar la creación de una historia clínica duplicada para el mismo paciente con 409', async () => {
      const payloadDuplicado = {
        pacienteId: pacienteSinteticoId,
        antecedentes: {
          enfermedadesCronicas: [],
        },
      };

      const res = await request(app.getHttpServer())
        .post('/api/expediente/historias-clinicas')
        .set(AUTH_HEADER)
        .send(payloadDuplicado)
        .expect('Content-Type', /application\/problem\+json/)
        .expect(409);

      expect(res.body.status).toBe(409);
      expect(res.body.title).toBe('Expediente clínico duplicado');
    });
  });

  // ==========================================
  // 3. ENDPOINT 2: GET :id
  // ==========================================
  describe('GET /api/expediente/historias-clinicas/:id', () => {
    it('debe obtener la historia clínica existente por ID con 200 OK', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/expediente/historias-clinicas/${historiaId}`)
        .set(AUTH_HEADER)
        .expect(200);

      expect(res.body.id).toBe(historiaId);
      expect(res.body.pacienteId).toBe(pacienteSinteticoId);
      expect(res.body.version).toBe(1);
    });

    it('debe retornar 404 Not Found si el ID de historia clínica no existe', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/expediente/historias-clinicas/hc-00000000-0000-0000-0000-000000000000')
        .set(AUTH_HEADER)
        .expect('Content-Type', /application\/problem\+json/)
        .expect(404);

      expect(res.body.status).toBe(404);
      expect(res.body.title).toBe('Historia clínica no encontrada');
    });
  });

  // ==========================================
  // 4. ENDPOINT 3: GET ?pacienteId=...
  // ==========================================
  describe('GET /api/expediente/historias-clinicas?pacienteId=...', () => {
    it('debe obtener la historia clínica por pacienteId con 200 OK en array', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/expediente/historias-clinicas?pacienteId=${pacienteSinteticoId}`)
        .set(AUTH_HEADER)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe(historiaId);
    });

    it('debe retornar 400 Bad Request si el query param pacienteId está ausente', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/expediente/historias-clinicas')
        .set(AUTH_HEADER)
        .expect('Content-Type', /application\/problem\+json/)
        .expect(400);

      expect(res.body.status).toBe(400);
      expect(res.body.detail).toContain('pacienteId es requerido');
    });

    it('debe retornar 404 Not Found si el paciente no tiene expediente clínico', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/expediente/historias-clinicas?pacienteId=pac_inexistente_sin_hc')
        .set(AUTH_HEADER)
        .expect('Content-Type', /application\/problem\+json/)
        .expect(404);

      expect(res.body.status).toBe(404);
    });
  });

  // ==========================================
  // 5. ENDPOINT 4: PATCH /:id/antecedentes
  // ==========================================
  describe('PATCH /api/expediente/historias-clinicas/:id/antecedentes', () => {
    it('debe actualizar los antecedentes con versionEsperada = 1 y avanzar a versión 2', async () => {
      const payload = {
        versionEsperada: 1,
        nuevosAntecedentes: {
          enfermedadesCronicas: [
            { nombre: 'Diabetes', estado: 'CONFIRMADO', detalle: 'Controlada con metformina' },
            { nombre: 'Hipertensión', estado: 'CONFIRMADO', detalle: 'Enalapril 10mg' },
          ],
          antecedentesOdontologicos: {
            bruxismo: { estado: 'CONFIRMADO', detalle: 'Nocturno leve' },
          },
        },
        camposModificados: [
          'antecedentes.enfermedadesCronicas',
          'antecedentes.antecedentesOdontologicos.bruxismo',
        ],
        descripcion: 'Control odontológico anual',
      };

      const res = await request(app.getHttpServer())
        .patch(`/api/expediente/historias-clinicas/${historiaId}/antecedentes`)
        .set(AUTH_HEADER)
        .send(payload)
        .expect(200);

      expect(res.body.version).toBe(2);
      expect(res.body.antecedentes.enfermedadesCronicas).toHaveLength(2);
      expect(res.body.historialCambios).toHaveLength(2);
      expect(res.body.historialCambios[1].accion).toBe('ACTUALIZACION_ANTECEDENTES');
    });

    it('debe rechazar la actualización con 409 Conflict si se envía versionEsperada desactualizada', async () => {
      const payloadObsoleto = {
        versionEsperada: 1, // Ya es versión 2
        nuevosAntecedentes: {
          enfermedadesCronicas: [],
        },
        camposModificados: ['antecedentes.enfermedadesCronicas'],
        descripcion: 'Intento con versión desactualizada',
      };

      const res = await request(app.getHttpServer())
        .patch(`/api/expediente/historias-clinicas/${historiaId}/antecedentes`)
        .set(AUTH_HEADER)
        .send(payloadObsoleto)
        .expect('Content-Type', /application\/problem\+json/)
        .expect(409);

      expect(res.body.status).toBe(409);
      expect(res.body.title).toBe('Conflicto de concurrencia optimista');
    });
  });

  // ==========================================
  // 6. ENDPOINT 5: POST /:id/alergias
  // ==========================================
  describe('POST /api/expediente/historias-clinicas/:id/alergias', () => {
    it('debe agregar una nueva alergia con versionEsperada = 2 y avanzar a versión 3', async () => {
      const payload = {
        versionEsperada: 2,
        sustancia: 'Penicilina',
        tipoReaccion: 'Shock anafiláctico previo',
        severidad: 'GRAVE',
        notasAdicionales: 'Prohibido uso de betalactámicos',
        descripcion: 'Reportado por el paciente',
      };

      const res = await request(app.getHttpServer())
        .post(`/api/expediente/historias-clinicas/${historiaId}/alergias`)
        .set(AUTH_HEADER)
        .send(payload)
        .expect(201);

      expect(res.body.version).toBe(3);
      expect(res.body.alergias).toHaveLength(1);
      expect(res.body.alergias[0].sustancia).toBe('Penicilina');
      expect(res.body.alergias[0].severidad).toBe('GRAVE');
    });

    it('debe rechazar alergia duplicada (case-insensitive) con 422', async () => {
      const payloadDuplicada = {
        versionEsperada: 3,
        sustancia: 'penicilina', // Mismo alérgeno en minúsculas
        tipoReaccion: 'Urticaria',
        severidad: 'LEVE',
      };

      const res = await request(app.getHttpServer())
        .post(`/api/expediente/historias-clinicas/${historiaId}/alergias`)
        .set(AUTH_HEADER)
        .send(payloadDuplicada)
        .expect('Content-Type', /application\/problem\+json/)
        .expect(422);

      expect(res.body.status).toBe(422);
      expect(res.body.title).toBe('Alergia duplicada');
    });
  });

  // ==========================================
  // 7. ENDPOINT 6: DELETE /:id/alergias/:sustancia
  // ==========================================
  describe('DELETE /api/expediente/historias-clinicas/:id/alergias/:sustancia', () => {
    it('debe eliminar la alergia con versionEsperada = 3 y avanzar a versión 4', async () => {
      const payload = {
        versionEsperada: 3,
        descripcion: 'Descartada por prueba inmunológica negativa',
      };

      const res = await request(app.getHttpServer())
        .delete(`/api/expediente/historias-clinicas/${historiaId}/alergias/Penicilina`)
        .set(AUTH_HEADER)
        .send(payload)
        .expect(200);

      expect(res.body.version).toBe(4);
      expect(res.body.alergias).toHaveLength(0);
    });

    it('debe retornar 404 si se intenta eliminar una alergia que no existe', async () => {
      const payload = {
        versionEsperada: 4,
        descripcion: 'Eliminación inexistente',
      };

      const res = await request(app.getHttpServer())
        .delete(`/api/expediente/historias-clinicas/${historiaId}/alergias/Aspirina`)
        .set(AUTH_HEADER)
        .send(payload)
        .expect('Content-Type', /application\/problem\+json/)
        .expect(404);

      expect(res.body.status).toBe(404);
      expect(res.body.title).toBe('Alergia no encontrada');
    });
  });

  // ==========================================
  // 8. ENDPOINT 7: PUT /:id/medicamentos
  // ==========================================
  describe('PUT /api/expediente/historias-clinicas/:id/medicamentos', () => {
    it('debe reemplazar la lista de medicamentos con versionEsperada = 4 y avanzar a versión 5', async () => {
      const payload = {
        versionEsperada: 4,
        medicamentos: [
          {
            nombre: 'Metformina 850mg',
            principioActivo: 'Metformina',
            dosis: '1 comp cada 12 horas',
            motivoUso: 'Diabetes Mellitus tipo 2',
          },
          {
            nombre: 'Enalapril 10mg',
            dosis: '1 comp al día',
          },
        ],
        descripcion: 'Actualización farmacológica posconsulta',
      };

      const res = await request(app.getHttpServer())
        .put(`/api/expediente/historias-clinicas/${historiaId}/medicamentos`)
        .set(AUTH_HEADER)
        .send(payload)
        .expect(200);

      expect(res.body.version).toBe(5);
      expect(res.body.medicamentosActuales).toHaveLength(2);
      expect(res.body.medicamentosActuales[0].nombre).toBe('Metformina 850mg');
    });
  });

  // ==========================================
  // 9. ENDPOINT 8: PATCH /:id/estado
  // ==========================================
  describe('PATCH /api/expediente/historias-clinicas/:id/estado', () => {
    it('debe cambiar de estado a CERRADA con versionEsperada = 5 y avanzar a versión 6', async () => {
      const payload = {
        versionEsperada: 5,
        nuevoEstado: 'CERRADA',
        descripcion: 'Cierre del expediente clínico por alta',
      };

      const res = await request(app.getHttpServer())
        .patch(`/api/expediente/historias-clinicas/${historiaId}/estado`)
        .set(AUTH_HEADER)
        .send(payload)
        .expect(200);

      expect(res.body.version).toBe(6);
      expect(res.body.estado).toBe('CERRADA');
    });

    it('debe impedir modificar antecedentes cuando la historia clínica está CERRADA con 422', async () => {
      const payload = {
        versionEsperada: 6,
        nuevosAntecedentes: {
          enfermedadesCronicas: [],
        },
        camposModificados: ['antecedentes.enfermedadesCronicas'],
        descripcion: 'Intento de modificar expediente cerrado',
      };

      const res = await request(app.getHttpServer())
        .patch(`/api/expediente/historias-clinicas/${historiaId}/antecedentes`)
        .set(AUTH_HEADER)
        .send(payload)
        .expect('Content-Type', /application\/problem\+json/)
        .expect(422);

      expect(res.body.status).toBe(422);
      expect(res.body.title).toBe('Expediente no editable');
    });

    it('debe permitir reabrir la historia clínica a ACTIVA con versionEsperada = 6 y avanzar a versión 7', async () => {
      const payload = {
        versionEsperada: 6,
        nuevoEstado: 'ACTIVA',
        descripcion: 'Reapertura por nuevo tratamiento',
      };

      const res = await request(app.getHttpServer())
        .patch(`/api/expediente/historias-clinicas/${historiaId}/estado`)
        .set(AUTH_HEADER)
        .send(payload)
        .expect(200);

      expect(res.body.version).toBe(7);
      expect(res.body.estado).toBe('ACTIVA');
    });
  });
});
