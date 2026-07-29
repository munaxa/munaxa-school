import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentLanguage, DocumentType } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** Generate a finance document for a student. `type` selects the template. */
export class GenerateDocumentDto {
  @ApiProperty({ enum: DocumentType }) @IsEnum(DocumentType) type!: DocumentType;
  @ApiProperty() @IsUUID() studentId!: string;
  @ApiPropertyOptional({ enum: DocumentLanguage })
  @IsOptional()
  @IsEnum(DocumentLanguage)
  language?: DocumentLanguage;

  /** Retained for other academic-year-scoped documents; the tuition certificate uses `year`. */
  @ApiPropertyOptional() @IsOptional() @IsUUID() academicYearId?: string;

  /** Required for ANNUAL_TUITION_CERTIFICATE: the calendar year (1 Jan … 31 Dec) to certify. */
  @ApiPropertyOptional({ example: 2026, description: 'Calendar year for the tuition certificate' })
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  /** Required for PAYMENT_RECEIPT. */
  @ApiPropertyOptional() @IsOptional() @IsUUID() paymentId?: string;
}

/** (Re)generate the registration agreement for an enrollment (creates a new version). */
export class GenerateAgreementDto {
  @ApiProperty() @IsUUID() enrollmentId!: string;
  @ApiPropertyOptional({ enum: DocumentLanguage })
  @IsOptional()
  @IsEnum(DocumentLanguage)
  language?: DocumentLanguage;
}

/** Pre-sign a direct-to-bucket upload for a signed registration agreement (PDF/JPG/PNG). */
export class PresignSignedAgreementDto {
  @ApiProperty({ example: 'signed-agreement.pdf' })
  @IsString()
  @MaxLength(200)
  fileName!: string;

  @ApiProperty({ example: 'application/pdf' })
  @IsString()
  @MaxLength(150)
  contentType!: string;

  @ApiProperty({ example: 512000, description: 'Bytes' })
  @IsInt()
  @Min(1)
  @Max(15728640) // 15 MB
  size!: number;
}

/**
 * Confirm/record a signed registration agreement. Two mutually exclusive paths:
 *  - Direct (default): the file bytes are sent base64-encoded in `fileData` and the API stores them
 *    (to the bucket when S3 is configured, otherwise inline). This avoids any browser→bucket PUT.
 *  - Presigned (legacy): the browser PUT the file straight to storage and echoes back `fileKey`.
 */
export class ConfirmSignedAgreementDto {
  @ApiPropertyOptional({ description: 'The tenant-scoped storage key returned by presign.' })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  fileKey?: string;

  @ApiPropertyOptional({ description: 'Base64-encoded file bytes (API-proxied upload path).' })
  @IsOptional()
  @IsString()
  fileData?: string;

  @ApiProperty({ example: 'signed-agreement.pdf' })
  @IsString()
  @MaxLength(200)
  fileName!: string;

  @ApiProperty({ example: 'application/pdf' })
  @IsString()
  @MaxLength(150)
  contentType!: string;

  @ApiPropertyOptional({ example: 512000, description: 'Bytes' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(15728640)
  size?: number;

  /** Name of the signatory (the parent who signed), recorded by staff. */
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) signedBy?: string;

  /** The date the parent signed (YYYY-MM-DD). Defaults to the upload date. */
  @ApiPropertyOptional() @IsOptional() @IsDateString() signedAt?: string;
}

/**
 * Email a document. With no fields set, it is sent to the student's primary parent. Parent roles can
 * be toggled, and custom addresses / CC / BCC added (custom recipients are permission-controlled by
 * the DOCUMENT_GENERATE requirement on the endpoint).
 */
export class EmailDocumentDto {
  /** Explicit custom recipient addresses (in addition to any selected parent roles). */
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  to?: string[];

  @ApiPropertyOptional({ description: 'Send to the primary parent (default true).' })
  @IsOptional()
  @IsBoolean()
  includePrimaryParent?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() includeSecondaryParent?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() includeGuardian?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  cc?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  bcc?: string[];

  @ApiPropertyOptional() @IsOptional() @IsEmail() replyTo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() subject?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() message?: string;
}
