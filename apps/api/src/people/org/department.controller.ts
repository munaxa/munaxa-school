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
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { DepartmentService } from './department.service';
import { CreateDepartmentDto, UpdateDepartmentDto } from './department.dto';

@ApiTags('hr-org')
@ApiBearerAuth()
@Controller({ path: 'hr/departments', version: '1' })
export class DepartmentController {
  constructor(private readonly service: DepartmentService) {}

  @Post()
  @RequirePermissions(Permission.HR_ORG_MANAGE)
  create(@Body() dto: CreateDepartmentDto) {
    return this.service.create(dto);
  }

  @Get()
  @RequirePermissions(Permission.HR_ORG_READ)
  list() {
    return this.service.list();
  }

  @Get(':id')
  @RequirePermissions(Permission.HR_ORG_READ)
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.HR_ORG_MANAGE)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDepartmentDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions(Permission.HR_ORG_MANAGE)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
