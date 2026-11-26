import { staffPasswordSignIn } from './staff-password-sign-in';

describe('staffPasswordSignIn', () => {
  it('takes an explicit setting as it is', () => {
    expect(staffPasswordSignIn('enabled', 'production')).toBe('enabled');
    expect(staffPasswordSignIn('emergency', 'production')).toBe('emergency');
    expect(staffPasswordSignIn('disabled', 'development')).toBe('disabled');
  });

  it('defaults to Munaxa-only in production and to passwords elsewhere', () => {
    expect(staffPasswordSignIn(undefined, 'production')).toBe('disabled');
    expect(staffPasswordSignIn(undefined, 'development')).toBe('enabled');
    expect(staffPasswordSignIn('nonsense', 'production')).toBe('disabled');
  });
});
