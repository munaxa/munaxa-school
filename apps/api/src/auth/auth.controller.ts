import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './services/auth.service';
import { TokenService } from './services/token.service';
import { Public } from './decorators/public.decorator';
import { AllowDuringPasswordChange } from './decorators/allow-during-password-change.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { setAuthCookies, clearAuthCookies, refreshTokenFromCookie } from './cookies';
import type { AuthenticatedUser } from './auth.types';
import type { TokenPair } from './auth.types';
import { AllowInReadOnly } from '../subscription/allow-in-read-only.decorator';
import {
  LoginDto,
  SessionExchangeDto,
  RefreshDto,
  ChangePasswordDto,
  RequestPasswordResetDto,
  ConfirmPasswordResetDto,
} from './dto/auth.dto';

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokenService,
  ) {}

  private meta(req: Request) {
    return { ip: req.ip, userAgent: req.headers['user-agent'] };
  }

  /**
   * Set the httpOnly session cookies for the web admin. The token pair is still returned in the
   * body so mobile/API (Bearer) clients keep working — the web client simply ignores the body.
   */
  private issueCookies(res: Response, tokens: TokenPair): void {
    setAuthCookies(res, tokens, {
      accessTtl: this.tokens.accessTtl,
      refreshTtl: this.tokens.refreshTtl,
    });
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  // Brute-force protection: a tighter per-IP limit than the global throttle.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Local login (email + password) → token pair' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(dto, this.meta(req));
    this.issueCookies(res, result.tokens);
    return { ...result.tokens, mustChangePassword: result.mustChangePassword };
  }

  @Public()
  @Post('session')
  @HttpCode(200)
  // Same brute-force ceiling as local login for the credential-exchange path.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Exchange a Firebase ID token for a Munaxa token pair' })
  async session(
    @Body() dto: SessionExchangeDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.exchangeFirebaseSession(dto, this.meta(req));
    this.issueCookies(res, result.tokens);
    return { ...result.tokens, mustChangePassword: result.mustChangePassword };
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  // Legit clients refresh occasionally; cap abuse while leaving headroom for token rotation.
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Rotate a refresh token (with reuse detection)' })
  async refresh(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Web clients send the refresh token via httpOnly cookie; mobile/API send it in the body.
    const token = dto.refreshToken ?? refreshTokenFromCookie(req);
    if (!token) throw new BadRequestException('Missing refresh token');
    try {
      const tokens = await this.auth.refresh(token, this.meta(req));
      this.issueCookies(res, tokens);
      return tokens;
    } catch (err) {
      clearAuthCookies(res);
      throw err;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Revoke a refresh token family' })
  async logout(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = dto.refreshToken ?? refreshTokenFromCookie(req);
    if (token) await this.auth.logout(token);
    clearAuthCookies(res);
  }

  @Public()
  @Post('password/reset/request')
  @HttpCode(202)
  // Tight: a reset request emails the user — throttle to prevent mailbox-bombing and enumeration.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Request a password reset (always 202 to avoid enumeration)' })
  async requestReset(@Body() dto: RequestPasswordResetDto, @Req() req: Request) {
    await this.auth.requestPasswordReset(dto, this.meta(req));
  }

  @Public()
  @Post('password/reset/confirm')
  @HttpCode(204)
  // Tight: prevent brute-forcing the reset token.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Confirm a password reset with a token' })
  async confirmReset(@Body() dto: ConfirmPasswordResetDto, @Req() req: Request) {
    await this.auth.confirmPasswordReset(dto, this.meta(req));
  }

  @ApiBearerAuth()
  @AllowDuringPasswordChange()
  @AllowInReadOnly()
  @Post('password/change')
  @HttpCode(204)
  // Authenticated, but still throttle to blunt online guessing of the current password.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Change password (also clears the first-login flag)' })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ) {
    await this.auth.changePassword(user.userId, user.tenantId, dto, this.meta(req));
  }

  @ApiBearerAuth()
  @AllowDuringPasswordChange()
  @Get('me')
  @ApiOperation({ summary: 'Return the current principal (roles + permissions)' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.me(user.userId, user.tenantId);
  }
}
