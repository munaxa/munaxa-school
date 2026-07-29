import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsHexColor, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateSubjectDto {
  @ApiProperty({ example: 'Mathematics' })
  @IsString()
  @MaxLength(80)
  nameEn!: string;

  @ApiProperty({ example: 'الرياضيات' })
  @IsString()
  @MaxLength(80)
  nameAr!: string;

  @ApiPropertyOptional({ example: 'MATH' })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  code?: string;

  @ApiPropertyOptional({
    example: '#2563eb',
    description: 'Display colour used across the timetable',
  })
  @IsOptional()
  @IsHexColor()
  colorHex?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateSubjectDto extends PartialType(CreateSubjectDto) {}
