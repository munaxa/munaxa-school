import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Gender, ParentRelation, StudentStatus } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateStudentDto {
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

  @ApiPropertyOptional({ description: 'Father (second) name — English' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fatherNameEn?: string;

  @ApiPropertyOptional({ description: 'اسم الأب — Arabic' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fatherNameAr?: string;

  @ApiPropertyOptional({ description: 'Grandfather (third) name — English' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  thirdNameEn?: string;

  @ApiPropertyOptional({ description: 'اسم الجد — Arabic' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  thirdNameAr?: string;

  @ApiPropertyOptional({ description: 'Ministry of Education student number' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  moeStudentNumber?: string;

  @ApiPropertyOptional({ description: 'Jordanian National ID (10 digits)' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  nationalId?: string;

  @ApiPropertyOptional({ example: '2015-04-12' })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({ enum: StudentStatus })
  @IsOptional()
  @IsEnum(StudentStatus)
  status?: StudentStatus;
}

// Identity only — grade/section/classroom/area/transport are year-scoped placement on the Enrollment.
export class UpdateStudentDto extends PartialType(CreateStudentDto) {}

export class LinkParentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  parentId!: string;

  @ApiProperty({ enum: ParentRelation })
  @IsEnum(ParentRelation)
  relation!: ParentRelation;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class CreateVaccineDto {
  @ApiProperty({ description: 'Vaccine name', example: 'MMR' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ description: 'Grade at which it was administered', example: 'Grade 1' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  grade?: string;

  @ApiPropertyOptional({
    description: 'Whether the governmental vaccine was received',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  received?: boolean;

  @ApiPropertyOptional({ example: '2021-09-01' })
  @IsOptional()
  @IsDateString()
  dateGiven?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdateVaccineDto extends PartialType(CreateVaccineDto) {}

export class ImportStudentsDto {
  @ApiProperty({
    description:
      'CSV text. Required header: firstNameEn,lastNameEn,firstNameAr,lastNameAr. Optional: fatherNameEn,fatherNameAr,thirdNameEn,thirdNameAr,moeStudentNumber,nationalId,gender',
  })
  @IsString()
  @MinLength(1)
  csv!: string;
}
