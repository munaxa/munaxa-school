import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { YearEndAction } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

/** Open a Year-End run: from the closing (source) year into the next (target) year. */
export class OpenYearEndDto {
  @ApiProperty({ description: 'The closing (source) Academic Year being processed.' })
  @IsUUID()
  sourceAcademicYearId!: string;

  @ApiProperty({ description: 'The next (target) Academic Year students are promoted into.' })
  @IsUUID()
  targetAcademicYearId!: string;
}

/**
 * Draft a per-student decision (preview only — creates NO enrollment/finance). For PROMOTE/REPEAT the
 * administrator MUST assign the target grade; section/classroom are assigned here too and are NEVER
 * auto-copied from the previous year (Decision 10).
 */
export class SetDecisionDto {
  @ApiProperty({ enum: YearEndAction })
  @IsEnum(YearEndAction)
  action!: YearEndAction;

  @ApiPropertyOptional({ description: 'Target grade (required for PROMOTE/REPEAT).' })
  @IsOptional()
  @IsUUID()
  targetGradeId?: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID() targetSectionId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() targetClassroomId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() reason?: string;
}
