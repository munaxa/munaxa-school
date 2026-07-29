import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ExceptionType } from '@prisma/client';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateExceptionDto {
  @ApiProperty({ example: '2026-03-15', description: 'The affected date (ISO)' })
  @IsDateString()
  date!: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Section; omit for a school-wide exception' })
  @IsOptional()
  @IsUUID()
  sectionId?: string;

  @ApiPropertyOptional({ example: 3, description: 'Class number; omit for a whole-day exception' })
  @IsOptional()
  @IsInt()
  @Min(1)
  classNumber?: number;

  @ApiProperty({ enum: ExceptionType })
  @IsEnum(ExceptionType)
  type!: ExceptionType;

  @ApiPropertyOptional({ format: 'uuid', description: 'Replacement subject (REPLACEMENT)' })
  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Replacement teacher (REPLACEMENT)' })
  @IsOptional()
  @IsUUID()
  teacherId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Substitute teacher (SUBSTITUTION)' })
  @IsOptional()
  @IsUUID()
  substituteTeacherId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Special location for the overridden lesson',
  })
  @IsOptional()
  @IsUUID()
  locationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
