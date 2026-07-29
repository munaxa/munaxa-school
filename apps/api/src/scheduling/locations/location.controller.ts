import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import {
  RequirePermissions,
  RequireAnyPermission,
} from '../../auth/decorators/require-permissions.decorator';
import { LocationService } from './location.service';
import { CreateLocationDto, UpdateLocationDto } from './location.dto';

@ApiTags('special-locations')
@ApiBearerAuth()
@Controller({ path: 'special-locations', version: '1' })
export class LocationController {
  constructor(private readonly service: LocationService) {}

  @Post()
  @RequirePermissions(Permission.TIMETABLE_MANAGE)
  create(@Body() dto: CreateLocationDto) {
    return this.service.create(dto);
  }

  @Get()
  @RequireAnyPermission(Permission.TIMETABLE_MANAGE, Permission.TIMETABLE_READ)
  @ApiQuery({ name: 'campusId', required: false })
  list(@Query('campusId') campusId?: string) {
    return this.service.list(campusId);
  }

  @Get(':id')
  @RequireAnyPermission(Permission.TIMETABLE_MANAGE, Permission.TIMETABLE_READ)
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.TIMETABLE_MANAGE)
  update(@Param('id') id: string, @Body() dto: UpdateLocationDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.TIMETABLE_MANAGE)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
