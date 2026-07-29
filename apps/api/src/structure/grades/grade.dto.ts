import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsInt, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateGradeDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  campusId!: string;

  @ApiProperty({ example: 'Grade 1' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  nameEn!: string;

  @ApiProperty({ example: 'الصف الأول' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  nameAr!: string;

  @ApiProperty({ example: 1, description: 'Ordinal level (KG=0, G1=1, …)' })
  @IsInt()
  @Min(0)
  @Max(20)
  level!: number;
}

export class UpdateGradeDto extends PartialType(CreateGradeDto) {}
