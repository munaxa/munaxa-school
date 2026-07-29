import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { DependentRelation, Gender } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateEmergencyContactDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(60) relation!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(40) phone!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) phoneAlt?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160) email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) address?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isPrimary?: boolean;
}
export class UpdateEmergencyContactDto extends PartialType(CreateEmergencyContactDto) {}

export class CreateDependentDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @ApiProperty({ enum: DependentRelation }) @IsEnum(DependentRelation) relation!: DependentRelation;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dateOfBirth?: string;
  @ApiPropertyOptional({ enum: Gender }) @IsOptional() @IsEnum(Gender) gender?: Gender;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) nationalId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) notes?: string;
}
export class UpdateDependentDto extends PartialType(CreateDependentDto) {}

export class CreateEducationDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(160) institution!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(120) degree!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) fieldOfStudy?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1900) @Max(2200) startYear?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1900) @Max(2200) endYear?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) grade?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) notes?: string;
}
export class UpdateEducationDto extends PartialType(CreateEducationDto) {}

export class CreateCertificateDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(160) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160) issuingBody?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() issueDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() expiryDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) credentialId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() documentId?: string;
}
export class UpdateCertificateDto extends PartialType(CreateCertificateDto) {}

export class CreateBankAccountDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(120) bankName!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) accountName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) accountNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) iban?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) swift?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(8) currency?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isPrimary?: boolean;
}
export class UpdateBankAccountDto extends PartialType(CreateBankAccountDto) {}
