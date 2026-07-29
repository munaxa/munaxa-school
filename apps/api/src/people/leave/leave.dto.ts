import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { StaffLeaveStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateLeaveTypeDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  code?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  paid?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  defaultAnnualDays?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 5, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  approvalLevels?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(9)
  colorHex?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateLeaveTypeDto extends PartialType(CreateLeaveTypeDto) {}

/** Set an employee's entitlement for one leave type in one year. */
export class SetLeaveBalanceDto {
  @ApiProperty()
  @IsUUID()
  leaveTypeId!: string;

  @ApiProperty({ example: 2026 })
  @IsInt()
  @Min(2000)
  @Max(2200)
  year!: number;

  @ApiProperty({ example: 21 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  entitledDays!: number;
}

export class CreateLeaveRequestDto {
  @ApiProperty()
  @IsUUID()
  leaveTypeId!: string;

  @ApiProperty({ description: 'Start date (ISO date).' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ description: 'End date (ISO date).' })
  @IsDateString()
  endDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class DecideLeaveRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

/** Filters for the approver-facing leave-request queue. */
export class ListLeaveRequestsQueryDto {
  @ApiPropertyOptional({ enum: StaffLeaveStatus })
  @IsOptional()
  @IsEnum(StaffLeaveStatus)
  status?: StaffLeaveStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 500, default: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  take?: number;
}
