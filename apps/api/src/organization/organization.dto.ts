import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { OrganizationSchoolType } from '@prisma/client';

/** Horizontal alignment shared by header/footer text. */
export type HAlign = 'LEFT' | 'CENTER' | 'RIGHT';
const ALIGNMENTS: HAlign[] = ['LEFT', 'CENTER', 'RIGHT'];

/** Asset slots that can hold an uploaded object key. */
export const ASSET_SLOTS = [
  'logo',
  'darkLogo',
  'smallLogo',
  'stamp',
  'signature',
  'banner',
  'pushIcon',
  'notificationImage',
] as const;
export type AssetSlot = (typeof ASSET_SLOTS)[number];

// ── General ────────────────────────────────────────────────────────────────
export class UpdateGeneralDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) nameEn?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) nameAr?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) legalName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) shortName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) schoolCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) ministryNumber?: string;
  @ApiPropertyOptional({ enum: OrganizationSchoolType })
  @IsOptional()
  @IsEnum(OrganizationSchoolType)
  schoolType?: OrganizationSchoolType;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) motto?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) mission?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) vision?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1800)
  @Max(2200)
  establishedYear?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) timezone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10) defaultLanguage?: string;
}

// ── Contact ────────────────────────────────────────────────────────────────
export class UpdateContactDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) mobile?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) whatsapp?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) website?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) country?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) district?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) street?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) building?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) postalCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) googleMapsUrl?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-90)
  @Max(90)
  latitude?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-180)
  @Max(180)
  longitude?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) emergencyContact?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) officeHours?: string;
}

// ── Branding ───────────────────────────────────────────────────────────────
export class LogoVisibilityDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() reports?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() certificates?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() studentCards?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() parentPortal?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() mobileApp?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() login?: boolean;
}

export type WatermarkSource = 'LOGO' | 'SCHOOL_NAME' | 'CONFIDENTIAL';

export class WatermarkDto {
  @ApiPropertyOptional({ enum: ['LOGO', 'SCHOOL_NAME', 'CONFIDENTIAL'] })
  @IsOptional()
  @IsEnum(['LOGO', 'SCHOOL_NAME', 'CONFIDENTIAL'])
  source?: WatermarkSource;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) text?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(1) opacity?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0.1) @Max(5) scale?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(-180) @Max(180) rotation?: number;
}

export class UpdateBrandingDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() logoEnabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() darkLogoEnabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() smallLogoEnabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() watermarkEnabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() stampEnabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() signatureEnabled?: boolean;

  @ApiPropertyOptional({ type: LogoVisibilityDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LogoVisibilityDto)
  logoVisibility?: LogoVisibilityDto;

  @ApiPropertyOptional({ type: WatermarkDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => WatermarkDto)
  watermark?: WatermarkDto;

  @ApiPropertyOptional({ enum: ALIGNMENTS })
  @IsOptional()
  @IsEnum(ALIGNMENTS)
  stampPlacement?: HAlign;

  @ApiPropertyOptional({ enum: ALIGNMENTS })
  @IsOptional()
  @IsEnum(ALIGNMENTS)
  signaturePosition?: HAlign;
}

// ── Documents ──────────────────────────────────────────────────────────────
export type PaperSize = 'A4' | 'LETTER' | 'LEGAL';
export type QrContent = 'DOCUMENT_NUMBER' | 'STUDENT_NUMBER' | 'VERIFICATION_URL' | 'CUSTOM_TEXT';

export class DocumentMarginsDto {
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(200) top?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(200) bottom?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(200) left?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(200) right?: number;
}

export class DocumentConfigDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(8000) headerHtml?: string;
  @ApiPropertyOptional({ enum: ALIGNMENTS })
  @IsOptional()
  @IsEnum(ALIGNMENTS)
  headerAlign?: HAlign;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(8000) footerHtml?: string;
  @ApiPropertyOptional({ enum: ALIGNMENTS })
  @IsOptional()
  @IsEnum(ALIGNMENTS)
  footerAlign?: HAlign;
  @ApiPropertyOptional({ enum: ALIGNMENTS })
  @IsOptional()
  @IsEnum(ALIGNMENTS)
  logoPosition?: HAlign;
  @ApiPropertyOptional({ enum: ['A4', 'LETTER', 'LEGAL'] })
  @IsOptional()
  @IsEnum(['A4', 'LETTER', 'LEGAL'])
  paperSize?: PaperSize;
  @ApiPropertyOptional({ type: DocumentMarginsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DocumentMarginsDto)
  margins?: DocumentMarginsDto;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(400) headerHeight?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(400) footerHeight?: number;
  @ApiPropertyOptional({
    enum: ['DOCUMENT_NUMBER', 'STUDENT_NUMBER', 'VERIFICATION_URL', 'CUSTOM_TEXT'],
  })
  @IsOptional()
  @IsEnum(['DOCUMENT_NUMBER', 'STUDENT_NUMBER', 'VERIFICATION_URL', 'CUSTOM_TEXT'])
  qrContent?: QrContent;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) qrCustomText?: string;
}

