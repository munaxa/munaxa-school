import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { FeatureFlagGuard } from '../../feature-flags/feature-flag.guard';
import { FeatureFlagKey, RequireFeature } from '../../feature-flags/require-feature.decorator';
import { ClinicService } from './clinic.service';
import { CreateClinicVisitDto, UpsertMedicalRecordDto } from './clinic.dto';

@ApiTags('clinic')
@ApiBearerAuth()
@Controller({ path: 'clinic', version: '1' })
@UseGuards(FeatureFlagGuard)
@RequireFeature(FeatureFlagKey.SCHOOL_CLINIC)
export class ClinicController {
  constructor(private readonly service: ClinicService) {}

  @Post('visits')
  @RequirePermissions(Permission.CLINIC_MANAGE)
  @ApiOperation({ summary: 'Record a clinic visit' })
  createVisit(@Body() dto: CreateClinicVisitDto) {
    return this.service.createVisit(dto);
  }

  @Get('visits')
  @RequirePermissions(Permission.CLINIC_READ)
  @ApiQuery({ name: 'studentId', required: false })
  listVisits(@Query('studentId') studentId?: string) {
    return this.service.listVisits(studentId);
  }

  @Get('students/:studentId/record')
  @RequirePermissions(Permission.CLINIC_READ)
  @ApiOperation({ summary: "Get a student's medical record" })
  getRecord(@Param('studentId') studentId: string) {
    return this.service.getRecord(studentId);
  }

  @Put('students/:studentId/record')
  @RequirePermissions(Permission.CLINIC_MANAGE)
  @ApiOperation({ summary: "Create or update a student's medical record" })
  upsertRecord(@Param('studentId') studentId: string, @Body() dto: UpsertMedicalRecordDto) {
    return this.service.upsertRecord(studentId, dto);
  }
}
