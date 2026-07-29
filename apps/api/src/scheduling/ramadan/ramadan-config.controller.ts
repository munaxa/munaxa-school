import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { RamadanConfigService } from './ramadan-config.service';
import { UpsertRamadanConfigDto } from './ramadan-config.dto';

@ApiTags('schedule')
@ApiBearerAuth()
@Controller({ path: 'schedule/ramadan', version: '1' })
export class RamadanConfigController {
  constructor(private readonly service: RamadanConfigService) {}

  @Get(':campusId')
  @RequirePermissions(Permission.TIMETABLE_READ)
  @ApiOperation({ summary: 'Get a campus Ramadan schedule config' })
  get(@Param('campusId') campusId: string) {
    return this.service.get(campusId);
  }

  @Put(':campusId')
  @RequirePermissions(Permission.TIMETABLE_MANAGE)
  @ApiOperation({ summary: 'Set a campus Ramadan schedule config (mode + window)' })
  upsert(@Param('campusId') campusId: string, @Body() dto: UpsertRamadanConfigDto) {
    return this.service.upsert(campusId, dto);
  }
}
