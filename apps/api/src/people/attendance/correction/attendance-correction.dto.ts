import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AttendanceCorrectionStatus, StaffAttendanceStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** Raise a correction for one employee-day. Nothing is edited in place by the requester. */
export class CreateCorrectionRequestDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  employeeId!: string;

  @ApiProperty({ description: 'The day being corrected (ISO date).' })
  @IsDateString()
  date!: string;

  @ApiProperty({ enum: StaffAttendanceStatus, description: 'The status it should have been.' })
  @IsEnum(StaffAttendanceStatus)
  requestedStatus!: StaffAttendanceStatus;

  @ApiPropertyOptional({ description: 'Corrected check-in (ISO datetime).' })
  @IsOptional()
  @IsDateString()
  requestedCheckInAt?: string;

  @ApiPropertyOptional({ description: 'Corrected check-out (ISO datetime).' })
  @IsOptional()
  @IsDateString()
  requestedCheckOutAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  requestedNote?: string;

  @ApiProperty({ description: 'Why the correction is needed (mandatory, audited).' })
  @IsString()
  @MaxLength(1000)
  reason!: string;

  @ApiPropertyOptional({ description: 'Link to supporting evidence (document/attachment).' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  evidenceUrl?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 5, default: 1, description: 'Approval levels.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  requiredLevels?: number;
}

/** Approve or reject the current level of a correction request. */
export class DecideCorrectionDto {
  @ApiPropertyOptional({ description: 'Decision note (audited).' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ListCorrectionsQueryDto {
  @ApiPropertyOptional({ enum: AttendanceCorrectionStatus })
  @IsOptional()
  @IsEnum(AttendanceCorrectionStatus)
  status?: AttendanceCorrectionStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  employeeId?: string;
}
