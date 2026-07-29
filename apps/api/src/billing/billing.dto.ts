import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { BillingPaymentStatus, PaymentProvider } from '@prisma/client';

export class InvoiceLineDto {
  @IsString() @MaxLength(300) description!: string;
  @IsInt() @Min(1) quantity!: number;
  @IsInt() unitAmount!: number;
}

export class CreateInvoiceDto {
  @IsString() @MaxLength(50) number!: string;
  @IsOptional() @IsString() @MaxLength(10) currency?: string;
  @IsOptional() @IsString() @MaxLength(2) countryCode?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineDto)
  lines!: InvoiceLineDto[];

  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsDateString() periodStart?: string;
  @IsOptional() @IsDateString() periodEnd?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

export class RecordPaymentDto {
  @IsOptional() @IsUUID() invoiceId?: string;
  @IsEnum(PaymentProvider) provider!: PaymentProvider;
  @IsInt() @Min(0) amount!: number;
  @IsOptional() @IsString() @MaxLength(10) currency?: string;
  @IsEnum(BillingPaymentStatus) status!: BillingPaymentStatus;
  @IsOptional() @IsString() @MaxLength(200) externalRef?: string;
  @IsOptional() @IsString() @MaxLength(500) failureReason?: string;
}

export class CreateRefundDto {
  @IsUUID() paymentId!: string;
  @IsInt() @Min(0) amount!: number;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class AddPaymentMethodDto {
  @IsEnum(PaymentProvider) provider!: PaymentProvider;
  @IsOptional() @IsString() @MaxLength(50) brand?: string;
  @IsOptional() @IsString() @MaxLength(4) last4?: string;
  @IsOptional() @IsInt() expMonth?: number;
  @IsOptional() @IsInt() expYear?: number;
  @IsOptional() @IsString() @MaxLength(200) externalRef?: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}

export class AddBillingContactDto {
  @IsString() @MaxLength(200) name!: string;
  @IsString() @MaxLength(200) email!: string;
  @IsOptional() @IsString() @MaxLength(50) phone?: string;
  @IsOptional() @IsString() @MaxLength(100) role?: string;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
}
