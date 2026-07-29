import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePtmSlotDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  teacherId!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  sectionId?: string;

  @ApiProperty({ example: '2026-06-15T09:00:00.000Z' })
  @IsDateString()
  startsAt!: string;

  @ApiProperty({ example: '2026-06-15T09:15:00.000Z' })
  @IsDateString()
  endsAt!: string;

  @ApiPropertyOptional({ example: 'Room 12 / Google Meet link' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  location?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  capacity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CreatePtmBookingDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  slotId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  studentId!: string;

  @ApiPropertyOptional({ example: 'Would like to discuss math progress.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
