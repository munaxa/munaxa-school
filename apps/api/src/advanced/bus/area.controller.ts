import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../../auth/decorators/require-permissions.decorator';
import { AreaService } from './area.service';
import { CreateAreaDto, UpdateAreaDto } from './area.dto';

/**
 * Geographic Area master data. Deliberately NOT behind the bus_tracking feature flag:
 * areas are read during registration (by registrars with ENROLLMENT_MANAGE/STUDENT_MANAGE)
 * and in Fleet (BUS_READ). Management is reserved for fleet managers (BUS_MANAGE).
 */
@ApiTags('areas')
@ApiBearerAuth()
@Controller({ path: 'areas', version: '1' })
export class AreaController {
  constructor(private readonly service: AreaService) {}

  @Get()
  // Readable by anyone who plans transport (Fleet) or registers students (Admissions).
  @RequireAnyPermission(
    Permission.BUS_READ,
    Permission.ENROLLMENT_MANAGE,
    Permission.STUDENT_MANAGE,
  )
  @ApiOperation({ summary: 'List areas (optionally only active / transport-enabled)' })
  @ApiQuery({ name: 'active', required: false, type: Boolean })
  @ApiQuery({ name: 'transportAvailable', required: false, type: Boolean })
  list(@Query('active') active?: string, @Query('transportAvailable') transportAvailable?: string) {
    return this.service.list({
      ...(active !== undefined ? { active: active === 'true' } : {}),
      ...(transportAvailable !== undefined
        ? { transportationAvailable: transportAvailable === 'true' }
        : {}),
    });
  }

  @Post()
  @RequirePermissions(Permission.BUS_MANAGE)
  @ApiOperation({ summary: 'Create an area' })
  create(@Body() dto: CreateAreaDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePermissions(Permission.BUS_MANAGE)
  @ApiOperation({ summary: 'Update an area' })
  update(@Param('id') id: string, @Body() dto: UpdateAreaDto) {
    return this.service.update(id, dto);
  }
}
