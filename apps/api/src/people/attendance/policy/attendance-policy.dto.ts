import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** Create an attendance policy. Every threshold is optional and falls back to the system default. */
export class CreateAttendancePolicyDto {
  @ApiProperty()
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ description: 'Scope to a campus; omit for a tenant-wide policy.' })
  @IsOptional()
  @IsUUID()
  campusId?: string;

  @ApiPropertyOptional({ description: 'Make this the tenant default policy.' })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ minimum: 0, maximum: 240, description: 'Lateness forgiven (minutes).' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(240)
  graceMinutes?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 480 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(480)
  lateAfterMinutes?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 1440 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  absentAfterMinutes?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 1440 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  halfDayAfterShortfallMinutes?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 480 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(480)
  earlyDepartureAfterMinutes?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 480 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(480)
  overtimeAfterMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  countWeekendAsWorking?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowManualOverride?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** Partial update of a policy; unspecified thresholds keep their stored values. */
export class UpdateAttendancePolicyDto extends CreateAttendancePolicyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  declare name: string;
}
