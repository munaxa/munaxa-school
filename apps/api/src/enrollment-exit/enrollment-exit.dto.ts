import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

/**
 * Withdraw a student from an academic year. Withdrawal is an ACADEMIC event; the financial settlement
 * is applied separately per policy (Decision 11) and never deletes ledger history.
 */
export class WithdrawDto {
  @ApiPropertyOptional({
    description: 'Reason for the withdrawal (kept on the enrollment + audit).',
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({
    default: true,
    description:
      'Cancel the remaining (unpaid) tuition/other charges. Paid amounts are always kept.',
  })
  @IsOptional()
  @IsBoolean()
  cancelUnpaidCharges?: boolean;

  @ApiPropertyOptional({
    default: true,
    description: 'Keep the one-time registration fee (do not cancel it) even if still unpaid.',
  })
  @IsOptional()
  @IsBoolean()
  keepRegistrationFee?: boolean;
}

/** Cancel an admission BEFORE it is active — voids charges, never deletes history (Decision 11). */
export class CancelAdmissionDto {
  @ApiPropertyOptional() @IsOptional() @IsString() reason?: string;
}

/**
 * Reactivate (reverse) a WITHDRAWN enrollment back to ACTIVE for the same year — an operational
 * correction. Re-opens the charges that the withdrawal cancelled; paid amounts are untouched.
 */
export class ReactivateDto {
  @ApiPropertyOptional({ description: 'Reason for reactivating (kept on the enrollment + audit).' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({
    default: true,
    description: 'Re-open the charges cancelled at withdrawal (paid amounts are always kept).',
  })
  @IsOptional()
  @IsBoolean()
  reopenCharges?: boolean;
}
