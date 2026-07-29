import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { DiscountCalc, DiscountType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

// ── Grade fee schedule (registration + annual tuition, per grade × academic year) ──
export class CreateGradeFeeScheduleDto {
  @ApiProperty() @IsUUID() gradeId!: string;
  @ApiProperty() @IsUUID() academicYearId!: string;

  @ApiProperty({ example: 50, description: 'Registration fee (JOD)' })
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(100000000)
  registrationFee!: number;

  @ApiProperty({ example: 1800, description: 'Annual tuition (JOD)' })
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(100000000)
  tuitionFee!: number;

  @ApiProperty({ example: '2026-09-01', description: 'Effective-from (ISO date)' })
  @IsString()
  effectiveFrom!: string;

  @ApiPropertyOptional({ example: '2027-08-31' })
  @IsOptional()
  @IsString()
  effectiveTo?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
export class UpdateGradeFeeScheduleDto extends PartialType(CreateGradeFeeScheduleDto) {}

// ── Transport fare (one per academic year × fleet route; two-way total + one-way %) ──
export class CreateTransportFareDto {
  @ApiProperty() @IsUUID() academicYearId!: string;

  @ApiPropertyOptional({ description: 'Existing fleet route to attach the fare to.' })
  @IsOptional()
  @IsUUID()
  routeId?: string;

  @ApiPropertyOptional({
    example: 'A,B,C',
    description:
      'Route name to attach by. Reused if it already exists in the fleet, otherwise created. ' +
      'Ignored when routeId is given.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  routeName?: string;

  @ApiProperty({ example: 300, description: 'Annual two-way (round trip) transport fee (JOD)' })
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(100000000)
  amount!: number;

  @ApiProperty({
    example: 70,
    description: 'One-way price as a percentage of the two-way total (0–100).',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  oneWayPct!: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
export class UpdateTransportFareDto extends PartialType(CreateTransportFareDto) {}

// ── Discount rule ──
export class CreateDiscountRuleDto {
  @ApiProperty({ example: 'Full payment 5%' }) @IsString() @MaxLength(150) name!: string;
  @ApiProperty({ enum: DiscountType }) @IsEnum(DiscountType) type!: DiscountType;
  @ApiProperty({ enum: DiscountCalc }) @IsEnum(DiscountCalc) calc!: DiscountCalc;

  @ApiProperty({ example: 5, description: 'Percent (0–100) or fixed JOD' })
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  value!: number;

  @ApiPropertyOptional({ description: 'Cap for percentage discounts (JOD)' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  maxAmount?: number;

  @ApiPropertyOptional({ default: false, description: 'Whether the discount applies to transport' })
  @IsOptional()
  @IsBoolean()
  appliesToTransport?: boolean;

  @ApiPropertyOptional({ example: '2026-06-01' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-09-30' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
export class UpdateDiscountRuleDto extends PartialType(CreateDiscountRuleDto) {}

// ── Apply a configured discount rule to a student's charge (records a FeeAdjustment) ──
export class ApplyDiscountRuleDto {
  @ApiProperty() @IsUUID() studentId!: string;
  @ApiProperty() @IsUUID() chargeId!: string;
}

// ── Billing policy (tenant singleton) ──
export class UpsertBillingPolicyDto {
  @ApiProperty({ example: 1 }) @IsInt() @Min(1) @Max(24) minInstallments!: number;
  @ApiProperty({ example: 9 }) @IsInt() @Min(1) @Max(24) maxInstallments!: number;

  @ApiProperty({ example: 5, description: 'Full-payment discount (%)' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  fullPaymentDiscountPct!: number;

  @ApiProperty({
    example: 2,
    description: 'Suspend transport after this many overdue installments',
  })
  @IsInt()
  @Min(1)
  @Max(99)
  suspendTransportAfterOverdue!: number;

  @ApiPropertyOptional({
    example: 60,
    description: 'Also suspend once the oldest overdue installment is aged beyond this many days',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  suspendTransportAfterDays?: number;

  @ApiPropertyOptional({
    example: 1000,
    description: 'Also suspend once the overdue amount reaches this (JOD)',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  suspendTransportAfterAmount?: number;

  @ApiProperty({
    required: false,
    description:
      'Allow the user who applied a fee modification to also approve it. When false (default), approval requires a different user.',
  })
  @IsOptional()
  @IsBoolean()
  allowSelfFeeApproval?: boolean;
}
