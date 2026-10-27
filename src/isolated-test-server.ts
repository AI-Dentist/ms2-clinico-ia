import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import { ProblemDetailsFilter } from './modules/historias-clinicas/infrastructure/http/filters/problem-details.filter.js';

// 1. Forzar entorno de test e inmutabilidad de configuración
process.env.NODE_ENV = 'test';

const TARGET_PORT = Number(process.env.PORT_ISOLATED || 3002);
const FORBIDDEN_PORT = 27017;
const REQUIRED_MONGO_PORT = 27018;

const DEFAULT_DB = process.env.ISOLATED_DB_NAME || 'test-estudios-int-d8f41e9c';
const DEFAULT_ISOLATED_URI = `mongodb://127.0.0.1:27018/${DEFAULT_DB}?replicaSet=rs_odontograma_test`;
const mongoUri = process.env.ISOLATED_MONGODB_URI || DEFAULT_ISOLATED_URI;

// 2. Salvaguardas defensivas de seguridad clínica antes de iniciar NestJS
if (mongoUri.includes(String(FORBIDDEN_PORT)) || mongoUri.includes('clinica-dentalDB')) {
  console.error('CRÍTICO: Violación de seguridad clínica. Prohibida cualquier conexión hacia 27017 o clinica-dentalDB.');
  process.exit(1);
}

if (!mongoUri.includes(String(REQUIRED_MONGO_PORT)) || !mongoUri.includes('rs_odontograma_test')) {
  console.error(`CRÍTICO: La base de datos debe residir exclusivamente en 127.0.0.1:${REQUIRED_MONGO_PORT} con replicaSet rs_odontograma_test.`);
  process.exit(1);
}

// Sobrescribir variables de entorno en proceso para el AppModule
process.env.PORT = String(TARGET_PORT);
process.env.MONGODB_URI = mongoUri;

async function bootstrapIsolated() {
  const logger = new Logger('IsolatedTestServer');
  logger.log(`Iniciando servidor NestJS aislado en puerto ${TARGET_PORT}...`);
  logger.log(`Conexión a MongoDB temporal en: ${mongoUri}`);

  const { AppModule } = await import('./app.module.js');

  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'warn', 'error', 'debug'],
  });

  // Habilitar CORS para permitir solicitudes del Microfrontend React (puerto 5173)
  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  app.setGlobalPrefix('api/expediente');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new ProblemDetailsFilter());

  // 3. Verificación de seguridad de conexión de base de datos activa
  const connection = app.get<Connection>(getConnectionToken());
  const activePort = (connection as any)?.port;
  if (activePort && activePort !== REQUIRED_MONGO_PORT) {
    logger.error(`CRÍTICO: Puerto de conexión erróneo (${activePort}). Debe ser ${REQUIRED_MONGO_PORT}. Abortando.`);
    await app.close();
    process.exit(1);
  }

  // 4. Siembra de fixtures sintéticos clínicos requeridos en base temporal
  await sembrarFixturesSinteticos(connection, logger);

  await app.listen(TARGET_PORT, '127.0.0.1');
  logger.log(`Servidor de pruebas aislado operativo en: http://127.0.0.1:${TARGET_PORT}/api/expediente`);
}

