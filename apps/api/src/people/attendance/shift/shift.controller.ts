import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../../../auth/decorators/require-permissions.decorator';
import { ShiftService } from './shift.service';
import { AssignShiftDto, CreateShiftDto, UpdateShiftDto } from './shift.dto';

/** Shift definitions (windows, breaks, hour caps). Thin controller. */
@ApiTags('staff-attendance')
@ApiBearerAuth()
@Controller({ path: 'hr/shifts', version: '1' })
export class ShiftController {
  constructor(private readonly service: ShiftService) {}

  @Get()
  @RequirePermissions(Permission.SHIFT_READ)
  list() {
    return this.service.list();
  }

  @Get(':id')
  @RequirePermissions(Permission.SHIFT_READ)
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(id);
  }

  @Post()
  @RequirePermissions(Permission.SHIFT_MANAGE)
  @ApiOperation({ summary: 'Create a shift window (morning/evening/split/flexible/weekend)' })
  create(@Body() dto: CreateShiftDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePermissions(Permission.SHIFT_MANAGE)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateShiftDto) {
    return this.service.update(id, dto);
  }
}

/** Employee-scoped shift assignments. */
@ApiTags('staff-attendance')
@ApiBearerAuth()
@Controller({ path: 'employees/:employeeId/shifts', version: '1' })
export class EmployeeShiftController {
  constructor(private readonly service: ShiftService) {}

  @Get()
  @RequirePermissions(Permission.SHIFT_READ)
  list(@Param('employeeId', ParseUUIDPipe) employeeId: string) {
    return this.service.listAssignments(employeeId);
  }

  @Post()
  @RequirePermissions(Permission.SHIFT_MANAGE)
  @ApiOperation({ summary: 'Assign a shift to an employee over an effective window' })
  assign(@Param('employeeId', ParseUUIDPipe) employeeId: string, @Body() dto: AssignShiftDto) {
    return this.service.assign(employeeId, dto);
  }
}
