import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../../../auth/decorators/require-permissions.decorator';
import { BiometricIngestionService } from './biometric-ingestion.service';

/**
 * Device/biometric ingestion endpoints. Vendor-neutral: the `:providerKey` selects a registered
 * adapter, so onboarding a new device family never adds an endpoint. Thin controller.
 */
@ApiTags('staff-attendance')
@ApiBearerAuth()
@Controller({ path: 'hr/attendance/biometric', version: '1' })
export class BiometricController {
  constructor(private readonly service: BiometricIngestionService) {}

  @Get('providers')
  @RequirePermissions(Permission.STAFF_ATTENDANCE_READ)
  @ApiOperation({ summary: 'Registered biometric/device provider adapters' })
  providers() {
    return { providers: this.service.providers() };
  }

  @Post(':providerKey/punches')
  @RequirePermissions(Permission.BIOMETRIC_INGEST)
  @ApiOperation({
    summary: 'Ingest a batch of device punches (idempotent on the provider reference)',
  })
  ingest(@Param('providerKey') providerKey: string, @Body() payload: unknown) {
    return this.service.ingest(providerKey, payload);
  }

  @Post('process')
  @RequirePermissions(Permission.BIOMETRIC_INGEST)
  @ApiQuery({ name: 'date', required: true, example: '2026-03-08' })
  @ApiOperation({
    summary: "Fold a date's stored punches into staff attendance via the shift + policy engines",
  })
  process(@Query('date') date: string) {
    return this.service.process(date);
  }
}
