import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Reflector } from '@nestjs/core';
import { mintEs256, testSigningKey } from '../../../test/identity-keys';
import type { AuthenticatedUser } from '../auth.types';
import type { IdentityAuthenticationService } from '../identity/identity-authentication.service';
import type { TokenService } from '../services/token.service';
import { JwtAuthGuard } from './jwt-auth.guard';

const key = testSigningKey('id-1');
const identityToken = mintEs256(key, { sub: 'usr', tid: 'org', sid: 'ses', exp: 1 });
// The shape of School's own token: an HS256 header.
const schoolToken = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.e30.sig`;

const identityPrincipal: AuthenticatedUser = {
  userId: 'u-identity',
  tenantId: 't-1',
  isPlatform: false,
  roles: [],
  permissions: [],
  authSource: 'identity',
};

const build = (options: { local: 'enabled' | 'disabled'; identity: boolean }) => {
  const tokens = {
    verifyAccessToken: jest.fn(() => ({
      sub: 'u-local',
      tid: 't-1',
      plat: false,
      roles: ['SchoolAdmin'],
      perms: [],
    })),
  };
  const identity = {
    enabled: options.identity,
    algorithm: options.identity ? 'ES256' : undefined,
    authenticate: jest.fn((_token: string) =>
      Promise.resolve<AuthenticatedUser | undefined>(identityPrincipal),
    ),
  };
  const config = {
    get: (name: string) => ({ NODE_ENV: 'production', SCHOOL_LOCAL_AUTH: options.local })[name],
  };
  const reflector = { getAllAndOverride: () => false };
  const guard = new JwtAuthGuard(
    reflector as unknown as Reflector,
    tokens as unknown as TokenService,
    identity as unknown as IdentityAuthenticationService,
    config as unknown as ConfigService,
  );
  return { guard, tokens, identity };
};

const contextWith = (request: Record<string, unknown>): ExecutionContext =>
  ({
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  }) as unknown as ExecutionContext;

const bearer = (token: string) => ({ headers: { authorization: `Bearer ${token}` }, cookies: {} });

describe('JwtAuthGuard', () => {
  it('sends an ES256 bearer token to Identity only, and attaches its principal', async () => {
    const { guard, tokens, identity } = build({ local: 'enabled', identity: true });
    const request = bearer(identityToken) as Record<string, unknown>;
    await expect(guard.canActivate(contextWith(request))).resolves.toBe(true);
    expect(identity.authenticate).toHaveBeenCalledWith(identityToken);
    expect(tokens.verifyAccessToken).not.toHaveBeenCalled();
    expect(request.user).toBe(identityPrincipal);
  });

  it('answers 401 when Identity refuses, without trying the token as a School token', async () => {
    const { guard, tokens, identity } = build({ local: 'enabled', identity: true });
    identity.authenticate.mockResolvedValueOnce(undefined);
    await expect(guard.canActivate(contextWith(bearer(identityToken)))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(tokens.verifyAccessToken).not.toHaveBeenCalled();
  });

  it('refuses School tokens, by header and by cookie, when School sign-in is disabled', async () => {
    const { guard, tokens } = build({ local: 'disabled', identity: true });
    await expect(guard.canActivate(contextWith(bearer(schoolToken)))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(
      guard.canActivate(contextWith({ headers: {}, cookies: { munaxa_at: schoolToken } })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(tokens.verifyAccessToken).not.toHaveBeenCalled();
  });

  it('accepts School tokens beside Identity when School sign-in is enabled', async () => {
    const { guard, identity } = build({ local: 'enabled', identity: true });
    const request = bearer(schoolToken) as Record<string, unknown>;
    await expect(guard.canActivate(contextWith(request))).resolves.toBe(true);
    expect(identity.authenticate).not.toHaveBeenCalled();
    expect((request.user as AuthenticatedUser).authSource).toBe('local');
  });

  it('never routes to Identity when it is not configured', async () => {
    const { guard, identity, tokens } = build({ local: 'enabled', identity: false });
    tokens.verifyAccessToken.mockImplementationOnce(() => {
      throw new Error('invalid signature');
    });
    await expect(guard.canActivate(contextWith(bearer(identityToken)))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(identity.authenticate).not.toHaveBeenCalled();
  });

  it('does not read an Identity token from the School session cookie', async () => {
    const { guard, identity, tokens } = build({ local: 'enabled', identity: true });
    tokens.verifyAccessToken.mockImplementationOnce(() => {
      throw new Error('invalid algorithm');
    });
    await expect(
      guard.canActivate(contextWith({ headers: {}, cookies: { munaxa_at: identityToken } })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(identity.authenticate).not.toHaveBeenCalled();
  });
});
