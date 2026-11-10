import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppController } from '../src/app.controller.js';
import { AppService } from '../src/app.service.js';

describe('health HTTP endpoints', () => {
  let app: INestApplication;
  const connection = { readyState: 1 };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService, { provide: getConnectionToken(), useValue: connection }],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/expediente');
    await app.init();
  });

  afterAll(async () => { await app.close(); });

  it('returns 200 when MongoDB is connected', async () => {
    connection.readyState = 1;
    await request(app.getHttpServer()).get('/api/expediente/health/ready').expect(200);
  });

  it('returns 503 when MongoDB is not connected', async () => {
    for (const state of [0, 2, 3]) {
      connection.readyState = state;
      await request(app.getHttpServer()).get('/api/expediente/health/ready').expect(503);
    }
  });

  it('preserves liveness while MongoDB is disconnected', async () => {
    connection.readyState = 0;
    const response = await request(app.getHttpServer()).get('/api/expediente/health').expect(200);
    expect(response.body).toEqual({ service: 'ms2-expediente', status: 'ok', database: 'disconnected', timestamp: expect.any(String) });
  });
});
