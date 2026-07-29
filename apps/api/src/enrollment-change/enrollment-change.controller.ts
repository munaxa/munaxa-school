import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { EnrollmentChangeService } from './enrollment-change.service';
import { CorrectGradeDto, TransferDto } from './enrollment-change.dto';

/**
 * Reason-first enrollment placement changes. Grade/section/classroom live on the Enrollment (never on
 * the Student). Promotion and Repeat are intentionally absent — they are Year-End Processing
 * operations that create a NEW enrollment.
 */
@ApiTags('enrollment-change')
@ApiBearerAuth()
@Controller({ path: 'enrollments', version: '1' })
export class EnrollmentChangeController {
  constructor(private readonly service: EnrollmentChangeService) {}

  @Patch(':id/transfer')
  @RequirePermissions(Permission.ENROLLMENT_MANAGE)
  @ApiOperation({
    summary: 'Administrative transfer — move to another section within the same grade',
  })
  transfer(@Param('id') id: string, @Body() dto: TransferDto) {
    return this.service.transfer(id, dto);
  }

  @Patch(':id/correct-grade')
  @RequirePermissions(Permission.ENROLLMENT_MANAGE)
  @ApiOperation({
    summary: 'Data-entry grade correction on the current enrollment (no ledger change)',
  })
  correctGrade(@Param('id') id: string, @Body() dto: CorrectGradeDto) {
    return this.service.correctGrade(id, dto);
  }

  @Get(':id/fee-comparison')
  @RequirePermissions(Permission.FINANCE_MANAGE)
  @ApiOperation({
    summary: "Fee impact of the enrollment's current grade vs. what is billed (read-only)",
  })
  feeComparison(@Param('id') id: string) {
    return this.service.feeComparison(id);
  }

  @Post(':id/recalculate-fees')
  @RequirePermissions(Permission.FINANCE_MANAGE)
  @ApiOperation({
    summary: 'Recalculate unpaid tuition for the corrected grade — never touches paid charges',
  })
  recalculateFees(@Param('id') id: string) {
    return this.service.recalculateFees(id);
  }
}
