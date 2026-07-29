import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { BillingResponsibilityReason } from '@prisma/client';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { FinancialAccountService } from './financial-account.service';
import { StatementService } from '../statement/statement.service';

/** Explicit billing transfer — move a student's Financial Account to another linked guardian. */
export class TransferBillingDto {
  @ApiProperty() @IsUUID() studentId!: string;
  @ApiProperty() @IsUUID() toParentId!: string;
  // A reason is mandatory — years later, finance must know WHY the legal payer changed.
  @ApiProperty({ enum: BillingResponsibilityReason })
  @IsEnum(BillingResponsibilityReason)
  reason!: BillingResponsibilityReason;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

/**
 * Family Finance — the financial customer (FinancialAccount) is the primary entity. Search is
 * family-first; selecting a family opens the dashboard (family totals by default, with the children).
 */
@ApiTags('finance')
@ApiBearerAuth()
@Controller({ path: 'finance/families', version: '1' })
export class FinancialAccountController {
  constructor(
    private readonly service: FinancialAccountService,
    private readonly statements: StatementService,
  ) {}

  @Get('search')
  @RequirePermissions(Permission.FINANCE_READ)
  @ApiOperation({
    summary:
      'Search families by guardian / father / mother / family name / phone / national id / student',
  })
  @ApiQuery({ name: 'q', required: true })
  search(@Query('q') q: string) {
    return this.service.search(q ?? '');
  }

  @Get('by-parent/:parentId')
  @RequirePermissions(Permission.FINANCE_READ)
  @ApiOperation({ summary: 'The active financial account for a guardian + its students (or null)' })
  byParent(@Param('parentId') parentId: string) {
    return this.service.byParent(parentId);
  }

  @Post('transfer-billing')
  @RequirePermissions(Permission.FINANCE_TRANSFER_BILLING)
  @ApiOperation({
    summary: "Move a student's billing to another linked guardian (explicit; carries the ledger)",
  })
  transferBilling(@Body() dto: TransferBillingDto) {
    return this.service.transferBilling(dto.studentId, dto.toParentId, dto.reason, dto.notes);
  }

  @Get('dashboard')
  @RequirePermissions(Permission.FINANCE_READ)
  @ApiOperation({
    summary:
      'Account-centric finance overview (workspace dashboard): KPIs, largest-outstanding accounts, ' +
      'recent payments, upcoming installments',
  })
  overview() {
    return this.service.overview();
  }

  @Get('by-student/:studentId')
  @RequirePermissions(Permission.FINANCE_READ)
  @ApiOperation({ summary: 'Resolve a student to their Financial Account (for "Open in finance")' })
  byStudent(@Param('studentId') studentId: string) {
    return this.service.byStudent(studentId);
  }

  @Get(':id')
  @RequirePermissions(Permission.FINANCE_READ)
  @ApiOperation({
    summary: 'Family Finance Dashboard: account header, family totals (KPIs), children',
  })
  dashboard(@Param('id') id: string) {
    return this.service.dashboard(id);
  }

  @Get(':id/schedule')
  @RequirePermissions(Permission.FINANCE_READ)
  @ApiOperation({
    summary:
      'Account Billing Schedule: the single, dynamically merged installment plan (rows by due date, ' +
      'each expandable into per-student / per-fee lines)',
  })
  schedule(@Param('id') id: string) {
    return this.service.billingSchedule(id);
  }

  @Get(':id/statement')
  @RequirePermissions(Permission.FINANCE_READ)
  @ApiOperation({ summary: 'Family statement: family totals + each child’s per-student totals' })
  statement(@Param('id') id: string) {
    return this.statements.forFamily(id);
  }
}
