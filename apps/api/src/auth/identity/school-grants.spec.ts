import { ALL_PERMISSIONS, Permission } from '@school/domain';
import {
  schoolGrantFor,
  schoolPermissionFrom,
  schoolPermissionsFrom,
  type DroppedGrant,
} from './school-grants';

describe('School grants from Identity', () => {
  it('maps every School permission and back, except the platform plane', () => {
    for (const permission of ALL_PERMISSIONS) {
      const read = schoolPermissionFrom(schoolGrantFor(permission));
      if (permission.startsWith('platform:') || permission === Permission.SUPPORT_IMPERSONATE) {
        expect(read).toEqual({ reason: 'platform-plane' });
      } else {
        expect(read).toEqual({ permission });
      }
    }
  });

  it.each([
    ['school:*', 'wildcard'],
    ['*', 'wildcard'],
    ['school:student:*', 'wildcard'],
    ['work:people:person:read', 'not-a-school-grant'],
    ['student:manage', 'not-a-school-grant'],
    ['school:Student:Manage', 'malformed'],
    ['school:student.manage', 'malformed'],
    ['school:', 'malformed'],
    ['school:student:destroy', 'not-a-declared-permission'],
    ['school:platform:tenant:manage', 'platform-plane'],
    ['school:support:impersonate', 'platform-plane'],
  ])('drops %s (%s)', (grant, reason) => {
    expect(schoolPermissionFrom(grant)).toEqual({ reason });
  });

  it('confers nothing for a perms claim that is not a list', () => {
    expect(schoolPermissionsFrom(undefined)).toEqual([]);
    expect(schoolPermissionsFrom('school:student:manage')).toEqual([]);
    expect(schoolPermissionsFrom({ 0: 'school:student:manage' })).toEqual([]);
  });

  it('keeps the declared School grants, reports the rest, and removes duplicates', () => {
    const dropped: DroppedGrant[] = [];
    const granted = schoolPermissionsFrom(
      [
        'school:student:manage',
        'school:student:manage',
        'work:leave:read',
        42,
        'school:*',
        'school:attendance:read',
      ],
      (d) => dropped.push(d),
    );
    expect(granted).toEqual([Permission.STUDENT_MANAGE, Permission.ATTENDANCE_READ]);
    expect(dropped.map((d) => d.reason)).toEqual(
      expect.arrayContaining(['not-a-school-grant', 'malformed', 'wildcard']),
    );
    expect(dropped.find((d) => d.reason === 'malformed')?.grant).toBe('<not a string>');
  });
});
