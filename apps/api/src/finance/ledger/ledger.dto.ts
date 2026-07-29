import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdjustmentType, PaymentMethod } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class ApplyAdjustmentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  studentId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Charge to reduce; omit for an account-level credit memo',
  })
  @IsOptional()
  @IsUUID()
  chargeId?: string;

  @ApiProperty({ enum: AdjustmentType })
  @IsEnum(AdjustmentType)
  type!: AdjustmentType;

  @ApiPropertyOptional({
    example: 150,
    description: 'Fixed reduction in JOD (use this OR percent)',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Max(100000000)
  amount?: number;

  @ApiPropertyOptional({
    example: 25,
    description: 'Percent of the charge net (requires chargeId)',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100)
  percent?: number;

  @ApiProperty({ example: 'Sibling discount — 2 children' })
  @IsString()
  @MaxLength(300)
  reason!: string;
}

class AllocationLineDto {
  @ApiProperty({ format: 'uuid', description: 'The installment being settled' })
  @IsUUID()
  installmentId!: string;

  @ApiProperty({ example: 250 })
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  amount!: number;
}

export class AllocatePaymentDto {
  @ApiProperty({ format: 'uuid', description: 'The verified payment to allocate' })
  @IsUUID()
  paymentId!: string;

  @ApiProperty({ type: [AllocationLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AllocationLineDto)
  allocations!: AllocationLineDto[];
}

export class CreateRefundDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  studentId!: string;

  @ApiProperty({ example: 100, description: 'Must not exceed the available credit balance' })
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Max(100000000)
  amount!: number;

  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;

  @ApiProperty({ example: 'Overpayment returned at year end' })
  @IsString()
  @MaxLength(300)
  reason!: string;
}

export class RejectDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}
