import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EmployeeDocumentType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** Step 1 — request a presigned upload URL for a document file. */
export class PresignDocumentDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fileName!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(160)
  contentType!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  size?: number;
}

/** Step 2 — confirm the uploaded object and persist the document metadata. */
export class CreateDocumentDto {
  @ApiProperty({ enum: EmployeeDocumentType })
  @IsEnum(EmployeeDocumentType)
  type!: EmployeeDocumentType;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @ApiProperty({ description: 'Server-generated key echoed back from the presign step.' })
  @IsString()
  @MaxLength(500)
  fileKey!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  fileName!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(160)
  contentType!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  size!: number;

  @ApiPropertyOptional({ description: 'Issue date (ISO date).' })
  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @ApiPropertyOptional({ description: 'Expiry date (ISO date) — powers renewal reminders.' })
  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @ApiPropertyOptional({
    description: 'Document id this upload supersedes (creates a new version).',
  })
  @IsOptional()
  @IsUUID()
  supersedesId?: string;
}
