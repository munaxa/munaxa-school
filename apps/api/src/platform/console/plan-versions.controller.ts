import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { PlanVersionsService } from './plan-versions.service';

class CreateVersionDto {
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}
class MigrateDto {
  @IsUUID() toVersionId!: string;
}

/** Platform Console — Plan Versions (immutable snapshots; publish / retire / compare / migrate). */
@ApiTags('platform-plan-versions')
@ApiBearerAuth()
@Controller({ path: 'platform/console/plans/:planId/versions', version: '1' })
export class PlanVersionsController {
  constructor(private readonly service: PlanVersionsService) {}

  @Get()
  @RequirePermissions(Permission.PLATFORM_SUBSCRIPTION_READ)
  @ApiOperation({ summary: 'List versions of a plan' })
  list(@Param('planId') planId: string) {
    return this.service.list(planId);
  }

  @Get('compare')
  @RequirePermissions(Permission.PLATFORM_SUBSCRIPTION_READ)
  @ApiOperation({ summary: 'Compare two versions' })
  compare(@Query('a') a: string, @Query('b') b: string) {
    return this.service.compare(a, b);
  }

  @Post()
  @RequirePermissions(Permission.PLATFORM_PLAN_MANAGE)
  @ApiOperation({ summary: 'Create a new version (snapshot of the current plan)' })
  create(@Param('planId') planId: string, @Body() dto: CreateVersionDto) {
    return this.service.createVersion(planId, dto.notes);
  }

  @Post(':versionId/publish')
  @RequirePermissions(Permission.PLATFORM_PLAN_MANAGE)
  @ApiOperation({ summary: 'Publish a version (new customers receive it)' })
  publish(@Param('versionId') versionId: string) {
    return this.service.publish(versionId);
  }

  @Post(':versionId/retire')
  @RequirePermissions(Permission.PLATFORM_PLAN_MANAGE)
  @ApiOperation({ summary: 'Retire a version (existing customers keep it)' })
  retire(@Param('versionId') versionId: string) {
    return this.service.retire(versionId);
  }

  @Get('migration-preview')
  @RequirePermissions(Permission.PLATFORM_SUBSCRIPTION_READ)
  @ApiOperation({ summary: 'Preview which schools a migration would move' })
  preview(@Param('planId') planId: string, @Query('toVersionId') toVersionId: string) {
    return this.service.migrationPreview(planId, toVersionId);
  }

  @Post('migrate')
  @RequirePermissions(Permission.PLATFORM_PLAN_MANAGE)
  @ApiOperation({ summary: 'Migrate existing customers to a target version' })
  migrate(@Param('planId') planId: string, @Body() dto: MigrateDto) {
    return this.service.migrate(planId, dto.toVersionId);
  }
}
