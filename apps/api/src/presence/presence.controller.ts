import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PresenceService } from './presence.service';
import {
  CreateBusEventDto,
  CreatePresenceEventDto,
  ListEventsQueryDto,
  UpdateAttendanceSettingsDto,
} from './presence.dto';

/** Campus presence events (gate / reception). Offline-queue target — idempotent on clientRef. */
@ApiTags('presence')
@ApiBearerAuth()
@Controller({ path: 'presence', version: '1' })
export class PresenceController {
  constructor(private readonly service: PresenceService) {}

  @Post('events')
  @RequirePermissions(Permission.PRESENCE_CREATE)
  @ApiOperation({ summary: 'Record a campus presence event (idempotent on clientRef)' })
  create(@Body() dto: CreatePresenceEventDto) {
    return this.service.createPresence(dto);
  }

  @Get('events')
  @RequirePermissions(Permission.PRESENCE_READ)
  list(@Query() q: ListEventsQueryDto) {
    return this.service.listPresence(q.studentId, q.take);
  }
}

/** Transportation events (bus boarding / arrival). Offline-queue target — idempotent on clientRef. */
@ApiTags('transport')
@ApiBearerAuth()
@Controller({ path: 'transport', version: '1' })
export class TransportController {
  constructor(private readonly service: PresenceService) {}

  @Post('events')
  @RequirePermissions(Permission.TRANSPORT_CREATE)
  @ApiOperation({ summary: 'Record a bus event (idempotent on clientRef)' })
  create(@Body() dto: CreateBusEventDto) {
    return this.service.createBus(dto);
  }

  @Get('events')
  @RequirePermissions(Permission.TRANSPORT_READ)
  list(@Query() q: ListEventsQueryDto) {
    return this.service.listBus(q.studentId, q.take);
  }
}

/** Unified student timeline (attendance + presence + bus), chronological. */
@ApiTags('presence')
@ApiBearerAuth()
@Controller({ path: 'students', version: '1' })
export class TimelineController {
  constructor(private readonly service: PresenceService) {}

  @Get(':studentId/timeline')
  @RequirePermissions(Permission.ATTENDANCE_READ)
  @ApiOperation({ summary: 'Unified chronological timeline for a student' })
  timeline(@Param('studentId', ParseUUIDPipe) studentId: string) {
    return this.service.timeline(studentId);
  }
}

/** Per-tenant attendance-source configuration. */
@ApiTags('attendance')
@ApiBearerAuth()
@Controller({ path: 'attendance/settings', version: '1' })
export class AttendanceSettingsController {
  constructor(private readonly service: PresenceService) {}

  @Get()
  @RequirePermissions(Permission.ATTENDANCE_READ)
  get() {
    return this.service.getSettings();
  }

  @Put()
  @RequirePermissions(Permission.ATTENDANCE_CONFIGURE)
  @ApiOperation({ summary: 'Set attendance source mode + presence/transport toggles' })
  update(@Body() dto: UpdateAttendanceSettingsDto) {
    return this.service.updateSettings(dto);
  }
}
