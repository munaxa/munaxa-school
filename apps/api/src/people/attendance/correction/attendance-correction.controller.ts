import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../../../auth/decorators/require-permissions.decorator';
import { AttendanceCorrectionService } from './attendance-correction.service';
import {
  CreateCorrectionRequestDto,
  DecideCorrectionDto,
  ListCorrectionsQueryDto,
} from './attendance-correction.dto';

/** Staff attendance correction workflow: request → review → approve/reject → apply. Thin. */
@ApiTags('staff-attendance')
@ApiBearerAuth()
@Controller({ path: 'hr/attendance/corrections', version: '1' })
export class AttendanceCorrectionController {
  constructor(private readonly service: AttendanceCorrectionService) {}

  @Get()
  @RequirePermissions(Permission.STAFF_ATTENDANCE_READ)
  @ApiOperation({ summary: 'List correction requests (the approver inbox)' })
  list(@Query() query: ListCorrectionsQueryDto) {
    return this.service.list(query);
  }

  @Get(':id')
  @RequirePermissions(Permission.STAFF_ATTENDANCE_READ)
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(id);
  }

  @Post()
  @RequirePermissions(Permission.ATTENDANCE_CORRECTION_REQUEST)
  @ApiOperation({ summary: 'Raise a correction request (reason mandatory, evidence optional)' })
  create(@Body() dto: CreateCorrectionRequestDto) {
    return this.service.create(dto);
  }

  @Post(':id/approve')
  @RequirePermissions(Permission.ATTENDANCE_CORRECTION_APPROVE)
  @ApiOperation({ summary: 'Approve the current level; the final level applies the correction' })
  approve(@Param('id', ParseUUIDPipe) id: string, @Body() dto: DecideCorrectionDto) {
    return this.service.approve(id, dto);
  }

  @Post(':id/reject')
  @RequirePermissions(Permission.ATTENDANCE_CORRECTION_APPROVE)
  reject(@Param('id', ParseUUIDPipe) id: string, @Body() dto: DecideCorrectionDto) {
    return this.service.reject(id, dto);
  }

  @Post(':id/cancel')
  @RequirePermissions(Permission.ATTENDANCE_CORRECTION_REQUEST)
  @ApiOperation({ summary: 'Cancel your own request before it is applied' })
  cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.cancel(id);
  }
}
