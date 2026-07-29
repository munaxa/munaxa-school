import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { InfractionSeverity } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** Create or update an employee's driver profile (idempotent upsert per employee). */
export class UpsertDriverProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  licenseNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  licenseClass?: string;

  @ApiPropertyOptional({ description: 'Licence expiry (ISO date).' })
  @IsOptional()
  @IsDateString()
  licenseExpiry?: string;

  @ApiPropertyOptional({ description: 'Medical certificate expiry (ISO date).' })
  @IsOptional()
  @IsDateString()
  medicalCertExpiry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  medicalNotes?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 5, description: 'Driving-performance rating (1–5).' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  performanceRating?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CreateInfractionDto {
  @ApiProperty({ description: 'Infraction date (ISO date).' })
  @IsDateString()
  date!: string;

  @ApiProperty({ example: 'Speeding' })
  @IsString()
  @MaxLength(120)
  type!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ enum: InfractionSeverity })
  @IsOptional()
  @IsEnum(InfractionSeverity)
  severity?: InfractionSeverity;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  points?: number;
}

export class UpdateInfractionDto extends PartialType(CreateInfractionDto) {}
