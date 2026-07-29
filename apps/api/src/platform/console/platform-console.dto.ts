import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  BillingCycle,
  CouponDuration,
  CouponType,
  PaymentProvider,
  PlanTier,
  SubscriptionStatus,
} from '@prisma/client';

/** Directly change a tenant's subscription plan/cycle/status (platform action). */
export class ChangeSubscriptionDto {
  @IsUUID()
  planId!: string;

  @IsOptional()
  @IsEnum(BillingCycle)
  billingCycle?: BillingCycle;

  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  @IsOptional()
  @IsDateString()
  currentPeriodEnd?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class SetSubscriptionStatusDto {
  @IsEnum(SubscriptionStatus)
  status!: SubscriptionStatus;
}

/** Approve or reject an upgrade request. Approval applies the plan change immediately. */
export class DecideUpgradeRequestDto {
  @IsIn(['APPROVE', 'REJECT'])
  decision!: 'APPROVE' | 'REJECT';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  decisionNote?: string;
}

export class StartTrialDto {
  @IsUUID()
  planId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number;
}

export class ExtendTrialDto {
  @IsInt()
  @Min(1)
  @Max(365)
  days!: number;
}

export class EndTrialDto {
  @IsBoolean()
  convert!: boolean;
}

export class SetFeatureOverrideDto {
  @IsString()
  @MaxLength(100)
  key!: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  limitOverride?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class UpsertBillingProfileDto {
  @IsOptional() @IsString() @MaxLength(200) legalName?: string;
  @IsOptional() @IsString() @MaxLength(100) taxId?: string;
  @IsOptional() @IsString() @MaxLength(200) billingEmail?: string;
  @IsOptional() @IsString() @MaxLength(50) billingPhone?: string;
  @IsOptional() @IsString() @MaxLength(200) addressLine1?: string;
  @IsOptional() @IsString() @MaxLength(200) addressLine2?: string;
  @IsOptional() @IsString() @MaxLength(100) city?: string;
  @IsOptional() @IsString() @MaxLength(100) country?: string;
  @IsOptional() @IsEnum(PaymentProvider) provider?: PaymentProvider;
  @IsOptional() @IsString() @MaxLength(200) externalCustomerId?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

export class CreateCouponDto {
  @IsString()
  @MaxLength(50)
  code!: string;

  @IsOptional() @IsString() @MaxLength(200) description?: string;

  @IsEnum(CouponType)
  type!: CouponType;

  @IsOptional() @IsInt() @Min(0) @Max(100) percentOff?: number;
  @IsOptional() @IsInt() @Min(0) amountOff?: number;
  @IsOptional() @IsString() @MaxLength(10) currency?: string;

  @IsOptional() @IsEnum(CouponDuration) duration?: CouponDuration;
  @IsOptional() @IsInt() @Min(1) durationMonths?: number;
  @IsOptional() @IsEnum(PlanTier) appliesToTier?: PlanTier;
  @IsOptional() @IsInt() @Min(1) maxRedemptions?: number;
  @IsOptional() @IsDateString() validFrom?: string;
  @IsOptional() @IsDateString() validUntil?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class SetPlanFeatureDto {
  @IsString() @MaxLength(100) key!: string;
  @IsBoolean() enabled!: boolean;
  @IsOptional() @IsInt() @Min(0) limit?: number;
}

export class AuditQueryDto {
  @IsOptional() @IsUUID() tenantId?: string;
  @IsOptional() @IsString() @MaxLength(100) action?: string;
  @IsOptional() @IsInt() @Min(1) @Max(500) take?: number;
}
