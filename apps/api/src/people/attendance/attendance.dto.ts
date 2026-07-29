import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StaffAttendanceSource, StaffAttendanceStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { REPORT_FORMATS, type ReportFormat } from '../../reporting/export/report.types';

/** Record (or correct) one employee's attendance for one day. Upserts on (employee, date). */
export class RecordAttendanceDto {
  @ApiProperty({ description: 'Attendance date (ISO date).' })
  @IsDateString()
  date!: string;

  @ApiProperty({ enum: StaffAttendanceStatus })
  @IsEnum(StaffAttendanceStatus)
  status!: StaffAttendanceStatus;

  @ApiPropertyOptional({ enum: StaffAttendanceSource, default: StaffAttendanceSource.MANUAL })
  @IsOptional()
  @IsEnum(StaffAttendanceSource)
  source?: StaffAttendanceSource;

  @ApiPropertyOptional({ description: 'Check-in timestamp (ISO datetime).' })
  @IsOptional()
  @IsDateString()
  checkInAt?: string;

  @ApiPropertyOptional({ description: 'Check-out timestamp (ISO datetime).' })
  @IsOptional()
  @IsDateString()
  checkOutAt?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 1440 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1440)
  lateMinutes?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 24 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(24)
  overtimeHours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

/** One line within a bulk daily roster mark. */
export class BulkAttendanceEntryDto {
  @ApiProperty()
  @IsUUID()
  employeeId!: string;

  @ApiProperty({ enum: StaffAttendanceStatus })
  @IsEnum(StaffAttendanceStatus)
  status!: StaffAttendanceStatus;

  @ApiPropertyOptional({ minimum: 0, maximum: 1440 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1440)
  lateMinutes?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 24 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(24)
  overtimeHours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

/** Mark many employees for a single date (HR daily roster). */
export class BulkAttendanceDto {
  @ApiProperty({ description: 'The date all entries apply to (ISO date).' })
  @IsDateString()
  date!: string;

  @ApiPropertyOptional({ enum: StaffAttendanceSource, default: StaffAttendanceSource.MANUAL })
  @IsOptional()
  @IsEnum(StaffAttendanceSource)
  source?: StaffAttendanceSource;

  @ApiProperty({ type: [BulkAttendanceEntryDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => BulkAttendanceEntryDto)
  entries!: BulkAttendanceEntryDto[];
}

/** Date-range filter for listing an employee's attendance. */
export class ListAttendanceQueryDto {
  @ApiPropertyOptional({ description: 'From date (inclusive, ISO date).' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'To date (inclusive, ISO date).' })
  @IsOptional()
  @IsDateString()
  to?: string;
}

/** The HR daily-roster view: everyone's attendance on one date. */
export class DailyAttendanceQueryDto {
  @ApiProperty({ description: 'The roster date (ISO date).' })
  @IsDateString()
  date!: string;
}

/** Payroll-prep range + optional export format. */
export class PayrollPrepQueryDto {
  @ApiProperty({ description: 'Period start (inclusive, ISO date).' })
  @IsDateString()
  from!: string;

  @ApiProperty({ description: 'Period end (inclusive, ISO date).' })
  @IsDateString()
  to!: string;

  @ApiPropertyOptional({ enum: REPORT_FORMATS, description: 'Download format.' })
  @IsOptional()
  @IsIn(REPORT_FORMATS)
  format?: ReportFormat;
}
