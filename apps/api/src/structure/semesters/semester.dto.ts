import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsDateString, IsInt, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class CreateSemesterDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  academicYearId!: string;

  @ApiProperty({ example: 'First Semester' })
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 1, minimum: 1, maximum: 6 })
  @IsInt()
  @Min(1)
  @Max(6)
  sequence!: number;

  @ApiProperty({ example: '2025-09-01' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: '2026-01-15' })
  @IsDateString()
  endDate!: string;
}

export class UpdateSemesterDto extends PartialType(CreateSemesterDto) {}
