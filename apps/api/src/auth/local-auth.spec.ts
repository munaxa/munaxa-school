import { NotFoundException, type ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { LocalAuthEnabledGuard, localAuthEnabled } from './local-auth';

describe("School's own sign-in switch (SC-07)", () => {
  it.each([
    ['development', undefined, true],
    ['test', undefined, true],
    ['production', undefined, false],
    ['production', 'enabled', true],
    ['production', 'disabled', false],
    ['development', 'disabled', false],
  ])('NODE_ENV=%s SCHOOL_LOCAL_AUTH=%s → %s', (nodeEnv, setting, expected) => {
    expect(localAuthEnabled({ NODE_ENV: nodeEnv, SCHOOL_LOCAL_AUTH: setting })).toBe(expected);
  });

  const guard = (values: Record<string, string>) =>
    new LocalAuthEnabledGuard({ get: (name: string) => values[name] } as unknown as ConfigService);

  it('answers 404 on local sign-in routes when it is off', () => {
    expect(() => guard({ NODE_ENV: 'production' }).canActivate({} as ExecutionContext)).toThrow(
      NotFoundException,
    );
  });

  it('lets them through when it is on', () => {
    expect(
      guard({ NODE_ENV: 'production', SCHOOL_LOCAL_AUTH: 'enabled' }).canActivate(
        {} as ExecutionContext,
      ),
    ).toBe(true);
  });
});
