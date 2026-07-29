import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { EmploymentStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateTeacherDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstNameEn!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastNameEn!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstNameAr!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastNameAr!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  employeeNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  specialization?: string;

  @ApiPropertyOptional({ enum: EmploymentStatus })
  @IsOptional()
  @IsEnum(EmploymentStatus)
  status?: EmploymentStatus;
}

export class UpdateTeacherDto extends PartialType(CreateTeacherDto) {}

export class AssignSectionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  sectionId!: string;

  @ApiPropertyOptional({ example: 'Mathematics' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  subject?: string;
}
