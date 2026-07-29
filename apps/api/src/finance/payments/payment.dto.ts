import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
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

export class CreatePaymentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  studentId!: string;

  @ApiProperty({ example: 750, description: 'Amount received in JOD' })
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Max(100000000)
  amount!: number;

  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @ApiPropertyOptional({ description: 'CliQ reference / e-wallet transfer id' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  reference?: string;

  @ApiPropertyOptional({ description: 'S3 key of an uploaded receipt (from presign)' })
  @IsOptional()
  @IsString()
  @MaxLength(400)
  receiptKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

/**
 * Record a single family/customer payment against a FinancialAccount. The money is recorded once and
 * the allocation engine distributes it across the account's students' open installments on verify
 * (cross-student FIFO). No studentId — the payment belongs to the financial account, not one child.
 */
/** One manual allocation line: assign part of the payment to a specific account installment. */
export class ManualAllocationLineDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  installmentId!: string;

  @ApiProperty({ example: 250, description: 'Amount to apply to this installment (JOD)' })
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Max(100000000)
  amount!: number;
}

export class CreateFinancialAccountPaymentDto {
  @ApiProperty({ example: 700, description: 'Amount received in JOD' })
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Max(100000000)
  amount!: number;

  /**
   * Optional MANUAL allocation. When present, the payment is verified and applied to exactly these
   * installments (residue → account credit) instead of the automatic cross-student FIFO. Each target
   * must be one of the account's own open installments.
   */
  @ApiPropertyOptional({ type: [ManualAllocationLineDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ManualAllocationLineDto)
  allocations?: ManualAllocationLineDto[];

  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @ApiPropertyOptional({ description: 'CliQ reference / e-wallet transfer id' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  reference?: string;

  @ApiPropertyOptional({ description: 'S3 key of an uploaded receipt (from presign)' })
  @IsOptional()
  @IsString()
  @MaxLength(400)
  receiptKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class PresignReceiptDto {
  @ApiProperty({ example: 'receipt.jpg' })
  @IsString()
  @MaxLength(200)
  fileName!: string;

  @ApiProperty({ example: 'image/jpeg' })
  @IsString()
  @MaxLength(150)
  contentType!: string;

  @ApiProperty({ example: 204800, description: 'Bytes' })
  @IsInt()
  @Min(1)
  @Max(15728640) // 15 MB
  size!: number;
}

export class RejectPaymentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}
