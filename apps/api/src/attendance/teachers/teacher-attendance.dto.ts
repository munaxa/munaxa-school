import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TeacherAttendanceStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class MarkTeacherAttendanceDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  teacherId!: string;

  @ApiProperty({ example: '2025-09-07' })
  @IsDateString()
  date!: string;

  @ApiProperty({ enum: TeacherAttendanceStatus })
  @IsEnum(TeacherAttendanceStatus)
  status!: TeacherAttendanceStatus;

  @ApiPropertyOptional({ description: 'Check-in time (ISO datetime)' })
  @IsOptional()
  @IsDateString()
  checkInAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}
