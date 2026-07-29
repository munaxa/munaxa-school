import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BehaviorType } from '@prisma/client';
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
} from 'class-validator';

export class CreateBehaviorDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  studentId!: string;

  @ApiProperty({ enum: BehaviorType })
  @IsEnum(BehaviorType)
  type!: BehaviorType;

  @ApiPropertyOptional({ example: 'Participation' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @ApiProperty({ example: 'Helped a classmate' })
  @IsString()
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ default: 0, description: 'Merit/demerit points (+/-)' })
  @IsOptional()
  @IsInt()
  @Min(-100)
  @Max(100)
  points?: number;

  @ApiProperty({ example: '2025-09-07' })
  @IsDateString()
  date!: string;
}
