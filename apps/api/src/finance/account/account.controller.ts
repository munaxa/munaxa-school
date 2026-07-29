import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { AccountService } from './account.service';

@ApiTags('finance')
@ApiBearerAuth()
@Controller({ path: 'finance/accounts', version: '1' })
export class AccountController {
  constructor(private readonly service: AccountService) {}

  @Get(':studentId')
  @RequirePermissions(Permission.FINANCE_READ)
  @ApiOperation({ summary: 'Student Financial Account header + derived summary' })
  account(@Param('studentId') studentId: string) {
    return this.service.forStudent(studentId);
  }
}
