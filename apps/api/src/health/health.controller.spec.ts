import { Test } from '@nestjs/testing';
import { HealthCheckService, PrismaHealthIndicator } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { PrismaService } from '../prisma/prisma.service';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthCheckService,
          useValue: { check: jest.fn().mockResolvedValue({ status: 'ok' }) },
        },
        { provide: PrismaHealthIndicator, useValue: { pingCheck: jest.fn() } },
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();

    controller = moduleRef.get(HealthController);
  });

  it('liveness returns ok', () => {
    expect(controller.live().status).toBe('ok');
  });

  it('readiness delegates to health check service', async () => {
    const result = await controller.ready();
    expect(result.status).toBe('ok');
  });
});
