import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DayOfWeek, ShiftKind } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const HHMM = /^([01]?\d|2[0-3]):[0-5]\d$/;

/** Create a shift window. Thresholds are not set here — they come from the linked policy. */
export class CreateShiftDto {
  @ApiProperty()
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ enum: ShiftKind, default: ShiftKind.MORNING })
  @IsOptional()
  @IsEnum(ShiftKind)
  kind?: ShiftKind;

  @ApiProperty({ example: '08:00', description: 'Expected check-in, HH:MM (24h).' })
  @Matches(HHMM, { message: 'expectedCheckIn must be HH:MM' })
  expectedCheckIn!: string;

  @ApiProperty({ example: '16:00', description: 'Expected check-out, HH:MM (24h).' })
  @Matches(HHMM, { message: 'expectedCheckOut must be HH:MM' })
  expectedCheckOut!: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 480, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(480)
  breakMinutes?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 24, description: 'Cap on credited worked hours.' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(24)
  maxHours?: number;

  @ApiPropertyOptional({ description: 'Campus scope; omit for tenant-wide.' })
  @IsOptional()
  @IsUUID()
  campusId?: string;

  @ApiPropertyOptional({ description: 'Policy supplying the thresholds for this shift.' })
  @IsOptional()
  @IsUUID()
  policyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateShiftDto extends CreateShiftDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  declare name: string;

  @ApiPropertyOptional({ example: '08:00' })
  @IsOptional()
  @Matches(HHMM, { message: 'expectedCheckIn must be HH:MM' })
  declare expectedCheckIn: string;

  @ApiPropertyOptional({ example: '16:00' })
  @IsOptional()
  @Matches(HHMM, { message: 'expectedCheckOut must be HH:MM' })
  declare expectedCheckOut: string;
}

/** Assign a shift to an employee over an effective window. */
export class AssignShiftDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  shiftId!: string;

  @ApiProperty({ description: 'First day the assignment applies (ISO date).' })
  @IsDateString()
  effectiveFrom!: string;

  @ApiPropertyOptional({ description: 'Last day (inclusive); omit for open-ended.' })
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @ApiPropertyOptional({
    enum: DayOfWeek,
    isArray: true,
    description: 'Restrict to specific days; omit for every working day.',
  })
  @IsOptional()
  @IsArray()
  @IsEnum(DayOfWeek, { each: true })
  daysOfWeek?: DayOfWeek[];
}
