import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TokenService } from './token.service';
import type { AuthenticatedUser } from '../auth.types';
import { Permission, RoleKey } from '@school/domain';

function makeService(): TokenService {
  const config = new ConfigService({
    NODE_ENV: 'test',
    JWT_ACCESS_SECRET: 'test-secret-test-secret',
    JWT_ACCESS_TTL: 900,
    JWT_REFRESH_TTL: 1000,
  });
  return new TokenService(new JwtService({}), config);
}

const principal: AuthenticatedUser = {
  userId: 'u1',
  tenantId: 't1',
  isPlatform: false,
  roles: [RoleKey.SchoolAdmin],
  permissions: [Permission.STUDENT_MANAGE],
};

describe('TokenService', () => {
  const service = makeService();

  it('signs and verifies an access token round-trip', () => {
    const { token } = service.signAccessToken(principal);
    const payload = service.verifyAccessToken(token);
    expect(payload.sub).toBe('u1');
    expect(payload.tid).toBe('t1');
    expect(payload.perms).toContain(Permission.STUDENT_MANAGE);
  });

  it('hashes refresh tokens deterministically and uniquely', () => {
    const a = service.generateRefreshToken();
    const b = service.generateRefreshToken();
    expect(a.token).not.toBe(b.token);
    expect(service.hashRefreshToken(a.token)).toBe(a.hash);
    expect(a.hash).not.toBe(b.hash);
  });

  it('rejects a tampered token', () => {
    const { token } = service.signAccessToken(principal);
    expect(() => service.verifyAccessToken(token + 'x')).toThrow();
  });
});
