import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LeaveRequestType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateLeaveRequestDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  studentId!: string;

  @ApiProperty({ enum: LeaveRequestType })
  @IsEnum(LeaveRequestType)
  type!: LeaveRequestType;

  @ApiProperty({ example: '2026-06-10', description: 'Inclusive start date (YYYY-MM-DD)' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: '2026-06-12', description: 'Inclusive end date (YYYY-MM-DD)' })
  @IsDateString()
  endDate!: string;

  @ApiProperty({ example: 'Family travel' })
  @IsString()
  @MaxLength(1000)
  reason!: string;
}

export class DecideLeaveRequestDto {
  @ApiProperty({ enum: ['APPROVED', 'REJECTED'] })
  @IsIn(['APPROVED', 'REJECTED'])
  decision!: 'APPROVED' | 'REJECTED';

  @ApiPropertyOptional({ example: 'Approved — please collect homework in advance.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reviewNote?: string;
}
