import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { BillingCycle } from '@prisma/client';

/** A school admin requests a plan change. Schools cannot self-serve — this creates a request. */
export class CreateUpgradeRequestDto {
  @IsUUID()
  requestedPlanId!: string;

  @IsOptional()
  @IsIn([BillingCycle.MONTHLY, BillingCycle.YEARLY])
  requestedCycle?: BillingCycle;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
