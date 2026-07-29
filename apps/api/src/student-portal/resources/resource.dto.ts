import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ResourceType } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateResourceDto {
  @ApiProperty({ example: 'Algebra revision sheet' })
  @IsString()
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ enum: ResourceType })
  @IsEnum(ResourceType)
  type!: ResourceType;

  @ApiPropertyOptional({ description: 'Section scope (omit + omit gradeId = whole school)' })
  @IsOptional()
  @IsUUID()
  sectionId?: string;

  @ApiPropertyOptional({ description: 'Grade scope' })
  @IsOptional()
  @IsUUID()
  gradeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  subject?: string;

  @ApiPropertyOptional({ description: 'Required for LINK/VIDEO (deep-links out — not an LMS)' })
  @ValidateIf((o: CreateResourceDto) => o.type === 'LINK' || o.type === 'VIDEO')
  @IsUrl()
  @MaxLength(2000)
  url?: string;

  @ApiPropertyOptional({ description: 'Required for FILE/DOCUMENT (from the presign step)' })
  @ValidateIf((o: CreateResourceDto) => o.type === 'FILE' || o.type === 'DOCUMENT')
  @IsString()
  @MaxLength(500)
  fileKey?: string;

  @ApiPropertyOptional()
  @ValidateIf((o: CreateResourceDto) => o.type === 'FILE' || o.type === 'DOCUMENT')
  @IsString()
  @MaxLength(255)
  fileName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  contentType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(104857600)
  size?: number;
}

export class PresignResourceDto {
  @ApiProperty({ example: 'worksheet.pdf' })
  @IsString()
  @MaxLength(255)
  fileName!: string;

  @ApiProperty({ example: 'application/pdf' })
  @IsString()
  @MaxLength(150)
  contentType!: string;
}
