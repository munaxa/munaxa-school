import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { PerformanceCycleStatus, PerformanceGoalStatus } from '@prisma/client';
import {
  IsDateString,
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

// ----- Cycles ----------------------------------------------------------------
export class CreatePerformanceCycleDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ description: 'Cycle start (ISO date).' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ description: 'Cycle end (ISO date).' })
  @IsDateString()
  endDate!: string;

  @ApiPropertyOptional({ enum: PerformanceCycleStatus })
  @IsOptional()
  @IsEnum(PerformanceCycleStatus)
  status?: PerformanceCycleStatus;
}

export class UpdatePerformanceCycleDto extends PartialType(CreatePerformanceCycleDto) {}

// ----- Reviews ---------------------------------------------------------------
export class CreatePerformanceReviewDto {
  @ApiProperty()
  @IsUUID()
  cycleId!: string;
}

export class UpdatePerformanceReviewDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  overallRating?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  summary?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  strengths?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  improvements?: string;
}

// ----- Goals -----------------------------------------------------------------
export class CreatePerformanceGoalDto {
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

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  weight?: number;

  @ApiPropertyOptional({ description: 'Due date (ISO date).' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

export class UpdatePerformanceGoalDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  weight?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  progress?: number;

  @ApiPropertyOptional({ enum: PerformanceGoalStatus })
  @IsOptional()
  @IsEnum(PerformanceGoalStatus)
  status?: PerformanceGoalStatus;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional({ description: 'Due date (ISO date).' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
