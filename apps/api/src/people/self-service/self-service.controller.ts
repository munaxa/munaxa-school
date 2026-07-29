import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { SelfServiceService } from './self-service.service';
import { CreateLeaveRequestDto, DecideLeaveRequestDto } from '../leave/leave.dto';
import { ListAttendanceQueryDto } from '../attendance/attendance.dto';

/** Employee self-service: the acting user's own HR data. */
@ApiTags('self-service')
@ApiBearerAuth()
@Controller({ path: 'me/hr', version: '1' })
export class EssController {
  constructor(private readonly service: SelfServiceService) {}

  @Get('profile')
  @RequirePermissions(Permission.ESS_READ)
  profile() {
    return this.service.myProfile();
  }

  @Get('leave-balances')
  @RequirePermissions(Permission.ESS_READ)
  leaveBalances() {
    return this.service.myLeaveBalances();
  }

  @Get('leave-requests')
  @RequirePermissions(Permission.ESS_READ)
  leaveRequests() {
    return this.service.myLeaveRequests();
  }

  @Post('leave-requests')
  @RequirePermissions(Permission.ESS_REQUEST)
  submitLeave(@Body() dto: CreateLeaveRequestDto) {
    return this.service.submitLeave(dto);
  }

  @Post('leave-requests/:id/cancel')
  @RequirePermissions(Permission.ESS_REQUEST)
  cancelLeave(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.cancelLeave(id);
  }

  @Get('attendance')
  @RequirePermissions(Permission.ESS_READ)
  attendance(@Query() query: ListAttendanceQueryDto) {
    return this.service.myAttendance(query);
  }

  @Get('assets')
  @RequirePermissions(Permission.ESS_READ)
  assets() {
    return this.service.myAssets();
  }

  @Get('training')
  @RequirePermissions(Permission.ESS_READ)
  training() {
    return this.service.myTraining();
  }

  @Get('reviews')
  @RequirePermissions(Permission.ESS_READ)
  reviews() {
    return this.service.myReviews();
  }

  @Post('reviews/:id/acknowledge')
  @RequirePermissions(Permission.ESS_READ)
  acknowledge(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.acknowledgeReview(id);
  }
}

/** Manager portal: a manager's direct reports and their pending leave. */
@ApiTags('self-service')
@ApiBearerAuth()
@Controller({ path: 'me/team', version: '1' })
export class TeamController {
  constructor(private readonly service: SelfServiceService) {}

  @Get('members')
  @RequirePermissions(Permission.TEAM_READ)
  members() {
    return this.service.myReports();
  }

  @Get('leave-requests')
  @RequirePermissions(Permission.TEAM_READ)
  pendingLeave() {
    return this.service.teamPendingLeave();
  }

  @Post('leave-requests/:id/approve')
  @RequirePermissions(Permission.TEAM_APPROVE)
  approve(@Param('id', ParseUUIDPipe) id: string, @Body() dto: DecideLeaveRequestDto) {
    return this.service.approveTeamLeave(id, dto);
  }

  @Post('leave-requests/:id/reject')
  @RequirePermissions(Permission.TEAM_APPROVE)
  reject(@Param('id', ParseUUIDPipe) id: string, @Body() dto: DecideLeaveRequestDto) {
    return this.service.rejectTeamLeave(id, dto);
  }
}
