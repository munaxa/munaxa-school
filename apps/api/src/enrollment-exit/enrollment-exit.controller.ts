import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { EnrollmentExitService } from './enrollment-exit.service';
import { CancelAdmissionDto, ReactivateDto, WithdrawDto } from './enrollment-exit.dto';

/**
 * Enrollment exit (Decision 11): withdraw an active student (academic + financial settlement) or
 * cancel a pre-active admission (void). Both non-destructive; both over the existing ledger.
 */
@ApiTags('enrollment-exit')
@ApiBearerAuth()
@Controller({ path: 'enrollments', version: '1' })
export class EnrollmentExitController {
  constructor(private readonly service: EnrollmentExitService) {}

  @Post(':id/withdraw')
  @RequirePermissions(Permission.ENROLLMENT_MANAGE)
  @ApiOperation({ summary: 'Withdraw a student (→ WITHDRAWN) and settle remaining unpaid charges' })
  withdraw(@Param('id') id: string, @Body() dto: WithdrawDto) {
    return this.service.withdraw(id, dto);
  }

  @Post(':id/cancel-admission')
  @RequirePermissions(Permission.ENROLLMENT_MANAGE)
  @ApiOperation({
    summary: 'Cancel a pre-active admission — void charges (refused once anything is paid)',
  })
  cancelAdmission(@Param('id') id: string, @Body() dto: CancelAdmissionDto) {
    return this.service.cancelAdmission(id, dto);
  }

  @Post(':id/reactivate')
  @RequirePermissions(Permission.ENROLLMENT_MANAGE)
  @ApiOperation({
    summary: 'Reactivate a withdrawn enrollment (→ ACTIVE) and re-open the cancelled charges',
  })
  reactivate(@Param('id') id: string, @Body() dto: ReactivateDto) {
    return this.service.reactivate(id, dto);
  }
}
