import { ApiProperty } from '@nestjs/swagger';
import { DocumentCategory } from '@prisma/client';
import { IsEnum, IsInt, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class PresignDocumentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  studentId!: string;

  @ApiProperty({ example: 'term-1-report.pdf' })
  @IsString()
  @MaxLength(255)
  fileName!: string;

  @ApiProperty({ example: 'application/pdf' })
  @IsString()
  @MaxLength(150)
  contentType!: string;
}

export class ConfirmDocumentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  studentId!: string;

  @ApiProperty({ example: 'Term 1 Report Card' })
  @IsString()
  @MaxLength(255)
  title!: string;

  @ApiProperty({ enum: DocumentCategory })
  @IsEnum(DocumentCategory)
  category!: DocumentCategory;

  @ApiProperty({ description: 'fileKey returned by the presign step' })
  @IsString()
  @MaxLength(500)
  fileKey!: string;

  @ApiProperty({ example: 'term-1-report.pdf' })
  @IsString()
  @MaxLength(255)
  fileName!: string;

  @ApiProperty({ example: 'application/pdf' })
  @IsString()
  @MaxLength(150)
  contentType!: string;

  @ApiProperty({ example: 482190, description: 'Size in bytes' })
  @IsInt()
  @Min(0)
  @Max(52428800)
  size!: number;
}
