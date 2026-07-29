import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateCampusDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  schoolId!: string;

  @ApiProperty({ example: 'Main Campus' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  nameEn!: string;

  @ApiProperty({ example: 'الحرم الرئيسي' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  nameAr!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isMain?: boolean;
}

export class UpdateCampusDto extends PartialType(CreateCampusDto) {}
