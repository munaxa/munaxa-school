import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { TrainingRecordStatus } from '@prisma/client';
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

// ----- Courses ---------------------------------------------------------------
export class CreateTrainingCourseDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  provider?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 999 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999)
  hours?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  mandatory?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateTrainingCourseDto extends PartialType(CreateTrainingCourseDto) {}

// ----- Records ---------------------------------------------------------------
export class EnrollTrainingDto {
  @ApiProperty()
  @IsUUID()
  courseId!: string;
}

export class UpdateTrainingRecordDto {
  @ApiPropertyOptional({ enum: TrainingRecordStatus })
  @IsOptional()
  @IsEnum(TrainingRecordStatus)
  status?: TrainingRecordStatus;

  @ApiPropertyOptional({ description: 'Completion date (ISO datetime).' })
  @IsOptional()
  @IsDateString()
  completedAt?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  score?: number;

  @ApiPropertyOptional({ description: 'Certification expiry (ISO date).' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ description: 'Linked certificate document id.' })
  @IsOptional()
  @IsUUID()
  certificateId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

/** Query for the "expiring certifications" report. */
export class ExpiringTrainingQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 365, default: 90 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  within?: number;
}
