import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { AttendanceMethod, AttendanceStatus } from '@prisma/client';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class AttendanceRecordDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  studentId!: string;

  @ApiProperty({ enum: AttendanceStatus })
  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;

  @ApiPropertyOptional({ enum: AttendanceMethod, default: AttendanceMethod.MANUAL })
  @IsOptional()
  @IsEnum(AttendanceMethod)
  method?: AttendanceMethod;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;

  @ApiPropertyOptional({ description: 'Client-generated id from the offline queue' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  clientRef?: string;
}

/**
 * Idempotent bulk marking. Re-sending the same (sectionId, date, classNumber, studentId)
 * updates the existing record rather than duplicating — this is the offline-sync target.
 */
export class BulkMarkDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  sectionId!: string;

  @ApiProperty({ example: '2025-09-07' })
  @IsDateString()
  date!: string;

  @ApiPropertyOptional({ default: 0, description: '0 = daily/homeroom; >0 = per period' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  classNumber?: number;

  @ApiProperty({ type: [AttendanceRecordDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AttendanceRecordDto)
  records!: AttendanceRecordDto[];
}

export class QrMarkDto {
  @ApiProperty({ example: 'MNX-XXXXXXXXXXXX' })
  @IsString()
  @MaxLength(64)
  qrCode!: string;

  @ApiPropertyOptional({ enum: AttendanceStatus, default: AttendanceStatus.PRESENT })
  @IsOptional()
  @IsEnum(AttendanceStatus)
  status?: AttendanceStatus;

  @ApiPropertyOptional({ example: '2025-09-07' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  classNumber?: number;
}