async function sembrarFixturesSinteticos(connection: Connection, logger: Logger): Promise<void> {
  const db = connection.db;
  if (!db) {
    logger.warn('Base de datos no disponible para sembrado de fixtures sintéticos.');
    return;
  }

  const historiasColl = db.collection<any>('historias_clinicas');
  const consultasColl = db.collection<any>('consultas_odontologicas');

  // Historias clínicas sintéticas activas
  const historiasSinteticas = [
    {
      _id: 'hc_8af2ae02-5a6a-4bb0-8da1-1c9e23cff07a',
      pacienteId: 'pac_8af2ae02-5a6a-4bb0-8da1-1c9e23cff07a',
      odontologoResponsableId: 'od_henry_principal',
      estado: 'ACTIVA',
      antecedentes: {
        patologicos: [],
        noPatologicos: [],
        familiares: [],
        estomatologicos: [],
      },
      alergias: [],
      medicamentosActuales: [],
      observacionesGenerales: 'Expediente sintético para verificación E2E de Odontograma',
      version: 1,
      creadoEn: new Date('2026-10-27T00:00:00.000Z'),
      actualizadoEn: new Date('2026-10-27T00:00:00.000Z'),
    },
    {
      _id: 'hc_12345678-aaaa-bbbb',
      pacienteId: 'pac_12345678-aaaa-bbbb',
      odontologoResponsableId: 'od_henry_principal',
      estado: 'ACTIVA',
      antecedentes: {
        patologicos: [],
        noPatologicos: [],
        familiares: [],
        estomatologicos: [],
      },
      alergias: [],
      medicamentosActuales: [],
      observacionesGenerales: 'Expediente sintético secundario Dennis 001',
      version: 1,
      creadoEn: new Date('2026-10-27T00:00:00.000Z'),
      actualizadoEn: new Date('2026-10-27T00:00:00.000Z'),
    },
  ];

  for (const hc of historiasSinteticas) {
    await historiasColl.updateOne(
      { _id: hc._id },
      { $setOnInsert: hc },
      { upsert: true }
    );
  }

  // Consultas sintéticas activas en curso
  const consultasSinteticas = [
    {
      _id: 'cons_8af2ae02-5a6a-4bb0-8da1-1c9e23cff07a',
      historiaClinicaId: 'hc_8af2ae02-5a6a-4bb0-8da1-1c9e23cff07a',
      pacienteId: 'pac_8af2ae02-5a6a-4bb0-8da1-1c9e23cff07a',
      odontologoId: 'od_henry_principal',
      citaId: null,
      versionHistoriaReferenciada: 1,
      snapshotRiesgoClinico: {
        alergiasCriticas: [],
        condicionesMedicas: [],
        medicacionHabitual: [],
        capturadoEn: new Date('2026-10-27T00:00:00.000Z'),
      },
      fechaAtencion: new Date('2026-10-27T00:00:00.000Z'),
      cerradaEn: null,
      estado: 'EN_CURSO',
      motivoConsulta: 'Evaluación estomatológica general y confección de odontograma',
      anamnesisActual: {
        descripcion: 'Paciente asiste a control dental periódico',
        tiempoEvolucion: 'Asintomático',
        escalaDolorEVA: 0,
      },
      exploracionFisica: {
        inspeccionExtraoral: 'Normal',
        inspeccionIntraoral: 'Mucosas íntegras',
        hallazgosDentales: null,
      },
      diagnosticos: [],
      procedimientosRealizados: [],
      evolucionSOAP: {
        subjetivo: 'Paciente asiste a control dental preventivo.',
        objetivo: 'Inspección visual completa.',
        analisis: 'Plan de tratamiento preventivo.',
        plan: 'Levantamiento de odontograma inicial.',
      },
      creadoPor: 'od_henry_principal',
      actualizadoPor: 'od_henry_principal',
      version: 1,
      creadoEn: new Date('2026-10-27T00:00:00.000Z'),
      actualizadoEn: new Date('2026-10-27T00:00:00.000Z'),
    },
    {
      _id: 'cons_12345678-aaaa-bbbb',
      historiaClinicaId: 'hc_12345678-aaaa-bbbb',
      pacienteId: 'pac_12345678-aaaa-bbbb',
      odontologoId: 'od_henry_principal',
      citaId: null,
      versionHistoriaReferenciada: 1,
      snapshotRiesgoClinico: {
        alergiasCriticas: [],
        condicionesMedicas: [],
        medicacionHabitual: [],
        capturadoEn: new Date('2026-10-27T00:00:00.000Z'),
      },
      fechaAtencion: new Date('2026-10-27T00:00:00.000Z'),
      cerradaEn: null,
      estado: 'EN_CURSO',
      motivoConsulta: 'Consulta sintética secundaria Dennis 001',
      anamnesisActual: {
        descripcion: 'Evaluación rutinaria preventiva',
        tiempoEvolucion: 'Asintomático',
        escalaDolorEVA: 0,
      },
      exploracionFisica: {
        inspeccionExtraoral: 'Normal',
        inspeccionIntraoral: 'Normal',
        hallazgosDentales: null,
      },
      diagnosticos: [],
      procedimientosRealizados: [],
      evolucionSOAP: {
        subjetivo: 'Sin quejas',
        objetivo: 'Apertura de odontograma',
        analisis: 'Planificado',
        plan: 'Revisión basal',
      },
      creadoPor: 'od_henry_principal',
      actualizadoPor: 'od_henry_principal',
      version: 1,
      creadoEn: new Date('2026-10-27T00:00:00.000Z'),
      actualizadoEn: new Date('2026-10-27T00:00:00.000Z'),
    },
  ];

  for (const c of consultasSinteticas) {
    await consultasColl.updateOne(
      { _id: c._id },
      { $set: c },
      { upsert: true }
    );
  }

  logger.log('Fixtures sintéticos inicializados en MongoDB 27018 con éxito.');
}

bootstrapIsolated().catch((err) => {
  console.error('Fallo fatal al iniciar el servidor aislado:', err);
  process.exit(1);
});
