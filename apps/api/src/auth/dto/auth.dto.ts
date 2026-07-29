import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

// Control characters (incl. NUL and DEL) never belong in a login handle — strip them (and trim)
// on the server so sanitisation is authoritative, not merely a client-side nicety.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;

const stripControlAndTrim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.replace(CONTROL_CHARS, '').trim() : value;

/**
 * Tenant slug: lowercase alphanumeric with internal hyphens, bounded length. A user-supplied
 * tenantSlug reaches the tenant-resolution query, so we sanitise (trim/lowercase, blank → absent)
 * and validate its shape before it is trusted.
 */
export const TENANT_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

const normalizeSlug = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() || undefined : value;

/** Optional, sanitised and shape-validated tenant slug — reused across auth DTOs. */
function IsOptionalTenantSlug(): PropertyDecorator {
  return applyDecorators(
    Transform(normalizeSlug),
    IsOptional(),
    IsString(),
    MaxLength(63),
    Matches(TENANT_SLUG_PATTERN, {
      message: 'tenantSlug must be a valid slug: lowercase letters, numbers and hyphens',
    }),
  );
}

/**
 * Minimum password strength: at least one lower-case letter, one upper-case letter, one digit and
 * one special character (length is enforced separately via @MinLength). Applied to every
 * new/changed password. Kept in lock-step with PasswordService.assertStrong (the runtime source
 * of truth) and the frontend policy helper.
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;
export const PASSWORD_PATTERN_MESSAGE =
  'Password must contain a lower-case letter, an upper-case letter, a number and a special character';

export class LoginDto {
  @ApiPropertyOptional({
    description: 'Email or username. Preferred field; falls back to `email` for legacy clients.',
    example: 'admin@school.example',
  })
  @Transform(stripControlAndTrim)
  @IsOptional()
  @IsString()
  @MaxLength(320)
  identifier?: string;

  @ApiPropertyOptional({
    description: 'Legacy: email address. Use `identifier` for email-or-username login.',
    example: 'admin@school.example',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: 'Sup3rSecret!' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  password!: string;

  @ApiPropertyOptional({
    description: 'School (tenant) identifier. Required when the handle exists across tenants.',
    example: 'green-valley',
  })
  @IsOptionalTenantSlug()
  tenantSlug?: string;
}

export class SessionExchangeDto {
  @ApiProperty({ description: 'Firebase ID token obtained on the client.' })
  @IsString()
  @IsNotEmpty()
  firebaseIdToken!: string;

  @ApiPropertyOptional({ example: 'green-valley' })
  @IsOptionalTenantSlug()
  tenantSlug?: string;
}

export class RefreshDto {
  // Optional: web clients carry the refresh token in an httpOnly cookie (empty body); mobile/API
  // clients send it here. The controller resolves it from the body or the cookie.
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  refreshToken?: string;
}

export class ChangePasswordDto {
  @ApiProperty({ description: 'Current password (or the temporary password on first login).' })
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @ApiProperty({ minLength: PASSWORD_MIN_LENGTH })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(200)
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_PATTERN_MESSAGE })
  newPassword!: string;

  @ApiPropertyOptional({
    description: 'Optional confirmation of newPassword. When supplied it must match.',
  })
  @IsOptional()
  @IsString()
  confirmPassword?: string;
}

export class RequestPasswordResetDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: 'green-valley' })
  @IsOptionalTenantSlug()
  tenantSlug?: string;
}

export class ConfirmPasswordResetDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({ minLength: PASSWORD_MIN_LENGTH })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(200)
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_PATTERN_MESSAGE })
  newPassword!: string;
}

export class TokenPairResponse {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty()
  refreshToken!: string;

  @ApiProperty({ description: 'Access token lifetime in seconds.' })
  expiresIn!: number;
}
