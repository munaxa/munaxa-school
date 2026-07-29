// Sentry must be initialized before anything else.
import './observability/instrument';

import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import type { Application } from 'express';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/prisma-exception.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: false });
  const logger = new Logger('Bootstrap');

  // Allow larger JSON bodies so base64-encoded uploads (e.g. a countersigned agreement PDF/photo
  // sent through the API instead of direct-to-bucket) are not rejected by the default ~100kb limit.
  app.useBodyParser('json', { limit: '20mb' });
  app.useBodyParser('urlencoded', { extended: true, limit: '20mb' });

  const port = Number(process.env.PORT ?? '4000');
  const globalPrefix = process.env.API_GLOBAL_PREFIX ?? 'api';
  const version = process.env.API_VERSION ?? 'v1';
  const corsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  // --- Security middleware (OWASP A05) ---
  app.use(helmet());
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // Parse cookies (httpOnly session for the web admin; mobile/API clients use Bearer tokens).
  app.use(cookieParser());

  // --- Performance: gzip responses (skip when the client opts out) ---
  app.use(compression());

  // Trust the reverse proxy (TLS termination, real client IP for rate limiting).
  const expressApp = app.getHttpAdapter().getInstance() as Application;
  expressApp.set('trust proxy', 1);

  // --- Routing & versioning ---
  app.setGlobalPrefix(globalPrefix);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: version.replace(/^v/, '') });

  // --- Validation (OWASP A03) ---
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Map known Prisma errors (e.g. duplicate national ID) to clean 4xx responses.
  app.useGlobalFilters(new PrismaExceptionFilter());

  app.enableShutdownHooks();

  // --- API documentation (Swagger / OpenAPI) ---
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Munaxa API')
      .setDescription('Munaxa — Multi-Tenant School Operating System API')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup(`${globalPrefix}/docs`, app, document);
  }

  await app.listen(port);
  logger.log(`Munaxa API listening on http://localhost:${port}/${globalPrefix}/${version}`);
}

void bootstrap();
