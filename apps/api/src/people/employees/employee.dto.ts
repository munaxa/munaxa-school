import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { EmploymentStatus, EmploymentType, Gender, MaritalStatus } from '@prisma/client';
import {
  IsBooleanString,
  IsDateString,
  IsEmail,
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
import { Type } from 'class-transformer';
import { ENTRY_STATUSES } from './employee-lifecycle.logic';

export class CreateEmployeeDto {
  // --- Identity ---
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstNameEn!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastNameEn!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstNameAr!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastNameAr!: string;

  @ApiProperty({ example: 'Secretary' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  jobTitle!: string;

  @ApiPropertyOptional({ description: 'Human-facing staff number, unique per school.' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  employeeNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  nationalId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  passportNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  nationality?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  visaNumber?: string;

  @ApiPropertyOptional({ description: 'Visa expiry (ISO date).' })
  @IsOptional()
  @IsDateString()
  visaExpiry?: string;

  @ApiPropertyOptional({ enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({ description: 'Date of birth (ISO date).' })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ enum: MaritalStatus })
  @IsOptional()
  @IsEnum(MaritalStatus)
  maritalStatus?: MaritalStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  religion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  personalEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  personalPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  photoUrl?: string;

  // --- Employment ---
  @ApiPropertyOptional({ enum: EmploymentType })
  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;

  @ApiPropertyOptional({
    enum: ENTRY_STATUSES,
    description: 'Initial lifecycle status. Must be an entry status; defaults to ACTIVE.',
  })
  @IsOptional()
  @IsEnum(EmploymentStatus)
  status?: EmploymentStatus;

  @ApiPropertyOptional({ description: 'Joining date (ISO date).' })
  @IsOptional()
  @IsDateString()
  hireDate?: string;

  @ApiPropertyOptional({ description: 'Probation end date (ISO date).' })
  @IsOptional()
  @IsDateString()
  probationEndDate?: string;

  @ApiPropertyOptional({ example: 40 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(168)
  workingHoursPerWeek?: number;

  // --- Org placement ---
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  campusId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  positionId?: string;

  @ApiPropertyOptional({ description: 'Reporting manager (another employee).' })
  @IsOptional()
  @IsUUID()
  managerId?: string;
}

/** Update omits `status`: employment status only changes through the lifecycle endpoint. */
export class UpdateEmployeeDto extends PartialType(
  OmitType(CreateEmployeeDto, ['status'] as const),
) {}

/** A lifecycle status transition. Validated against the state machine in the service. */
export class TransitionEmployeeStatusDto {
  @ApiProperty({ enum: EmploymentStatus })
  @IsEnum(EmploymentStatus)
  toStatus!: EmploymentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional({ description: 'Effective date of the change (ISO date).' })
  @IsOptional()
  @IsDateString()
  effectiveDate?: string;
}

/** Directory filters. All optional; combine to keep result sets bounded at scale. */
export class ListEmployeesQueryDto {
  @ApiPropertyOptional({ description: 'Free-text search over name / employee number / job title.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @ApiPropertyOptional({ enum: EmploymentStatus })
  @IsOptional()
  @IsEnum(EmploymentStatus)
  status?: EmploymentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  campusId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  positionId?: string;

  @ApiPropertyOptional({ description: 'Include soft-inactive (exited/archived) staff.' })
  @IsOptional()
  @IsBooleanString()
  includeInactive?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 500, default: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  take?: number;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number;
}
