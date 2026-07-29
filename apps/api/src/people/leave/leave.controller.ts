import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { LeaveService } from './leave.service';
import {
  CreateLeaveRequestDto,
  CreateLeaveTypeDto,
  DecideLeaveRequestDto,
  ListLeaveRequestsQueryDto,
  SetLeaveBalanceDto,
  UpdateLeaveTypeDto,
} from './leave.dto';

/** Leave types + the approver-facing request queue and decisions. */
@ApiTags('staff-leave')
@ApiBearerAuth()
@Controller({ path: 'hr', version: '1' })
export class LeaveController {
  constructor(private readonly service: LeaveService) {}

  @Get('leave-types')
  @RequirePermissions(Permission.STAFF_LEAVE_READ)
  listTypes() {
    return this.service.listTypes();
  }

  @Post('leave-types')
  @RequirePermissions(Permission.STAFF_LEAVE_MANAGE)
  createType(@Body() dto: CreateLeaveTypeDto) {
    return this.service.createType(dto);
  }

  @Patch('leave-types/:id')
  @RequirePermissions(Permission.STAFF_LEAVE_MANAGE)
  updateType(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLeaveTypeDto) {
    return this.service.updateType(id, dto);
  }

  @Delete('leave-types/:id')
  @HttpCode(204)
  @RequirePermissions(Permission.STAFF_LEAVE_MANAGE)
  removeType(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.removeType(id);
  }

  @Get('leave-requests')
  @RequirePermissions(Permission.STAFF_LEAVE_READ)
  listRequests(@Query() query: ListLeaveRequestsQueryDto) {
    return this.service.listRequests(query);
  }

  @Post('leave-requests/:id/approve')
  @RequirePermissions(Permission.STAFF_LEAVE_APPROVE)
  approve(@Param('id', ParseUUIDPipe) id: string, @Body() dto: DecideLeaveRequestDto) {
    return this.service.approve(id, dto);
  }

  @Post('leave-requests/:id/reject')
  @RequirePermissions(Permission.STAFF_LEAVE_APPROVE)
  reject(@Param('id', ParseUUIDPipe) id: string, @Body() dto: DecideLeaveRequestDto) {
    return this.service.reject(id, dto);
  }

  @Post('leave-requests/:id/cancel')
  @RequirePermissions(Permission.STAFF_LEAVE_REQUEST)
  cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.cancel(id);
  }
}

/** Employee-scoped leave balances + requests. */
@ApiTags('staff-leave')
@ApiBearerAuth()
@Controller({ path: 'employees/:employeeId', version: '1' })
export class EmployeeLeaveController {
  constructor(private readonly service: LeaveService) {}

  @Get('leave-balances')
  @RequirePermissions(Permission.STAFF_LEAVE_READ)
  balances(@Param('employeeId', ParseUUIDPipe) employeeId: string) {
    return this.service.listBalances(employeeId);
  }

  @Post('leave-balances')
  @RequirePermissions(Permission.STAFF_LEAVE_MANAGE)
  setBalance(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() dto: SetLeaveBalanceDto,
  ) {
    return this.service.setBalance(employeeId, dto);
  }

  @Get('leave-requests')
  @RequirePermissions(Permission.STAFF_LEAVE_READ)
  listRequests(@Param('employeeId', ParseUUIDPipe) employeeId: string) {
    return this.service.listForEmployee(employeeId);
  }

  @Post('leave-requests')
  @RequirePermissions(Permission.STAFF_LEAVE_REQUEST)
  createRequest(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() dto: CreateLeaveRequestDto,
  ) {
    return this.service.createRequest(employeeId, dto);
  }
}