export class UpdateDocumentsDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() headerEnabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() footerEnabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() qrEnabled?: boolean;
  @ApiPropertyOptional({ type: DocumentConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DocumentConfigDto)
  documents?: DocumentConfigDto;
}

// ── Communication ──────────────────────────────────────────────────────────
export class UpdateCommunicationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) senderName?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() senderEmail?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() replyToEmail?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) emailFooter?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) notificationDisplayName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) smsSender?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) whatsappDisplayName?: string;
}

// ── Social & website ───────────────────────────────────────────────────────
export class SocialLinksDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) website?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) facebook?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) instagram?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) linkedin?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) youtube?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) tiktok?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) x?: string;
}

export class UpdateSocialDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() socialEnabled?: boolean;
  @ApiPropertyOptional({ type: SocialLinksDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SocialLinksDto)
  social?: SocialLinksDto;
}

// ── Academic identity ──────────────────────────────────────────────────────
export class UpdateAcademicDto {
  @ApiPropertyOptional({ enum: OrganizationSchoolType })
  @IsOptional()
  @IsEnum(OrganizationSchoolType)
  schoolType?: OrganizationSchoolType;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) curriculum?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) motto?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) mission?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) vision?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) academicYearFormat?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) colorTheme?: string;
}

// ── Compliance ─────────────────────────────────────────────────────────────
export class GovIdDto {
  @ApiProperty() @IsString() @MaxLength(120) label!: string;
  @ApiProperty() @IsString() @MaxLength(200) value!: string;
}

export class UpdateComplianceDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() complianceEnabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) legalName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) commercialRegistration?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) licenseNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) ministryLicense?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) taxNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) vatNumber?: string;
  @ApiPropertyOptional({ type: [GovIdDto] })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => GovIdDto)
  otherGovIds?: GovIdDto[];
}

// ── Advanced ───────────────────────────────────────────────────────────────
export type LogoVariant = 'PRIMARY' | 'DARK' | 'SMALL';

export class UpdateAdvancedDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10) defaultReportLanguage?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10)
  defaultCertificateLanguage?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) documentNumberPrefix?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) defaultFont?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) defaultReportTheme?: string;
  @ApiPropertyOptional({ enum: ['PRIMARY', 'DARK', 'SMALL'] })
  @IsOptional()
  @IsEnum(['PRIMARY', 'DARK', 'SMALL'])
  defaultLogoVariant?: LogoVariant;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() documentCompression?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(10) @Max(100) pdfQuality?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(10) @Max(100) imageQuality?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() storageOptimization?: boolean;
}

// ── Asset uploads ──────────────────────────────────────────────────────────
export class PresignAssetDto {
  @ApiProperty({ enum: ASSET_SLOTS })
  @IsEnum(ASSET_SLOTS)
  slot!: AssetSlot;

  @ApiProperty({ example: 'logo.svg' })
  @IsString()
  @MaxLength(200)
  fileName!: string;

  @ApiProperty({ example: 'image/svg+xml' })
  @IsString()
  @MaxLength(120)
  contentType!: string;

  @ApiPropertyOptional({ example: 524288 })
  @IsOptional()
  @IsInt()
  @Min(0)
  size?: number;
}

export class ConfirmAssetDto {
  @ApiProperty({ enum: ASSET_SLOTS })
  @IsEnum(ASSET_SLOTS)
  slot!: AssetSlot;

  @ApiProperty({ example: 'tenants/<id>/organization/<uuid>-logo.svg' })
  @IsString()
  @MaxLength(500)
  fileKey!: string;

  @ApiProperty({ example: 'image/svg+xml' })
  @IsString()
  @MaxLength(120)
  contentType!: string;

  @ApiPropertyOptional({ example: 524288 })
  @IsOptional()
  @IsInt()
  @Min(0)
  size?: number;
}
