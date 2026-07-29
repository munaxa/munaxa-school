import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateParentDto {
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

  @ApiProperty({ description: 'Primary mobile number (mandatory)' })
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  phone!: string;

  @ApiPropertyOptional({ description: 'Secondary/alternate mobile number (optional)' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phoneAlt?: string;

  @ApiPropertyOptional({ description: 'Contact email for payment/settlement notifications' })
  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  nationalId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  occupation?: string;
}

export class UpdateParentDto extends PartialType(CreateParentDto) {}
