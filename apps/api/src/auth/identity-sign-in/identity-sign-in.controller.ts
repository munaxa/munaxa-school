import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Public } from '../decorators/public.decorator';
import { AuthService, IdentityMfaRequiredException } from '../services/auth.service';
import { TokenService } from '../services/token.service';
import { setAuthCookies } from '../cookies';
import { decodePending, encodePending, isAppChallenge } from './identity-sign-in';
import { appReturn, openHandoff, sealHandoff } from './identity-app-handoff';
import { BINDING_COOKIE, IDENTITY_COOKIE_TTL_MS, identityCookieOptions } from './identity-cookies';
import { IdentitySignInService } from './identity-sign-in.service';

/** Where the admin shows the outcome. Relative, so it never depends on the request's Host. */
const LOGIN = '/login';

@ApiExcludeController()
@Controller({ path: 'auth/identity', version: '1' })
export class IdentitySignInController {
  constructor(
    private readonly identity: IdentitySignInService,
    private readonly auth: AuthService,
    private readonly tokens: TokenService,
  ) {}

  /**
   * Whether the sign-in page shows "Sign in with Munaxa", and whether it also shows the staff
   * password form. Deployment-wide on purpose: a per-school answer would tell anyone which school
   * codes exist.
   */
  @Public()
  @Get('enabled')
  enabled(): { enabled: boolean; staffPasswords: string } {
    return { enabled: this.identity.enabled, staffPasswords: this.identity.staffPasswords };
  }

  /**
   * `GET /api/v1/auth/identity/start?school=<school code>`: off to Identity, or back to sign-in.
   * A School mobile app adds `&app=<its PKCE challenge, S256>` (identity-app-handoff.ts).
   */
  @Public()
  @Get('start')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  start(@Query('school') school: unknown, @Query('app') app: unknown, @Res() res: Response): void {
    const fromApp = app !== undefined;
    if (fromApp && (!isAppChallenge(app) || !this.identity.appsEnabled)) {
      if (!this.backToApp(res, { error: 'unavailable' })) {
        seeOther(res, `${LOGIN}?identity=unavailable`);
      }
      return;
    }
    const started =
      typeof school === 'string' ? this.identity.start(school, fromApp ? app : undefined) : null;
    if (started === null) {
      if (!fromApp || !this.backToApp(res, { error: 'unavailable' })) {
        seeOther(res, `${LOGIN}?identity=unavailable`);
      }
      return;
    }
    res.cookie(BINDING_COOKIE(), encodePending(started.pending), {
      ...identityCookieOptions(),
      maxAge: IDENTITY_COOKIE_TTL_MS,
    });
    seeOther(res, started.url);
  }

  /**
   * `POST /api/v1/auth/identity/app-session`: a mobile app redeems its hand-off with its PKCE
   * verifier for a School token pair. Redeeming rotates the refresh token inside the hand-off, so
   * a hand-off works once; a second try is refresh-token reuse and ends that session.
   */
  @Public()
  @Post('app-session')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async appSession(
    @Body() body: { handoff?: unknown; verifier?: unknown },
    @Req() req: Request,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    mustChangePassword: boolean;
  }> {
    const key = this.identity.appHandoffKey;
    const opened =
      key === null ? null : openHandoff(key, body?.handoff, body?.verifier, Date.now());
    if (opened === null || !opened.ok) throw new UnauthorizedException('Sign in again');
    const tokens = await this.auth.refresh(opened.refreshToken, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return { ...tokens, mustChangePassword: opened.mustChangePassword };
  }

  /** `GET /api/v1/auth/identity/callback`: IDENTITY_SIGN_IN_REDIRECT_URI, registered in Identity. */
  @Public()
  @Get('callback')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async callback(
    @Query() query: Record<string, unknown>,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const cookies = (req.cookies ?? {}) as Record<string, string | undefined>;
    const pending = decodePending(cookies[BINDING_COOKIE()]);
    res.clearCookie(BINDING_COOKIE(), identityCookieOptions());

    const app = pending?.app;
    const fail = (outcome: string): void => {
      if (app === undefined || !this.backToApp(res, { error: outcome })) {
        seeOther(res, `${LOGIN}?identity=${outcome}`);
      }
    };

    const completed = await this.identity.complete(pending, query);
    if (!completed.ok) {
      fail('failed');
      return;
    }
    try {
      const result = await this.auth.signInWithIdentity(
        { ...completed.claims, school: completed.school },
        { ip: req.ip, userAgent: req.headers['user-agent'] },
      );
      if (app !== undefined && this.identity.appHandoffKey !== null) {
        // A mobile app: no web cookies. The app redeems the sealed hand-off with its verifier.
        const handoff = sealHandoff(
          this.identity.appHandoffKey,
          {
            refreshToken: result.tokens.refreshToken,
            challenge: app,
            mustChangePassword: result.mustChangePassword,
          },
          Date.now(),
        );
        this.backToApp(res, { handoff });
        return;
      }
      setAuthCookies(res, result.tokens, {
        accessTtl: this.tokens.accessTtl,
        refreshTtl: this.tokens.refreshTtl,
      });
      // The session cookies are SameSite=Strict, and a redirect chain that began on Identity is
      // still cross-site, so the browser would withhold them from a 303's target. A page on this
      // origin that moves on by itself makes the next navigation same-site.
      continueTo(res, result.mustChangePassword ? '/change-password' : '/');
    } catch (error) {
      if (error instanceof IdentityMfaRequiredException) {
        // Someone who can administer the school signs in with Identity's two-step verification.
        fail('mfa-required');
        return;
      }
      fail(error instanceof ForbiddenException ? 'blocked' : 'no-account');
    }
  }

  /** Back to the mobile app's registered address. False when no app address is configured. */
  private backToApp(res: Response, params: Record<string, string>): boolean {
    const redirect = this.identity.appRedirectUri;
    if (redirect === null) return false;
    seeOther(res, appReturn(redirect, params));
    return true;
  }
}

const seeOther = (res: Response, location: string): void => {
  res.setHeader('Cache-Control', 'no-store');
  res.redirect(303, location);
};

const continueTo = (res: Response, path: '/' | '/change-password'): void => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res
    .status(200)
    .type('html')
    .send(
      `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${path}"><title>Munaxa</title></head><body><a href="${path}">Continue</a></body></html>`,
    );
};
