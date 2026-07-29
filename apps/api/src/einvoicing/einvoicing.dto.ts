import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  EInvoiceDocStatus,
  EInvoiceEnvironment,
  EInvoicePaymentKind,
  EInvoiceTaxpayerType,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/** Wizard steps 1/2/4/5/6 — everything is per-tenant DB config; nothing hardcoded. */
export class UpdateSettingsDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() enabled?: boolean;
  @ApiPropertyOptional({ enum: EInvoiceEnvironment })
  @IsOptional()
  @IsEnum(EInvoiceEnvironment)
  environment?: EInvoiceEnvironment;
  @ApiPropertyOptional() @IsOptional() @IsUrl({ require_tld: false }) endpointUrl?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) legalNameEn?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) legalNameAr?: string;
  @ApiPropertyOptional({ description: 'TIN — digits only' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  taxNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) vatNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) commercialRegistration?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) addressLine?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;

  @ApiPropertyOptional({ enum: EInvoiceTaxpayerType })
  @IsOptional()
  @IsEnum(EInvoiceTaxpayerType)
  taxpayerType?: EInvoiceTaxpayerType;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() vatEnabled?: boolean;
  @ApiPropertyOptional({ example: 16 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  vatPercent?: number;
  @ApiPropertyOptional({ description: 'JoFotara: Z=exempt, O=zero-rated, S=standard' })
  @IsOptional()
  @IsIn(['Z', 'O', 'S'])
  defaultTaxCategory?: string;
  @ApiPropertyOptional({ enum: EInvoicePaymentKind })
  @IsOptional()
  @IsEnum(EInvoicePaymentKind)
  defaultPaymentKind?: EInvoicePaymentKind;

  @ApiPropertyOptional({ description: 'Auto-issue a JoFotara invoice when a fee charge is raised' })
  @IsOptional()
  @IsBoolean()
  autoIssueOnCharge?: boolean;

  @ApiPropertyOptional({
    description: 'Auto-issue a 381 credit note when an invoiced charge is reduced',
  })
  @IsOptional()
  @IsBoolean()
  autoCreditOnAdjustment?: boolean;

  @ApiPropertyOptional({ description: 'Fee-category → item naming (mapping engine)' })
  @IsOptional()
  @IsObject()
  fieldMappings?: Record<string, unknown>;
  @ApiPropertyOptional({ description: 'PDF/print template options (logo, AR/EN/bilingual…)' })
  @IsOptional()
  @IsObject()
  templateConfig?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Highest completed wizard step (resume / Save draft)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(7)
  completedSteps?: number;
}

/** Wizard step 3 — device registration. The secret is write-only (masked on reads). */
export class SaveCredentialsDto {
  @ApiProperty() @IsString() @MaxLength(120) clientId!: string;
  @ApiProperty({ description: 'Write-only — stored AES-256-GCM encrypted' })
  @IsString()
  @MaxLength(500)
  secret!: string;
  @ApiProperty({ description: 'تسلسل مصدر الدخل — the registered activity number' })
  @IsString()
  @MaxLength(40)
  incomeSourceSequence!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) deviceLabel?: string;
}

export class InvoiceLineDto {
  @ApiProperty({ example: 'Tuition — Term 1 | رسوم دراسية' })
  @IsString()
  @MaxLength(300)
  name!: string;
  @ApiProperty({ example: 1 }) @IsNumber({ maxDecimalPlaces: 3 }) @Min(0.001) quantity!: number;
  @ApiProperty({ example: 750 }) @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) unitPrice!: number;
  @ApiPropertyOptional({ description: 'Per-line discount (document-level discounts are rejected)' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  discount?: number;
  @ApiPropertyOptional({ description: 'JoFotara: Z=exempt, O=zero-rated, S=standard' })
  @IsOptional()
  @IsIn(['Z', 'O', 'S'])
  taxCategory?: 'Z' | 'O' | 'S';
  @ApiPropertyOptional({ example: 16 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  taxPercent?: number;
}

export class CreateInvoiceDto {
  @ApiProperty({ example: 'INV-2026-0001' }) @IsString() @MaxLength(60) invoiceNumber!: string;
  @ApiPropertyOptional({ enum: EInvoicePaymentKind })
  @IsOptional()
  @IsEnum(EInvoicePaymentKind)
  paymentKind?: EInvoicePaymentKind;

  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() chargeId?: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() paymentId?: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() studentId?: string;

  @ApiPropertyOptional({ description: 'Mandatory for receivable / cash > 10,000 JOD' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  buyerName?: string;
  @ApiPropertyOptional({ description: 'TN | NIN | PN' })
  @IsOptional()
  @IsIn(['TN', 'NIN', 'PN'])
  buyerIdScheme?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) buyerIdValue?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) buyerPhone?: string;
  @ApiPropertyOptional({ example: 'JO-AM' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  buyerCity?: string;

  @ApiProperty({ type: [InvoiceLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineDto)
  lines!: InvoiceLineDto[];
}

export class CreateCreditNoteDto {
  @ApiProperty({ example: 'CN-2026-0001' }) @IsString() @MaxLength(60) invoiceNumber!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() originalDocumentId!: string;
  @ApiProperty({ description: 'Return reason — mandatory (UBL InstructionNote)' })
  @IsString()
  @MaxLength(500)
  reason!: string;
  @ApiProperty({
    type: [InvoiceLineDto],
    description: 'Returns are on quantities only, ≤ original',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineDto)
  lines!: InvoiceLineDto[];
}

export class ListDocumentsQueryDto {
  @ApiPropertyOptional({ enum: EInvoiceDocStatus })
  @IsOptional()
  @IsEnum(EInvoiceDocStatus)
  status?: EInvoiceDocStatus;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) take?: number;
}
