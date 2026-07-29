import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ApplicantStatus,
  EmploymentType,
  InterviewMode,
  InterviewOutcome,
  JobPostingStatus,
} from '@prisma/client';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

// ----- Job postings ----------------------------------------------------------
export class CreateJobPostingDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  positionId?: string;

  @ApiPropertyOptional({ enum: EmploymentType })
  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 1000, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  headcount?: number;

  @ApiPropertyOptional({ enum: JobPostingStatus })
  @IsOptional()
  @IsEnum(JobPostingStatus)
  status?: JobPostingStatus;
}

export class UpdateJobPostingDto extends PartialType(CreateJobPostingDto) {}

export class ListJobPostingsQueryDto {
  @ApiPropertyOptional({ enum: JobPostingStatus })
  @IsOptional()
  @IsEnum(JobPostingStatus)
  status?: JobPostingStatus;
}

// ----- Applicants ------------------------------------------------------------
export class CreateApplicantDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  source?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  resumeUrl?: string;
}

export class UpdateApplicantDto {
  @ApiPropertyOptional({ enum: ApplicantStatus })
  @IsOptional()
  @IsEnum(ApplicantStatus)
  status?: ApplicantStatus;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

/** Hire an applicant into a real Employee (status HIRED). English names come from the applicant. */
export class HireApplicantDto {
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

  @ApiPropertyOptional({ description: 'Defaults to the posting title.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  jobTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  employeeNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  positionId?: string;

  @ApiPropertyOptional({ enum: EmploymentType })
  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;

  @ApiPropertyOptional({ description: 'Hire date (ISO date).' })
  @IsOptional()
  @IsDateString()
  hireDate?: string;
}

// ----- Interviews ------------------------------------------------------------
export class CreateInterviewDto {
  @ApiProperty({ description: 'Scheduled time (ISO datetime).' })
  @IsDateString()
  scheduledAt!: string;

  @ApiPropertyOptional({ enum: InterviewMode })
  @IsOptional()
  @IsEnum(InterviewMode)
  mode?: InterviewMode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  interviewerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  stage?: string;
}

export class UpdateInterviewDto {
  @ApiPropertyOptional({ description: 'Scheduled time (ISO datetime).' })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @ApiPropertyOptional({ enum: InterviewMode })
  @IsOptional()
  @IsEnum(InterviewMode)
  mode?: InterviewMode;

  @ApiPropertyOptional({ enum: InterviewOutcome })
  @IsOptional()
  @IsEnum(InterviewOutcome)
  outcome?: InterviewOutcome;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  feedback?: string;
}
