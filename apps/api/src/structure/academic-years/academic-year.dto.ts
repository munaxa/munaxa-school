import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { AcademicYearStatus } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateAcademicYearDto {
  // An Academic Year is a SCHOOL-level entity (Decision 1); the campus that "hosts" the create call is
  // still accepted during the transition and the School is derived from it (campus.schoolId).
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  campusId!: string;

  @ApiProperty({ example: '2025/2026' })
  @IsString()
  @MaxLength(20)
  name!: string;

  @ApiProperty({ example: '2025-09-01', description: 'ISO date' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: '2026-06-30', description: 'ISO date' })
  @IsDateString()
  endDate!: string;

  // Admission/registration window (optional). Independent of the instructional boundaries (Semesters).
  @ApiPropertyOptional({ example: '2025-05-01', description: 'ISO date' })
  @IsOptional()
  @IsDateString()
  registrationStartDate?: string;

  @ApiPropertyOptional({ example: '2025-08-15', description: 'ISO date' })
  @IsOptional()
  @IsDateString()
  registrationEndDate?: string;

  // Lifecycle status (Decision 8). Defaults to UPCOMING. Setting ACTIVE enforces one-ACTIVE-per-school.
  @ApiPropertyOptional({ enum: AcademicYearStatus, default: AcademicYearStatus.UPCOMING })
  @IsOptional()
  @IsEnum(AcademicYearStatus)
  status?: AcademicYearStatus;

  // Deprecated alias for `status === ACTIVE`, kept for backward-compatible callers. When provided it is
  // mapped to `status` (isCurrent === true ⇒ ACTIVE).
  @ApiPropertyOptional({ default: false, deprecated: true })
  @IsOptional()
  @IsBoolean()
  isCurrent?: boolean;
}

export class UpdateAcademicYearDto extends PartialType(CreateAcademicYearDto) {}
