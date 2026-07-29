import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { LeaveRequestStatus } from '@prisma/client';
import { Permission } from '@school/domain';
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../../auth/decorators/require-permissions.decorator';
import { LeaveRequestService } from './leave-request.service';
import { CreateLeaveRequestDto, DecideLeaveRequestDto } from './leave-request.dto';

@ApiTags('parent-portal')
@ApiBearerAuth()
@Controller({ path: 'leave-requests', version: '1' })
export class LeaveRequestController {
  constructor(private readonly service: LeaveRequestService) {}

  @Post()
  @RequirePermissions(Permission.LEAVE_REQUEST)
  @ApiOperation({ summary: 'Parent submits a leave/absence request for a linked child' })
  create(@Body() dto: CreateLeaveRequestDto) {
    return this.service.create(dto);
  }

  @Get()
  @RequireAnyPermission(Permission.LEAVE_REQUEST, Permission.LEAVE_APPROVE)
  @ApiQuery({ name: 'status', required: false, enum: LeaveRequestStatus })
  @ApiOperation({ summary: 'List requests (parents see their children; staff see the queue)' })
  list(@Query('status') status?: LeaveRequestStatus) {
    return this.service.list(status);
  }

  @Post(':id/decision')
  @HttpCode(200)
  @RequirePermissions(Permission.LEAVE_APPROVE)
  @ApiOperation({ summary: 'Staff approves or rejects a pending request' })
  decide(@Param('id') id: string, @Body() dto: DecideLeaveRequestDto) {
    return this.service.decide(id, dto);
  }

  @Delete(':id')
  @RequireAnyPermission(Permission.LEAVE_REQUEST, Permission.LEAVE_APPROVE)
  @ApiOperation({ summary: 'Cancel a pending request' })
  cancel(@Param('id') id: string) {
    return this.service.cancel(id);
  }
}
