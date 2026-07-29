import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentPlanCadence } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateChargeDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  studentId!: string;

  @ApiProperty({ example: 'Annual Tuition 2026/27' })
  @IsString()
  @MaxLength(200)
  description!: string;

  @ApiProperty({ example: 3000, description: 'Obligation amount in JOD' })
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Max(100000000)
  amount!: number;

  @ApiPropertyOptional({ example: '2026-09-01' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  // Reporting dimensions (RR-2).
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() academicYearId?: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() gradeId?: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() campusId?: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() feeItemId?: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() enrollmentId?: string;
}

class CustomLineDto {
  @ApiProperty({ example: '2026-09-01' })
  @IsDateString()
  dueDate!: string;

  @ApiProperty({ example: 333.334 })
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  amount!: number;
}

export class CreatePlanDto {
  @ApiProperty({ enum: PaymentPlanCadence, default: PaymentPlanCadence.MONTHLY })
  @IsEnum(PaymentPlanCadence)
  cadence!: PaymentPlanCadence;

  @ApiProperty({ example: 9, description: 'Number of installments (ignored for CUSTOM)' })
  @IsInt()
  @Min(1)
  @Max(60)
  installments!: number;

  @ApiProperty({ example: '2026-09-01', description: 'Due date of the first installment' })
  @IsDateString()
  firstDueDate!: string;

  @ApiPropertyOptional({ description: 'Concentrate the remainder in a larger final installment' })
  @IsOptional()
  @IsBoolean()
  balloonFinal?: boolean;

  @ApiPropertyOptional({ type: [CustomLineDto], description: 'CUSTOM cadence: explicit lines' })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CustomLineDto)
  customLines?: CustomLineDto[];

  @ApiPropertyOptional({ type: [String], description: 'ISO dates to skip (holidays)' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  holidays?: string[];

  @ApiPropertyOptional({
    description:
      'Why the plan is being (re)created — required by the UI for a REPLACE (advanced action). ' +
      'Recorded in the audit log (e.g. hardship, scholarship, recalculation, transfer, correction).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class RescheduleInstallmentDto {
  @ApiPropertyOptional({ example: '2026-10-15' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ example: 350 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(100000000)
  amount?: number;
}
