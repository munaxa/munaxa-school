/**
 * Application boot smoke test — the cheapest, highest-value guard we have.
 *
 * It compiles the WHOLE AppModule (which resolves the entire Nest dependency-injection graph) and
 * initialises the HTTP app (which maps every route). This is exactly what fails when a provider's
 * dependency is not available in its module — e.g. the DocumentsModule re-providing StatementService
 * without FinancialAccountRepository — a class of error that typecheck and unit tests do NOT catch,
 * and that otherwise only surfaces at container startup (every route then 404s: "Cannot POST …").
 *
 * If this test goes red, the API will not boot. Never merge past a red boot test.
 */
import { Test } from '@nestjs/testing';
import { ValidationPipe, VersioningType, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Application boot (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // .compile() instantiates every provider → throws UnknownDependenciesException on a broken graph.
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init(); // maps routes + runs onModuleInit
  });

  afterAll(async () => {
    await app?.close();
  });

  it('resolves the DI graph and boots', () => {
    expect(app).toBeDefined();
  });

  // The routes must be MAPPED (a mapped-but-unauthorised route returns 401/400/405, never 404).
  // These are the finance/admissions routes whose absence produced the "Cannot POST" outage.
  it.each([
    ['post', '/api/v1/admissions/family/commit'],
    ['post', '/api/v1/admissions/commit'],
    ['get', '/api/v1/finance/families/search?q=xx'],
    ['post', '/api/v1/finance/payments/family/00000000-0000-0000-0000-000000000000'],
  ] as ReadonlyArray<['post' | 'get', string]>)(
    'maps %s %s (route exists — not 404)',
    async (method, path) => {
      const agent = request(app.getHttpServer());
      const res = method === 'post' ? await agent.post(path) : await agent.get(path);
      expect(res.status).not.toBe(404);
    },
  );
});
