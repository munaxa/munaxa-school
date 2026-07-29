import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateSectionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  gradeId!: string;

  @ApiProperty({ example: 'A' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name!: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Assigned classroom' })
  @IsOptional()
  @IsUUID()
  classroomId?: string;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  capacity?: number;
}

export class UpdateSectionDto extends PartialType(CreateSectionDto) {}
