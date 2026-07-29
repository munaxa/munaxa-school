import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateHomeworkDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  sectionId!: string;

  @ApiProperty({ example: 'Mathematics' })
  @IsString()
  @MaxLength(120)
  subject!: string;

  @ApiProperty({ example: 'Chapter 3 exercises' })
  @IsString()
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ example: '2025-09-14' })
  @IsDateString()
  dueDate!: string;
}

export class UpdateHomeworkDto extends PartialType(CreateHomeworkDto) {}

export class PresignAttachmentDto {
  @ApiProperty({ example: 'worksheet.pdf' })
  @IsString()
  @MaxLength(200)
  fileName!: string;

  @ApiProperty({ example: 'application/pdf' })
  @IsString()
  @MaxLength(150)
  contentType!: string;

  @ApiProperty({ example: 102400, description: 'Bytes' })
  @IsInt()
  @Min(1)
  @Max(26214400) // 25 MB
  size!: number;
}

export class ConfirmAttachmentDto extends PresignAttachmentDto {
  @ApiProperty({ description: 'The fileKey returned from the presign step' })
  @IsString()
  @MaxLength(400)
  fileKey!: string;
}
