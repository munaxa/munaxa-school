import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({ example: 'Front Desk' })
  @IsString()
  @MaxLength(80)
  nameEn!: string;

  @ApiPropertyOptional({ example: 'موظف الاستقبال' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  nameAr?: string;

  @ApiProperty({ type: [String], example: ['announcement:manage', 'finance:read'] })
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  permissions!: string[];
}

export class UpdateRoleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  nameEn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  nameAr?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  permissions?: string[];
}
