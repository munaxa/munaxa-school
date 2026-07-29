import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { RolesRepository } from './roles.repository';
import { CreateRoleDto, UpdateRoleDto } from './roles.dto';

/**
 * Per-tenant role administration: list/clone/edit/delete roles and read the permission catalog.
 * Gated by `role:manage` (held by SchoolAdmin). System roles can be re-permissioned per tenant
 * but not deleted; custom roles are fully managed here.
 */
@ApiTags('roles')
@ApiBearerAuth()
@Controller({ path: 'roles', version: '1' })
@RequirePermissions(Permission.ROLE_MANAGE)
export class RolesController {
  constructor(private readonly repo: RolesRepository) {}

  @Get()
  @ApiOperation({ summary: 'List tenant roles with their permissions and user counts' })
  list() {
    return this.repo.list();
  }

  @Get('catalog')
  @ApiOperation({ summary: 'List the global permission catalog (grouped by category)' })
  catalog() {
    return this.repo.catalog();
  }

  @Post()
  @ApiOperation({ summary: 'Create a custom role' })
  create(@Body() dto: CreateRoleDto) {
    return this.repo.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a role’s permissions and/or display names' })
  update(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.repo.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a custom role (must be unassigned)' })
  remove(@Param('id') id: string) {
    return this.repo.remove(id);
  }
}
