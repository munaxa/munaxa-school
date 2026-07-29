import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AchievementCategory } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class CreateAchievementDto {
  @ApiProperty({ example: 'streak-7', description: 'Stable key, unique per tenant' })
  @IsString()
  @MaxLength(60)
  key!: string;

  @ApiProperty({ example: 'Perfect Week' })
  @IsString()
  @MaxLength(120)
  nameEn!: string;

  @ApiProperty({ example: 'أسبوع مثالي' })
  @IsString()
  @MaxLength(120)
  nameAr!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: '🔥' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  icon?: string;

  @ApiProperty({ enum: AchievementCategory })
  @IsEnum(AchievementCategory)
  category!: AchievementCategory;

  @ApiPropertyOptional({ default: 0, minimum: 0, maximum: 100000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  points?: number;

  @ApiPropertyOptional({
    description: 'For ATTENDANCE_STREAK/ATTENDANCE_TOTAL: the metric value that earns it',
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  threshold?: number;
}

export class AwardAchievementDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  studentId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
