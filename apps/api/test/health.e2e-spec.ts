/**
 * End-to-end tests for the health endpoints (Phase 15): liveness is public and cheap; readiness
 * pings the real database. These back the load-balancer / orchestrator probes.
 */
import { Test } from '@nestjs/testing';
import { ValidationPipe, VersioningType, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Health (e2e)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('liveness is public and returns ok', async () => {
    const res = await http().get('/api/v1/health/live').expect(200);
    expect(res.body.status).toBe('ok');
  });

  it('readiness reports the database as up', async () => {
    const res = await http().get('/api/v1/health/ready').expect(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.info.database.status).toBe('up');
  });
});
