import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { OrganizationsService } from './organizations.service';
import { AssignSchoolDto, CreateOrganizationDto, UpdateOrganizationDto } from './organizations.dto';

/** Platform Console — Organizations (school groups). Read = school-read; writes = tenant-manage. */
@ApiTags('platform-organizations')
@ApiBearerAuth()
@Controller({ path: 'platform/console/organizations', version: '1' })
export class OrganizationsController {
  constructor(private readonly service: OrganizationsService) {}

  @Get()
  @RequirePermissions(Permission.PLATFORM_SCHOOL_READ)
  @ApiOperation({ summary: 'List organizations' })
  list(@Query('includeArchived') includeArchived?: string) {
    return this.service.list(includeArchived === 'true');
  }

  @Get('assignable-schools')
  @RequirePermissions(Permission.PLATFORM_SCHOOL_READ)
  @ApiOperation({ summary: 'Schools not yet in any organization' })
  assignable() {
    return this.service.assignableSchools();
  }

  @Get(':id')
  @RequirePermissions(Permission.PLATFORM_SCHOOL_READ)
  @ApiOperation({
    summary: 'Organization detail (schools, subscriptions, billing + usage summary)',
  })
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Post()
  @RequirePermissions(Permission.PLATFORM_TENANT_MANAGE)
  @ApiOperation({ summary: 'Create an organization' })
  create(@Body() dto: CreateOrganizationDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePermissions(Permission.PLATFORM_TENANT_MANAGE)
  @ApiOperation({ summary: 'Edit an organization' })
  update(@Param('id') id: string, @Body() dto: UpdateOrganizationDto) {
    return this.service.update(id, dto);
  }

  @Post(':id/archive')
  @RequirePermissions(Permission.PLATFORM_TENANT_MANAGE)
  @ApiOperation({ summary: 'Archive an organization (detaches its schools to standalone)' })
  archive(@Param('id') id: string) {
    return this.service.archive(id);
  }

  @Post(':id/schools')
  @RequirePermissions(Permission.PLATFORM_TENANT_MANAGE)
  @ApiOperation({ summary: 'Assign a school to the organization' })
  assign(@Param('id') id: string, @Body() dto: AssignSchoolDto) {
    return this.service.assignSchool(id, dto.tenantId);
  }

  @Delete(':id/schools/:tenantId')
  @RequirePermissions(Permission.PLATFORM_TENANT_MANAGE)
  @ApiOperation({ summary: 'Remove a school from the organization' })
  remove(@Param('id') id: string, @Param('tenantId') tenantId: string) {
    return this.service.removeSchool(id, tenantId);
  }
}
