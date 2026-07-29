import type { NotificationPreference } from '@prisma/client';
import { channelAllowed } from './preference.policy';

const tenantOn = { pushEnabled: true, emailEnabled: true };

function pref(overrides: Partial<NotificationPreference> = {}): NotificationPreference {
  return {
    id: 'p',
    tenantId: 't',
    userId: 'u',
    pushEnabled: true,
    emailEnabled: true,
    attendancePush: true,
    attendanceEmail: true,
    financePush: true,
    financeEmail: true,
    academicPush: true,
    academicEmail: true,
    behaviorPush: true,
    behaviorEmail: true,
    announcementPush: true,
    announcementEmail: true,
    systemPush: true,
    systemEmail: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('channelAllowed — preference resolution', () => {
  it('always writes the in-app channel', () => {
    expect(
      channelAllowed({
        channel: 'IN_APP',
        category: 'FINANCE',
        mandatory: false,
        tenant: { pushEnabled: false, emailEnabled: false },
        preference: pref({ pushEnabled: false, emailEnabled: false }),
      }),
    ).toBe(true);
  });

  it('tenant kill-switch blocks the channel for everyone', () => {
    expect(
      channelAllowed({
        channel: 'PUSH',
        category: 'FINANCE',
        mandatory: false,
        tenant: { pushEnabled: false, emailEnabled: true },
        preference: pref(),
      }),
    ).toBe(false);
  });

  it('mandatory events bypass user prefs but honour the tenant kill-switch', () => {
    expect(
      channelAllowed({
        channel: 'EMAIL',
        category: 'SYSTEM',
        mandatory: true,
        tenant: tenantOn,
        preference: pref({ emailEnabled: false, systemEmail: false }),
      }),
    ).toBe(true);

    expect(
      channelAllowed({
        channel: 'EMAIL',
        category: 'SYSTEM',
        mandatory: true,
        tenant: { pushEnabled: true, emailEnabled: false },
        preference: pref(),
      }),
    ).toBe(false);
  });

  it('missing preference row defaults to opt-in', () => {
    expect(
      channelAllowed({
        channel: 'PUSH',
        category: 'ATTENDANCE',
        mandatory: false,
        tenant: tenantOn,
        preference: null,
      }),
    ).toBe(true);
  });

  it('respects the per-category toggle', () => {
    expect(
      channelAllowed({
        channel: 'EMAIL',
        category: 'FINANCE',
        mandatory: false,
        tenant: tenantOn,
        preference: pref({ financeEmail: false }),
      }),
    ).toBe(false);

    expect(
      channelAllowed({
        channel: 'EMAIL',
        category: 'ACADEMIC',
        mandatory: false,
        tenant: tenantOn,
        preference: pref({ financeEmail: false }),
      }),
    ).toBe(true);
  });

  it('respects the user global channel toggle', () => {
    expect(
      channelAllowed({
        channel: 'PUSH',
        category: 'ACADEMIC',
        mandatory: false,
        tenant: tenantOn,
        preference: pref({ pushEnabled: false }),
      }),
    ).toBe(false);
  });
});
