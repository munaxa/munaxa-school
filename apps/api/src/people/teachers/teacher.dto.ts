import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EmploymentStatus } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

/**
 * A teacher is not created here — the teaching facet is opened in HR, on the employee. What is
 * left is the academic detail a scheduler edits: the specialization shown in the directory and
 * the subjects the teacher instructs.
 */
export class UpdateTeacherDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  specialization?: string;

  @ApiPropertyOptional({ enum: EmploymentStatus })
  @IsOptional()
  @IsEnum(EmploymentStatus)
  status?: EmploymentStatus;

  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    description: 'Subjects this teacher instructs; replaces the current set.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID(undefined, { each: true })
  subjectIds?: string[];
}

export class AssignSectionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  sectionId!: string;

  @ApiPropertyOptional({ example: 'Mathematics' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  subject?: string;
}
