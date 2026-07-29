import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AttendanceLockScope, AttendanceLockStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/** Lock a period of staff attendance against further edits. */
export class CreateAttendanceLockDto {
  @ApiProperty({ enum: AttendanceLockScope })
  @IsEnum(AttendanceLockScope)
  scope!: AttendanceLockScope;

  @ApiProperty({ description: 'First locked day (inclusive, ISO date).' })
  @IsDateString()
  periodStart!: string;

  @ApiProperty({ description: 'Last locked day (inclusive, ISO date).' })
  @IsDateString()
  periodEnd!: string;

  @ApiPropertyOptional({ description: 'Restrict the lock to one campus; omit for tenant-wide.' })
  @IsOptional()
  @IsUUID()
  campusId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

/** Release (unlock) a period. Requires an explicit note for the audit trail. */
export class ReleaseAttendanceLockDto {
  @ApiPropertyOptional({ description: 'Why the period is being reopened (audited).' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ListAttendanceLocksQueryDto {
  @ApiPropertyOptional({ enum: AttendanceLockStatus })
  @IsOptional()
  @IsEnum(AttendanceLockStatus)
  status?: AttendanceLockStatus;
}
