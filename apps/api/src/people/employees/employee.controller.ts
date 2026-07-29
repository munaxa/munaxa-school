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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { EmployeeService } from './employee.service';
import {
  CreateEmployeeDto,
  ListEmployeesQueryDto,
  TransitionEmployeeStatusDto,
  UpdateEmployeeDto,
} from './employee.dto';

@ApiTags('employees')
@ApiBearerAuth()
@Controller({ path: 'employees', version: '1' })
export class EmployeeController {
  constructor(private readonly service: EmployeeService) {}

  @Post()
  @RequirePermissions(Permission.EMPLOYEE_MANAGE)
  @ApiOperation({ summary: 'Create an employee (seeds the lifecycle history).' })
  create(@Body() dto: CreateEmployeeDto) {
    return this.service.create(dto);
  }

  @Get()
  @RequirePermissions(Permission.EMPLOYEE_READ)
  @ApiOperation({ summary: 'List employees with optional filters.' })
  list(@Query() query: ListEmployeesQueryDto) {
    return this.service.list(query);
  }

  @Get(':id')
  @RequirePermissions(Permission.EMPLOYEE_READ)
  @ApiOperation({ summary: 'Get an employee profile with org + lifecycle history.' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.EMPLOYEE_MANAGE)
  @ApiOperation({
    summary: 'Update employee details (status is changed via the lifecycle endpoint).',
  })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEmployeeDto) {
    return this.service.update(id, dto);
  }

  @Post(':id/status')
  @RequirePermissions(Permission.HR_LIFECYCLE_MANAGE)
  @ApiOperation({ summary: 'Transition an employee to a new lifecycle status.' })
  transitionStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransitionEmployeeStatusDto,
  ) {
    return this.service.transitionStatus(id, dto);
  }

  @Get(':id/status-history')
  @RequirePermissions(Permission.EMPLOYEE_READ)
  @ApiOperation({ summary: 'List an employee’s lifecycle transitions (newest first).' })
  statusHistory(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.statusHistory(id);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions(Permission.EMPLOYEE_MANAGE)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
