import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomBytes, createHash } from 'node:crypto';
import type { AccessTokenPayload, AuthenticatedUser } from '../auth.types';

/**
 * Issues and verifies tokens.
 *  - Access tokens: short-lived JWT (HS256) carrying the principal + permissions.
 *  - Refresh tokens: opaque, high-entropy random strings; only their SHA-256 hash is
 *    persisted (see RefreshToken model). Rotation/reuse handling lives in AuthService.
 */
@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  private readonly accessSecret: string;
  readonly accessTtl: number;
  readonly refreshTtl: number;

  constructor(
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    const isProd = config.get<string>('NODE_ENV') === 'production';
    const secret = config.get<string>('JWT_ACCESS_SECRET');
    if (!secret && isProd) {
      throw new Error('JWT_ACCESS_SECRET must be set in production');
    }
    if (!secret) {
      this.logger.warn('JWT_ACCESS_SECRET not set — using an insecure development secret');
    }
    this.accessSecret = secret ?? 'dev-only-insecure-access-secret';
    this.accessTtl = Number(config.get('JWT_ACCESS_TTL') ?? 900);
    this.refreshTtl = Number(config.get('JWT_REFRESH_TTL') ?? 2_592_000);
  }

  signAccessToken(user: AuthenticatedUser): { token: string; expiresIn: number } {
    const payload: AccessTokenPayload = {
      sub: user.userId,
      tid: user.tenantId,
      plat: user.isPlatform,
      roles: user.roles,
      perms: user.permissions,
      ...(user.mustChangePassword ? { mcp: true } : {}),
    };
    const token = this.jwt.sign(payload, {
      secret: this.accessSecret,
      expiresIn: this.accessTtl,
    });
    return { token, expiresIn: this.accessTtl };
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    return this.jwt.verify<AccessTokenPayload>(token, { secret: this.accessSecret });
  }

  /** Generate an opaque refresh token and its storage hash. */
  generateRefreshToken(): { token: string; hash: string } {
    const token = randomBytes(48).toString('base64url');
    return { token, hash: this.hashRefreshToken(token) };
  }

  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  refreshExpiryDate(): Date {
    return new Date(Date.now() + this.refreshTtl * 1000);
  }
}
