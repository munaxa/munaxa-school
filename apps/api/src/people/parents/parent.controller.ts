import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { ParentService } from './parent.service';
import { CreateParentDto, UpdateParentDto } from './parent.dto';

@ApiTags('parents')
@ApiBearerAuth()
@Controller({ path: 'parents', version: '1' })
export class ParentController {
  constructor(private readonly service: ParentService) {}

  @Post()
  @RequirePermissions(Permission.PARENT_MANAGE)
  create(@Body() dto: CreateParentDto) {
    return this.service.create(dto);
  }

  @Get()
  @RequirePermissions(Permission.PARENT_MANAGE)
  @ApiQuery({ name: 'studentId', required: false })
  list(@Query('studentId') studentId?: string) {
    return this.service.list(studentId);
  }

  @Get(':id')
  @RequirePermissions(Permission.PARENT_MANAGE)
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.PARENT_MANAGE)
  update(@Param('id') id: string, @Body() dto: UpdateParentDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions(Permission.PARENT_MANAGE)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
