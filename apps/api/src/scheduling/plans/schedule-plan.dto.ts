import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DayOfWeek, ScheduleType } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

const HHMM = /^([01]?\d|2[0-3]):[0-5]\d$/;

export class CreatePlanDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  semesterId!: string;

  @ApiProperty({ example: 'Semester 1 — Draft A' })
  @IsString()
  @MaxLength(80)
  name!: string;
}

export class UpdatePlanDto {
  @ApiPropertyOptional({ example: 'Semester 1 — Final' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;
}

export class DuplicatePlanDto {
  @ApiProperty({ example: 'Copy of Draft A' })
  @IsString()
  @MaxLength(80)
  name!: string;
}

export class CopySemesterDto {
  @ApiProperty({ format: 'uuid', description: 'Semester whose published/latest plan is copied' })
  @IsUUID()
  sourceSemesterId!: string;

  @ApiProperty({ format: 'uuid', description: 'Semester the new draft plan is created in' })
  @IsUUID()
  targetSemesterId!: string;

  @ApiProperty({ example: 'Semester 2 — Draft (from Semester 1)' })
  @IsString()
  @MaxLength(80)
  name!: string;
}

export class CreateClassDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  sectionId!: string;

  @ApiPropertyOptional({ enum: ScheduleType, default: ScheduleType.REGULAR })
  @IsOptional()
  @IsEnum(ScheduleType)
  scheduleType?: ScheduleType;

  @ApiProperty({ enum: DayOfWeek })
  @IsEnum(DayOfWeek)
  dayOfWeek!: DayOfWeek;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  classNumber!: number;

  @ApiProperty({ example: '08:00' })
  @Matches(HHMM, { message: 'startTime must be HH:MM' })
  startTime!: string;

  @ApiProperty({ example: '08:45' })
  @Matches(HHMM, { message: 'endTime must be HH:MM' })
  endTime!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  subjectId!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  teacherId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Optional special location; omit for the classroom',
  })
  @IsOptional()
  @IsUUID()
  locationId?: string;
}

export class UpdateClassDto {
  @ApiPropertyOptional({ enum: ScheduleType })
  @IsOptional()
  @IsEnum(ScheduleType)
  scheduleType?: ScheduleType;

  @ApiPropertyOptional({ enum: DayOfWeek })
  @IsOptional()
  @IsEnum(DayOfWeek)
  dayOfWeek?: DayOfWeek;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  classNumber?: number;

  @ApiPropertyOptional({ example: '09:00' })
  @IsOptional()
  @Matches(HHMM, { message: 'startTime must be HH:MM' })
  startTime?: string;

  @ApiPropertyOptional({ example: '09:45' })
  @IsOptional()
  @Matches(HHMM, { message: 'endTime must be HH:MM' })
  endTime?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  teacherId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  locationId?: string | null;
}

export class ClearDayDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  sectionId!: string;

  @ApiProperty({ enum: DayOfWeek })
  @IsEnum(DayOfWeek)
  dayOfWeek!: DayOfWeek;

  @ApiPropertyOptional({ enum: ScheduleType, default: ScheduleType.REGULAR })
  @IsOptional()
  @IsEnum(ScheduleType)
  scheduleType?: ScheduleType;
}

export class ClearSectionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  sectionId!: string;
}

export class BulkReplaceTeacherDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  fromTeacherId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  toTeacherId!: string;
}

export class BulkReplaceSubjectDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  fromSubjectId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  toSubjectId!: string;
}
