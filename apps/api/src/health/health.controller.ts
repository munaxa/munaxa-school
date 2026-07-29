import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  PrismaHealthIndicator,
  type HealthCheckResult,
} from '@nestjs/terminus';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../auth/decorators/public.decorator';

/** Liveness & readiness endpoints used by load balancers and orchestration. */
@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaIndicator: PrismaHealthIndicator,
    private readonly prisma: PrismaService,
  ) {}

  /** Liveness: process is up. */
  @Get('live')
  @HealthCheck()
  live(): HealthCheckResult {
    return { status: 'ok', info: {}, error: {}, details: {} };
  }

  /** Readiness: dependencies (DB) are reachable. */
  @Get('ready')
  @HealthCheck()
  ready(): Promise<HealthCheckResult> {
    return this.health.check([() => this.prismaIndicator.pingCheck('database', this.prisma)]);
  }
}
