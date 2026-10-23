import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import request from 'supertest';
import type { Connection } from 'mongoose';
// Note: AppModule is imported dynamically inside beforeAll after setting process.env.MONGODB_URI
import { ProblemDetailsFilter } from '../src/modules/historias-clinicas/infrastructure/http/filters/problem-details.filter.js';
import { HistoriaClinicaDocument } from '../src/modules/historias-clinicas/infrastructure/persistence/mongo/schemas/historia-clinica.schema.js';
import { ConsultaOdontologicaDocument } from '../src/modules/consultas-odontologicas/infrastructure/persistence/mongo/schemas/consulta-odontologica.schema.js';

describe('ConsultasOdontologicas API REST (e2e)', () => {
  let app: INestApplication;
  let connection: Connection;
  let testDbName: string;
  const originalMongoUri = process.env.MONGODB_URI;
  const originalNodeEnv = process.env.NODE_ENV;

  const AUTH_HEADER = {
    Authorization: 'Bearer token_e2e_principal',
  };

  const SECONDARY_AUTH_HEADER = {
    Authorization: 'Bearer token_e2e_secundario',
  };

  // IDs sintéticos de prueba
  let historiaClinicaIdActiva: string;
  let historiaClinicaIdCerrada: string;
  const pacientePrincipalId = `pac_e2e_${randomUUID().substring(0, 8)}`;
  const pacienteAjenoId = `pac_e2e_${randomUUID().substring(0, 8)}`;

  beforeAll(async () => {
    // 1. Base de datos temporal única y aislada
    testDbName = `test-consultas-http-${randomUUID()}`;

    // SALVAGUARDA ESTRICTA: nunca utilizar clinica-dentalDB
    if (testDbName === 'clinica-dentalDB' || testDbName.includes('clinica-dentalDB')) {
      throw new Error(
        'CRÍTICO: No se permite ejecutar pruebas E2E sobre la base principal clinica-dentalDB.',
      );
    }

    process.env.MONGODB_URI = `mongodb://127.0.0.1:27017/${testDbName}`;
    process.env.NODE_ENV = 'test';

    const { AppModule } = await import('../src/app.module.js');

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
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

    connection = app.get<Connection>(getConnectionToken());

    // SALVAGUARDA DE AISLAMIENTO EN TIEMPO DE EJECUCIÓN
    const activeDbName = connection.db?.databaseName;
    if (
      !activeDbName ||
      !activeDbName.startsWith('test-consultas-http-') ||
      activeDbName === 'clinica-dentalDB' ||
      activeDbName === 'admin' ||
      activeDbName === 'local'
    ) {
      await app.close();
      throw new Error(
        `CRÍTICO: Abortando suite ConsultasOdontologicas E2E. Base de datos resuelta no autorizada: '${activeDbName}'. Solo se permiten bases temporales que inicien con 'test-consultas-http-'. Operaciones de escritura abortadas para proteger clinica-dentalDB.`,
      );
    }

    // Sincronizar índices únicos en MongoDB
    const historiaModel = connection.model(HistoriaClinicaDocument.name);
    const consultaModel = connection.model(ConsultaOdontologicaDocument.name);
    await historiaModel.syncIndexes();
    await consultaModel.syncIndexes();

    // 2. Sembrar una historia clínica ACTIVA para las pruebas
    const resHcActiva = await request(app.getHttpServer())
      .post('/api/expediente/historias-clinicas')
      .set(AUTH_HEADER)
      .send({
        pacienteId: pacientePrincipalId,
        observacionesGenerales: 'Evaluación odontológica general E2E',
      })
      .expect(201);
    historiaClinicaIdActiva = resHcActiva.body.id;

    // 3. Sembrar una historia clínica CERRADA para pruebas de restricción
    const resHcCerrada = await request(app.getHttpServer())
      .post('/api/expediente/historias-clinicas')
      .set(AUTH_HEADER)
      .send({
        pacienteId: pacienteAjenoId,
        observacionesGenerales: 'Historia clínica para cierre',
      })
      .expect(201);
    historiaClinicaIdCerrada = resHcCerrada.body.id;

    // Cerrar la historia clínica
    await request(app.getHttpServer())
      .patch(`/api/expediente/historias-clinicas/${historiaClinicaIdCerrada}/estado`)
      .set(AUTH_HEADER)
      .send({
        nuevoEstado: 'CERRADA',
        descripcion: 'Paciente transferido a otra sede.',
        versionEsperada: 1,
      })
      .expect(200);
  }, 30000);

  afterAll(async () => {
    try {
      if (connection) {
        const currentDb = connection.db?.databaseName;
        if (currentDb && currentDb === testDbName && currentDb.startsWith('test-consultas-http-')) {
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

  // ─── 1. Apertura válida sobre Historia Clínica ACTIVA ───────────────────────────
  it('1. POST /consultas-odontologicas - Apertura válida sobre Historia Clínica ACTIVA (201 Created)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/expediente/consultas-odontologicas')
      .set(AUTH_HEADER)
      .send({
        historiaClinicaId: historiaClinicaIdActiva,
        pacienteId: pacientePrincipalId,
        motivoConsulta: 'Dolor punzante en primer molar inferior izquierdo',
        anamnesisActual: {
          descripcion: 'Dolor iniciado tras ingesta de bebidas frías',
          tiempoEvolucion: '2 días',
          escalaDolorEVA: 6,
        },
        exploracionFisica: {
          inspeccionIntraoral: 'Caries cavitada profunda en pieza 36, sin fístula',
        },
      })
      .expect(201);

    expect(res.body.id).toMatch(/^cons_/);
    expect(res.body.estado).toBe('EN_CURSO');
    expect(res.body.version).toBe(1);
    expect(res.body.historiaClinicaId).toBe(historiaClinicaIdActiva);
    expect(res.body.pacienteId).toBe(pacientePrincipalId);
    expect(res.body.snapshotRiesgoClinico).toBeDefined();
    expect(res.body.anamnesisActual.escalaDolorEVA).toBe(6);
  });

  // ─── 2. Rechazo de expediente CERRADA o ARCHIVADA ─────────────────────────────
  it('2. POST /consultas-odontologicas - Rechazo de apertura sobre expediente CERRADA (422 Unprocessable Entity)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/expediente/consultas-odontologicas')
      .set(AUTH_HEADER)
      .send({
        historiaClinicaId: historiaClinicaIdCerrada,
        pacienteId: pacienteAjenoId,
        motivoConsulta: 'Intento de abrir consulta sobre historia cerrada',
      })
      .expect(422);

    expect(res.header['content-type']).toContain('application/problem+json');
    expect(res.body.title).toContain('Historia clínica no habilitada');
  });

  // ─── 3. Rechazo de paciente no coincidente ─────────────────────────────────────
  it('3. POST /consultas-odontologicas - Rechazo de paciente que no coincide con titular (422)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/expediente/consultas-odontologicas')
      .set(AUTH_HEADER)
      .send({
        historiaClinicaId: historiaClinicaIdActiva,
        pacienteId: 'pac_suplantador_invalido',
        motivoConsulta: 'Consulta con paciente falso',
      })
      .expect(422);

    expect(res.body.title).toContain('Paciente no coincide con la historia clínica');
  });

  // ─── 4. Apertura sin cita (citaId: null) ────────────────────────────────────────
  it('4. POST /consultas-odontologicas - Apertura sin cita de urgencia o espontánea (201)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/expediente/consultas-odontologicas')
      .set(AUTH_HEADER)
      .send({
        historiaClinicaId: historiaClinicaIdActiva,
        pacienteId: pacientePrincipalId,
        citaId: null,
        motivoConsulta: 'Urgencia odontológica espontánea sin cita previa',
      })
      .expect(201);

    expect(res.body.citaId).toBeNull();
    expect(res.body.estado).toBe('EN_CURSO');
  });

  // ─── 5. Apertura con cita sintética autorizada ──────────────────────────────────
  it('5. POST /consultas-odontologicas - Apertura con cita sintética autorizada cita_dev_001 (201)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/expediente/consultas-odontologicas')
      .set(AUTH_HEADER)
      .send({
        historiaClinicaId: historiaClinicaIdActiva,
        pacienteId: pacientePrincipalId,
        citaId: 'cita_dev_001',
        motivoConsulta: 'Control periódico agendado en MS3',
      })
      .expect(201);

    expect(res.body.citaId).toBe('cita_dev_001');
  });

  // ─── 6. Rechazo de cita inválida ───────────────────────────────────────────────
  it('6. POST /consultas-odontologicas - Rechazo de cita inválida no reconocida (422)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/expediente/consultas-odontologicas')
      .set(AUTH_HEADER)
      .send({
        historiaClinicaId: historiaClinicaIdActiva,
        pacienteId: pacientePrincipalId,
        citaId: 'cita_inexistente_en_ms3_999',
        motivoConsulta: 'Consulta con cita no confirmada',
      })
      .expect(422);

    expect(res.body.title).toContain('Cita inválida para consulta');
  });

  // ─── 7. Rechazo de cita duplicada ──────────────────────────────────────────────
  it('7. POST /consultas-odontologicas - Rechazo de cita ya vinculada previamente (409 Conflict)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/expediente/consultas-odontologicas')
      .set(AUTH_HEADER)
      .send({
        historiaClinicaId: historiaClinicaIdActiva,
        pacienteId: pacientePrincipalId,
        citaId: 'cita_dev_001', // Ya usada en test 5
        motivoConsulta: 'Intento de duplicar la misma cita',
      })
      .expect(409);

    expect(res.body.title).toContain('Cita odontológica ya asignada');
  });

  // ─── 8. Obtención por ID ───────────────────────────────────────────────────────
  it('8. GET /consultas-odontologicas/:id - Recuperar consulta por ID (200 OK)', async () => {
    // Abrir una consulta para leerla
    const apertura = await request(app.getHttpServer())
      .post('/api/expediente/consultas-odontologicas')
      .set(AUTH_HEADER)
      .send({
        historiaClinicaId: historiaClinicaIdActiva,
        pacienteId: pacientePrincipalId,
        motivoConsulta: 'Consulta para verificar lectura por ID',
      })
      .expect(201);

    const consultaId = apertura.body.id;

    const res = await request(app.getHttpServer())
      .get(`/api/expediente/consultas-odontologicas/${consultaId}`)
      .set(AUTH_HEADER)
      .expect(200);

    expect(res.body.id).toBe(consultaId);
    expect(res.body.motivoConsulta).toBe('Consulta para verificar lectura por ID');
  });

  // ─── 9. Listado paginado y orden estable ───────────────────────────────────────
  it('9. GET /consultas-odontologicas/historia/:historiaClinicaId - Listado paginado (200 OK)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/expediente/consultas-odontologicas/historia/${historiaClinicaIdActiva}?limite=2&offset=0`)
      .set(AUTH_HEADER)
      .expect(200);

    expect(res.body.consultas).toBeDefined();
    expect(Array.isArray(res.body.consultas)).toBe(true);
    expect(res.body.total).toBeGreaterThanOrEqual(3);
    expect(res.body.limite).toBe(2);
    expect(res.body.offset).toBe(0);
    expect(res.body.consultas.length).toBeLessThanOrEqual(2);
  });

  // ─── 10. Actualización de anamnesis y exploración ──────────────────────────────
  it('10. PUT /consultas-odontologicas/:id/atencion - Actualización de anamnesis y exploración (200)', async () => {
    const apertura = await request(app.getHttpServer())
      .post('/api/expediente/consultas-odontologicas')
      .set(AUTH_HEADER)
      .send({
        historiaClinicaId: historiaClinicaIdActiva,
        pacienteId: pacientePrincipalId,
        motivoConsulta: 'Consulta inicial para edición',
      })
      .expect(201);

    const consultaId = apertura.body.id;

    const res = await request(app.getHttpServer())
      .put(`/api/expediente/consultas-odontologicas/${consultaId}/atencion`)
      .set(AUTH_HEADER)
      .send({
        versionEsperada: 1,
        anamnesisActual: {
          descripcion: 'Dolor cede parcialmente con paracetamol',
          tiempoEvolucion: '4 días',
          escalaDolorEVA: 4,
        },
        exploracionFisica: {
          inspeccionExtraoral: 'Sin tumefacción facial',
          inspeccionIntraoral: 'Zona eritematosa periapical en 36',
          hallazgosDentales: 'Prueba de vitalidad pulpar positiva',
        },
      })
      .expect(200);

    expect(res.body.version).toBe(2);
    expect(res.body.anamnesisActual.escalaDolorEVA).toBe(4);
    expect(res.body.exploracionFisica.hallazgosDentales).toBe('Prueba de vitalidad pulpar positiva');
  });

  // ─── 11. Diagnósticos y procedimientos con FDI ────────────────────────────────
  it('11. PUT /consultas-odontologicas/:id/atencion - Registrar diagnósticos y procedimientos con FDI (200)', async () => {
    const apertura = await request(app.getHttpServer())
      .post('/api/expediente/consultas-odontologicas')
      .set(AUTH_HEADER)
      .send({
        historiaClinicaId: historiaClinicaIdActiva,
        pacienteId: pacientePrincipalId,
        motivoConsulta: 'Intervención operatoria',
      })
      .expect(201);

    const consultaId = apertura.body.id;

    const res = await request(app.getHttpServer())
      .put(`/api/expediente/consultas-odontologicas/${consultaId}/atencion`)
      .set(AUTH_HEADER)
      .send({
        versionEsperada: 1,
        diagnosticos: [
          {
            codigoCIE10: 'K02.1',
            descripcion: 'Caries de la dentina',
            tipo: 'DEFINITIVO',
          },
        ],
        procedimientosRealizados: [
          {
            codigo: 'PROC-OBT-01',
            descripcion: 'Restauración con resina de fotocurado',
            piezaDental: 46, // FDI molar permanente inferior derecho
            observaciones: 'Aislamiento absoluto',
          },
        ],
      })
      .expect(200);

    expect(res.body.diagnosticos.length).toBe(1);
    expect(res.body.diagnosticos[0].codigoCIE10).toBe('K02.1');
    expect(res.body.procedimientosRealizados.length).toBe(1);
    expect(res.body.procedimientosRealizados[0].piezaDental).toBe(46);
  });

  // ─── 12. Rechazo de pieza dental inválida ──────────────────────────────────────
  it('12. PUT /consultas-odontologicas/:id/atencion - Rechazo de pieza dental no FDI (422)', async () => {
    const apertura = await request(app.getHttpServer())
      .post('/api/expediente/consultas-odontologicas')
      .set(AUTH_HEADER)
      .send({
        historiaClinicaId: historiaClinicaIdActiva,
        pacienteId: pacientePrincipalId,
        motivoConsulta: 'Prueba pieza inválida',
      })
      .expect(201);

    const consultaId = apertura.body.id;

    const res = await request(app.getHttpServer())
      .put(`/api/expediente/consultas-odontologicas/${consultaId}/atencion`)
      .set(AUTH_HEADER)
      .send({
        versionEsperada: 1,
        procedimientosRealizados: [
          {
            descripcion: 'Procedimiento en pieza inexistente',
            piezaDental: 99, // Pieza dental FDI no existe (válidas 11-85)
          },
        ],
      })
      .expect(422);

    expect(res.body.title).toContain('Pieza dental FDI inválida');
  });

  // ─── 13. Completar una consulta válida ─────────────────────────────────────────
  it('13. POST /consultas-odontologicas/:id/completar - Completar consulta con requisitos cumplidos (200)', async () => {
    // Abrir consulta con exploración y diagnóstico
    const apertura = await request(app.getHttpServer())
      .post('/api/expediente/consultas-odontologicas')
      .set(AUTH_HEADER)
      .send({
        historiaClinicaId: historiaClinicaIdActiva,
        pacienteId: pacientePrincipalId,
        motivoConsulta: 'Atención completa para sellado',
        exploracionFisica: {
          inspeccionIntraoral: 'Exploración intraoral completa y detallada',
        },
        diagnosticos: [
          {
            codigoCIE10: 'K05.0',
            descripcion: 'Gingivitis aguda',
            tipo: 'DEFINITIVO',
          },
        ],
      })
      .expect(201);

    const consultaId = apertura.body.id;

    const res = await request(app.getHttpServer())
      .post(`/api/expediente/consultas-odontologicas/${consultaId}/completar`)
      .set(AUTH_HEADER)
      .send({
        versionEsperada: 1,
      })
      .expect(200);

    expect(res.body.estado).toBe('COMPLETADA');
    expect(res.body.cerradaEn).not.toBeNull();
    expect(res.body.version).toBe(2);
  });

  // ─── 14. Rechazar modificación posterior al cierre ────────────────────────────
  it('14. PUT /consultas-odontologicas/:id/atencion - Rechazar edición de consulta COMPLETADA (422)', async () => {
    // Abrir y completar
    const apertura = await request(app.getHttpServer())
      .post('/api/expediente/consultas-odontologicas')
      .set(AUTH_HEADER)
      .send({
        historiaClinicaId: historiaClinicaIdActiva,
        pacienteId: pacientePrincipalId,
        motivoConsulta: 'Para sellar y probar bloqueo',
        exploracionFisica: {
          inspeccionIntraoral: 'Exploración intraoral documentada adecuadamente',
        },
        diagnosticos: [
          {
            descripcion: 'Diagnóstico para completar',
            tipo: 'DEFINITIVO',
          },
        ],
      })
      .expect(201);

    const consultaId = apertura.body.id;

    await request(app.getHttpServer())
      .post(`/api/expediente/consultas-odontologicas/${consultaId}/completar`)
      .set(AUTH_HEADER)
      .send({ versionEsperada: 1 })
      .expect(200);

    // Intentar modificar datos clínicos tras cierre
    const res = await request(app.getHttpServer())
      .put(`/api/expediente/consultas-odontologicas/${consultaId}/atencion`)
      .set(AUTH_HEADER)
      .send({
        versionEsperada: 2,
        motivoConsulta: 'Modificación extemporánea',
      })
      .expect(422);

    expect(res.body.title).toContain('Consulta no editable');
  });

  // ─── 15. Cancelar consulta justificadamente ────────────────────────────────────
  it('15. POST /consultas-odontologicas/:id/cancelar - Cancelar consulta con justificación válida (200)', async () => {
    const apertura = await request(app.getHttpServer())
      .post('/api/expediente/consultas-odontologicas')
      .set(AUTH_HEADER)
      .send({
        historiaClinicaId: historiaClinicaIdActiva,
        pacienteId: pacientePrincipalId,
        motivoConsulta: 'Consulta que será cancelada',
      })
      .expect(201);

    const consultaId = apertura.body.id;

    const res = await request(app.getHttpServer())
      .post(`/api/expediente/consultas-odontologicas/${consultaId}/cancelar`)
      .set(AUTH_HEADER)
      .send({
        versionEsperada: 1,
        motivoCancelacion: 'Paciente manifiesta fobia severa y requiere reprogramación con sedación consciente',
      })
      .expect(200);

    expect(res.body.estado).toBe('CANCELADA');
    expect(res.body.motivoCancelacion).toContain('Paciente manifiesta fobia');
    expect(res.body.version).toBe(2);
  });

  // ─── 16. Rechazar cancelación inválida ─────────────────────────────────────────
  it('16. POST /consultas-odontologicas/:id/cancelar - Rechazar cancelación sin justificación válida (400)', async () => {
    const apertura = await request(app.getHttpServer())
      .post('/api/expediente/consultas-odontologicas')
      .set(AUTH_HEADER)
      .send({
        historiaClinicaId: historiaClinicaIdActiva,
        pacienteId: pacientePrincipalId,
        motivoConsulta: 'Consulta para cancelación inválida',
      })
      .expect(201);

    const consultaId = apertura.body.id;

    // Motivo menor a 5 caracteres rechazado por class-validator
    const res = await request(app.getHttpServer())
      .post(`/api/expediente/consultas-odontologicas/${consultaId}/cancelar`)
      .set(AUTH_HEADER)
      .send({
        versionEsperada: 1,
        motivoCancelacion: 'No',
      })
      .expect(400);

    expect(res.body.status).toBe(400);
  });

  // ─── 17. Control de versiones y HTTP 409 ───────────────────────────────────────
  it('17. PUT /consultas-odontologicas/:id/atencion - Control de versiones con versión esperada obsoleta (409 Conflict)', async () => {
    const apertura = await request(app.getHttpServer())
      .post('/api/expediente/consultas-odontologicas')
      .set(AUTH_HEADER)
      .send({
        historiaClinicaId: historiaClinicaIdActiva,
        pacienteId: pacientePrincipalId,
        motivoConsulta: 'Consulta para probar concurrencia',
      })
      .expect(201);

    const consultaId = apertura.body.id;

    // Actualización 1 (avanza a versión 2)
    await request(app.getHttpServer())
      .put(`/api/expediente/consultas-odontologicas/${consultaId}/atencion`)
      .set(AUTH_HEADER)
      .send({
        versionEsperada: 1,
        recomendaciones: 'Recomendación 1',
      })
      .expect(200);

    // Intentar actualizar nuevamente con versión 1 obsoleta
    const res = await request(app.getHttpServer())
      .put(`/api/expediente/consultas-odontologicas/${consultaId}/atencion`)
      .set(AUTH_HEADER)
      .send({
        versionEsperada: 1,
        recomendaciones: 'Recomendación tardía',
      })
      .expect(409);

    expect(res.body.title).toContain('Conflicto de concurrencia');
  });

  // ─── 18. Dos actualizaciones concurrentes sobre la misma versión ───────────────
  it('18. Concurrencia - Dos actualizaciones simultáneas sobre versión 1: solo una prospera', async () => {
    const apertura = await request(app.getHttpServer())
      .post('/api/expediente/consultas-odontologicas')
      .set(AUTH_HEADER)
      .send({
        historiaClinicaId: historiaClinicaIdActiva,
        pacienteId: pacientePrincipalId,
        motivoConsulta: 'Consulta para carrera de actualizaciones',
      })
      .expect(201);

    const consultaId = apertura.body.id;

    // Disparar simultáneamente dos actualizaciones ambas con versionEsperada = 1
    const p1 = request(app.getHttpServer())
      .put(`/api/expediente/consultas-odontologicas/${consultaId}/atencion`)
      .set(AUTH_HEADER)
      .send({
        versionEsperada: 1,
        recomendaciones: 'Actualización A',
      });

    const p2 = request(app.getHttpServer())
      .put(`/api/expediente/consultas-odontologicas/${consultaId}/atencion`)
      .set(SECONDARY_AUTH_HEADER)
      .send({
        versionEsperada: 1,
        recomendaciones: 'Actualización B',
      });

    const [r1, r2] = await Promise.all([p1, p2]);
    const statuses = [r1.status, r2.status].sort((a, b) => a - b);

    // Exactamente una debe ganar (200) y la otra perder por concurrencia (409)
    expect(statuses).toEqual([200, 409]);
  });

  // ─── 19. Dos aperturas concurrentes con la misma cita ──────────────────────────
  it('19. Concurrencia - Dos aperturas simultáneas con la misma cita: solo una prospera', async () => {
    const citaConcurrente = 'cita_dev_002';

    const p1 = request(app.getHttpServer())
      .post('/api/expediente/consultas-odontologicas')
      .set(AUTH_HEADER)
      .send({
        historiaClinicaId: historiaClinicaIdActiva,
        pacienteId: pacientePrincipalId,
        citaId: citaConcurrente,
        motivoConsulta: 'Apertura concurrente 1',
      });

    const p2 = request(app.getHttpServer())
      .post('/api/expediente/consultas-odontologicas')
      .set(SECONDARY_AUTH_HEADER)
      .send({
        historiaClinicaId: historiaClinicaIdActiva,
        pacienteId: pacientePrincipalId,
        citaId: citaConcurrente,
        motivoConsulta: 'Apertura concurrente 2',
      });

    const [r1, r2] = await Promise.all([p1, p2]);
    const statuses = [r1.status, r2.status].sort((a, b) => a - b);

    // Exactamente una debe tener 201 y la otra 409 por colisión de índice único
    expect(statuses).toEqual([201, 409]);
  });

  // ─── 20. Verificación de formato RFC 7807 Problem Details ──────────────────────
  it('20. Problem Details RFC 7807 - La respuesta incluye todos los campos canónicos requeridos', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/expediente/consultas-odontologicas/cons_no_existe_999')
      .set(AUTH_HEADER)
      .expect(404);

    expect(res.header['content-type']).toContain('application/problem+json');
    expect(res.body.type).toBeDefined();
    expect(res.body.title).toBeDefined();
    expect(res.body.status).toBe(404);
    expect(res.body.detail).toBeDefined();
    expect(res.body.instance).toContain('/api/expediente/consultas-odontologicas/cons_no_existe_999');
    expect(res.body.timestamp).toBeDefined();
  });

  // ─── 21. Rechazo de solicitudes sin token o con token falso ────────────────────
  it('21. Autenticación - Rechazo sin Authorization o con token no autorizado (401)', async () => {
    // 1. Sin header
    await request(app.getHttpServer())
      .get('/api/expediente/consultas-odontologicas/cons_arbitraria')
      .expect(401);

    // 2. Con token falso no reconocido
    await request(app.getHttpServer())
      .get('/api/expediente/consultas-odontologicas/cons_arbitraria')
      .set({ Authorization: 'Bearer token_invalido_hacker' })
      .expect(401);
  });

  // ─── 22. Validación de payloads y propiedades no permitidas (Mass Assignment) ─
  it('22. Validación - Rechazo de propiedades no permitidas por ValidationPipe (400 Bad Request)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/expediente/consultas-odontologicas')
      .set(AUTH_HEADER)
      .send({
        historiaClinicaId: historiaClinicaIdActiva,
        pacienteId: pacientePrincipalId,
        motivoConsulta: 'Intento de mass assignment',
        // Propiedades no permitidas en el DTO
        estado: 'COMPLETADA',
        version: 99,
        creadoPor: 'hacker_user',
      })
      .expect(400);

    expect(res.body.status).toBe(400);
    expect(res.body.detail).toContain('validaciones requeridas');
  });

  // ─── 23. Verificación de que Historia Clínica existente no sufrió regresiones ──
  it('23. Regresión - Los endpoints de Historia Clínica y /health siguen funcionando correctamente', async () => {
    // Health check
    const healthRes = await request(app.getHttpServer())
      .get('/api/expediente/health')
      .expect(200);

    expect(healthRes.body.status).toBe('ok');
    expect(healthRes.body.service).toBe('ms2-expediente');

    // Historia clínica existente
    const hcRes = await request(app.getHttpServer())
      .get(`/api/expediente/historias-clinicas/${historiaClinicaIdActiva}`)
      .set(AUTH_HEADER)
      .expect(200);

    expect(hcRes.body.id).toBe(historiaClinicaIdActiva);
    expect(hcRes.body.estado).toBe('ACTIVA');
  });
});
