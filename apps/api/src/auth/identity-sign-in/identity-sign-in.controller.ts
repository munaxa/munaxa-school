import { Controller, ForbiddenException, Get, Query, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Public } from '../decorators/public.decorator';
import { AuthService } from '../services/auth.service';
import { TokenService } from '../services/token.service';
import { setAuthCookies } from '../cookies';
import { decodePending, encodePending } from './identity-sign-in';
import { IdentitySignInService } from './identity-sign-in.service';

/**
 * The browser's half of the flow between the start and Identity's answer: the state, nonce and
 * PKCE verifier. `httpOnly`, so a script never reads the verifier. `__Host-` in production, so
 * only this exact host can set it and a sibling host cannot plant a binding (login CSRF). `Lax`,
 * because the callback is a top-level navigation back from Identity, which a `Strict` cookie is
 * withheld from. Ten minutes, and spent at the callback whatever happens.
 */
const isProduction = (): boolean => process.env.NODE_ENV === 'production';
export const BINDING_COOKIE = (): string =>
  isProduction() ? '__Host-munaxa_identity' : 'munaxa_identity';
const BINDING_TTL_MS = 10 * 60 * 1_000;

const bindingOptions = () => ({
  httpOnly: true,
  secure: isProduction(),
  sameSite: 'lax' as const,
  path: '/',
});

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
   * Whether the sign-in page shows "Sign in with Munaxa" at all. Deployment-wide on purpose: a
   * per-school answer would tell anyone which school codes exist.
   */
  @Public()
  @Get('enabled')
  enabled(): { enabled: boolean } {
    return { enabled: this.identity.enabled };
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
      ...bindingOptions(),
      maxAge: BINDING_TTL_MS,
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
    res.clearCookie(BINDING_COOKIE(), bindingOptions());

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
