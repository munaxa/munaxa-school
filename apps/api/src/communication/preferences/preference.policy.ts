import type {
  NotificationCategory,
  NotificationChannel,
  NotificationPreference,
} from '@prisma/client';

/**
 * Pure preference-resolution logic (no I/O — unit-testable). Decides whether a given
 * (category, channel) is allowed for a user, honouring the tenant kill-switches and the
 * mandatory-override rule.
 *
 * Resolution order:
 *   1. tenant kill-switch (settings.{push,email}Enabled) is absolute.
 *   2. mandatory events bypass user preferences (school-enforced).
 *   3. otherwise the user's global toggle AND the category-channel toggle must both be on.
 *      A missing preference row means opt-in (defaults to allowed).
 */
export function channelAllowed(params: {
  channel: NotificationChannel;
  category: NotificationCategory;
  mandatory: boolean;
  tenant: { pushEnabled: boolean; emailEnabled: boolean };
  preference?: NotificationPreference | null;
}): boolean {
  const { channel, category, mandatory, tenant, preference } = params;

  if (channel === 'IN_APP') return true; // in-app feed is always written

  // 1. Tenant kill-switch.
  if (channel === 'PUSH' && !tenant.pushEnabled) return false;
  if (channel === 'EMAIL' && !tenant.emailEnabled) return false;

  // 2. Mandatory bypasses user prefs.
  if (mandatory) return true;

  // 3. User preferences (missing row = opt-in).
  if (!preference) return true;

  if (channel === 'PUSH' && !preference.pushEnabled) return false;
  if (channel === 'EMAIL' && !preference.emailEnabled) return false;

  const field = categoryField(category, channel);
  return Boolean(preference[field]);
}

function categoryField(
  category: NotificationCategory,
  channel: NotificationChannel,
): keyof NotificationPreference {
  const suffix = channel === 'EMAIL' ? 'Email' : 'Push';
  switch (category) {
    case 'ATTENDANCE':
      return `attendance${suffix}` as const;
    case 'FINANCE':
      return `finance${suffix}` as const;
    case 'ACADEMIC':
      return `academic${suffix}` as const;
    case 'BEHAVIOR':
      return `behavior${suffix}` as const;
    case 'ANNOUNCEMENT':
      return `announcement${suffix}` as const;
    case 'SYSTEM':
    default:
      return `system${suffix}` as const;
  }
}
