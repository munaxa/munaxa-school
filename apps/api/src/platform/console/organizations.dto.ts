import { IsBoolean, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class CreateOrganizationDto {
  @IsString() @MaxLength(200) name!: string;

  @Matches(/^[a-z0-9-]+$/, { message: 'slug must be lowercase letters, numbers and hyphens' })
  @MaxLength(100)
  slug!: string;

  @IsOptional() @IsString() @MaxLength(200) billingEmail?: string;
  @IsOptional() @IsString() @MaxLength(2) countryCode?: string;
  @IsOptional() @IsBoolean() consolidatedBilling?: boolean;
}

export class UpdateOrganizationDto {
  @IsOptional() @IsString() @MaxLength(200) name?: string;
  @IsOptional() @IsString() @MaxLength(200) billingEmail?: string;
  @IsOptional() @IsString() @MaxLength(2) countryCode?: string;
  @IsOptional() @IsBoolean() consolidatedBilling?: boolean;
}

export class AssignSchoolDto {
  @IsUUID() tenantId!: string;
}
