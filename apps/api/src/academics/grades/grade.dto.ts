import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateGradeDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  studentId!: string;

  @ApiProperty({ example: 'Mathematics' })
  @IsString()
  @MaxLength(120)
  subject!: string;

  @ApiProperty({ example: 'Midterm' })
  @IsString()
  @MaxLength(120)
  assessment!: string;

  @ApiProperty({ example: 85 })
  @IsNumber()
  @Min(0)
  @Max(100000)
  score!: number;

  @ApiProperty({ example: 100 })
  @IsNumber()
  @Min(1)
  @Max(100000)
  maxScore!: number;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  sectionId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  semesterId?: string;

  @ApiPropertyOptional({ example: 0.4, description: 'Weight toward the final grade' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  weight?: number;
}

export class ImportGradesDto {
  @ApiProperty({
    description:
      'CSV text. Header: studentId,subject,assessment,score,maxScore[,semesterId,weight]',
  })
  @IsString()
  @MinLength(1)
  csv!: string;
}
