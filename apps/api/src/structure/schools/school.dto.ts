import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateSchoolDto {
  @ApiProperty({ example: 'Green Valley School' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  nameEn!: string;

  @ApiProperty({ example: 'مدرسة الوادي الأخضر' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  nameAr!: string;

  @ApiPropertyOptional({ description: 'Ministry of Education school code' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  moeSchoolCode?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // IANA timezone the scheduling engine resolves live time in (e.g. "Asia/Amman", "Europe/London").
  @ApiPropertyOptional({ example: 'Asia/Amman', description: 'IANA timezone name' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;
}

export class UpdateSchoolDto extends PartialType(CreateSchoolDto) {}
