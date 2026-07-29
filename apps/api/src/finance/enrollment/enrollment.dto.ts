import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransportDirection } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

/**
 * Enrollment fee quote request. Pure calculation (no writes) — composes the configuration
 * layer (GradeFeeSchedule + TransportFare + DiscountRule + BillingPolicy) into the spec formula:
 *   final = (tuition − tuitionDiscount) + registration + transport
 * Transportation and registration are never discounted by the full-payment rule.
 */
export class QuoteDto {
  @ApiProperty() @IsUUID() gradeId!: string;
  @ApiProperty() @IsUUID() academicYearId!: string;

  @ApiPropertyOptional({ enum: TransportDirection, default: TransportDirection.NONE })
  @IsOptional()
  @IsEnum(TransportDirection)
  transportDirection?: TransportDirection;

  @ApiPropertyOptional({
    example: 'A,B,C',
    description: 'Route group to price transport against (must match a configured fare).',
  })
  @IsOptional()
  @IsString()
  transportRouteGroup?: string;

  @ApiPropertyOptional({
    default: false,
    description: 'Pay annual tuition in full (applies full-payment discount)',
  })
  @IsOptional()
  @IsBoolean()
  fullPayment?: boolean;

  @ApiPropertyOptional({
    default: 1,
    description: 'Installment count (ignored when fullPayment=true)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24)
  installments?: number;

  @ApiPropertyOptional({ example: '2026-09-01', description: 'First installment due date (ISO)' })
  @IsOptional()
  @IsString()
  firstDueDate?: string;
}
