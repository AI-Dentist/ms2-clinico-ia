import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import request from 'supertest';
import { App } from 'supertest/types.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  let connection: Connection;
  let testDbName: string;
  const originalMongoUri = process.env.MONGODB_URI;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeAll(async () => {
    testDbName = `test-app-e2e-${randomUUID()}`;
    process.env.MONGODB_URI = `mongodb://127.0.0.1:27017/${testDbName}`;
    process.env.NODE_ENV = 'test';

    const { AppModule } = await import('../src/app.module.js');

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    connection = app.get<Connection>(getConnectionToken());
    const activeDbName = connection.db?.databaseName;
    if (
      !activeDbName ||
      !activeDbName.startsWith('test-app-e2e-') ||
      activeDbName === 'clinica-dentalDB' ||
      activeDbName === 'admin' ||
      activeDbName === 'local'
    ) {
      await app.close();
      throw new Error(
        `CRÍTICO: Abortando suite AppController. Base de datos resuelta no autorizada: '${activeDbName}'. Solo se permiten bases temporales que inicien con 'test-app-e2e-'.`,
      );
    }

    await connection.syncIndexes();
  });

  afterAll(async () => {
    try {
      if (connection) {
        const dbName = connection.db?.databaseName;
        if (dbName && dbName === testDbName && dbName.startsWith('test-app-e2e-')) {
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

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('ok');
        expect(res.body.service).toBe('ms2-expediente');
      });
  });
});

