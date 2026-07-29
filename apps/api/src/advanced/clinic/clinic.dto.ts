import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ClinicOutcome } from '@prisma/client';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateClinicVisitDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  studentId!: string;

  @ApiProperty({ example: 'Headache and mild fever' })
  @IsString()
  @MaxLength(250)
  reason!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  symptoms?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  treatment?: string;

  @ApiPropertyOptional({ example: 37.8, minimum: 30, maximum: 45 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(30)
  @Max(45)
  temperature?: number;

  @ApiPropertyOptional({ enum: ClinicOutcome, default: ClinicOutcome.RESOLVED })
  @IsOptional()
  @IsEnum(ClinicOutcome)
  outcome?: ClinicOutcome;
}

export class UpsertMedicalRecordDto {
  @ApiPropertyOptional({ example: 'O+' })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  bloodType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  allergies?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  chronicConditions?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  medications?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  emergencyContact?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
