import { Controller, ForbiddenException, Get, Query, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Public } from '../decorators/public.decorator';
import { AuthService, IdentityMfaRequiredException } from '../services/auth.service';
import { TokenService } from '../services/token.service';
import { setAuthCookies } from '../cookies';
import { decodePending, encodePending } from './identity-sign-in';
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

  /** `GET /api/v1/auth/identity/start?school=<school code>`: off to Identity, or back to sign-in. */
  @Public()
  @Get('start')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  start(@Query('school') school: unknown, @Res() res: Response): void {
    const started = typeof school === 'string' ? this.identity.start(school) : null;
    if (started === null) {
      seeOther(res, `${LOGIN}?identity=unavailable`);
      return;
    }
    res.cookie(BINDING_COOKIE(), encodePending(started.pending), {
      ...identityCookieOptions(),
      maxAge: IDENTITY_COOKIE_TTL_MS,
    });
    seeOther(res, started.url);
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

    const completed = await this.identity.complete(pending, query);
    if (!completed.ok) {
      seeOther(res, `${LOGIN}?identity=failed`);
      return;
    }
    try {
      const result = await this.auth.signInWithIdentity(
        { ...completed.claims, school: completed.school },
        { ip: req.ip, userAgent: req.headers['user-agent'] },
      );
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
        seeOther(res, `${LOGIN}?identity=mfa-required`);
        return;
      }
      seeOther(
        res,
        `${LOGIN}?identity=${error instanceof ForbiddenException ? 'blocked' : 'no-account'}`,
      );
    }
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
