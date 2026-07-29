import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { SpecialLocationKind } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateLocationDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  campusId!: string;

  @ApiProperty({ example: 'Science Laboratory' })
  @IsString()
  @MaxLength(80)
  nameEn!: string;

  @ApiProperty({ example: 'مختبر العلوم' })
  @IsString()
  @MaxLength(80)
  nameAr!: string;

  @ApiPropertyOptional({ enum: SpecialLocationKind, default: SpecialLocationKind.OTHER })
  @IsOptional()
  @IsEnum(SpecialLocationKind)
  kind?: SpecialLocationKind;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsInt()
  @Min(0)
  capacity?: number;
}

export class UpdateLocationDto extends PartialType(CreateLocationDto) {}
