import { Body, Controller, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { MailService } from '../mail/mail.service';
import { UsersRepository } from './users.repository';
import { CreateUserDto, SetUserRolesDto, UpdateUserDto } from './users.dto';

/**
 * Tenant staff/user administration: create accounts, set status, assign roles, reset passwords.
 * Gated by `user:manage` (held by SchoolAdmin). Roles are assigned by id from the tenant's own
 * role catalog (see /roles), so custom roles work here too.
 */
@ApiTags('users')
@ApiBearerAuth()
@Controller({ path: 'users', version: '1' })
@RequirePermissions(Permission.USER_MANAGE)
export class UsersController {
  constructor(
    private readonly repo: UsersRepository,
    private readonly mail: MailService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List tenant users with their roles and status' })
  list() {
    return this.repo.list();
  }

  @Post()
  @ApiOperation({
    summary: 'Create a user; emails the temporary password when mail is configured',
  })
  async create(@Body() dto: CreateUserDto) {
    const result = await this.repo.create(dto);
    // Best-effort, after the transaction committed; the admin still sees the password once.
    const name =
      [result.user.firstNameEn, result.user.lastNameEn].filter(Boolean).join(' ').trim() ||
      result.user.username ||
      undefined;
    const { sent } = await this.mail.sendTemporaryPassword({
      to: result.user.email,
      userName: name,
      temporaryPassword: result.temporaryPassword,
    });
    return { ...result, emailed: sent };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a user’s profile or status (suspend/disable/activate)' })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.repo.update(id, dto);
  }

  @Put(':id/roles')
  @ApiOperation({ summary: 'Replace a user’s assigned roles' })
  setRoles(@Param('id') id: string, @Body() dto: SetUserRolesDto) {
    return this.repo.setRoles(id, dto);
  }

  @Post(':id/reset-password')
  @ApiOperation({
    summary: 'Reset to a new temporary password (returned once, emailed if configured)',
  })
  async resetPassword(@Param('id') id: string) {
    const { temporaryPassword, email, name } = await this.repo.resetPassword(id);
    const { sent } = await this.mail.sendTemporaryPassword({
      to: email,
      userName: name,
      temporaryPassword,
    });
    return { temporaryPassword, emailed: sent };
  }
}
