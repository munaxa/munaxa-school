import {
  findCoveringLock,
  isDateLocked,
  isRangeUnlocked,
  lockCoversDate,
  type LockWindow,
} from './attendance-lock.logic';

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const marchLock: LockWindow = {
  periodStart: d('2026-03-01'),
  periodEnd: d('2026-03-31'),
  status: 'ACTIVE',
  campusId: null,
};

describe('attendance lock coverage', () => {
  it('covers dates inside the window, inclusive of both bounds', () => {
    expect(lockCoversDate(marchLock, d('2026-03-01'))).toBe(true);
    expect(lockCoversDate(marchLock, d('2026-03-15'))).toBe(true);
    expect(lockCoversDate(marchLock, d('2026-03-31'))).toBe(true);
  });

  it('does not cover dates outside the window', () => {
    expect(lockCoversDate(marchLock, d('2026-02-28'))).toBe(false);
    expect(lockCoversDate(marchLock, d('2026-04-01'))).toBe(false);
  });

  it('ignores the time component when comparing days', () => {
    expect(lockCoversDate(marchLock, new Date('2026-03-31T23:59:59.000Z'))).toBe(true);
  });

  it('never covers anything once released', () => {
    expect(lockCoversDate({ ...marchLock, status: 'RELEASED' }, d('2026-03-15'))).toBe(false);
  });

  it('applies a tenant-wide lock to every campus', () => {
    expect(lockCoversDate(marchLock, d('2026-03-15'), 'campus-a')).toBe(true);
  });

  it('applies a campus-scoped lock only to that campus', () => {
    const scoped: LockWindow = { ...marchLock, campusId: 'campus-a' };
    expect(lockCoversDate(scoped, d('2026-03-15'), 'campus-a')).toBe(true);
    expect(lockCoversDate(scoped, d('2026-03-15'), 'campus-b')).toBe(false);
    expect(lockCoversDate(scoped, d('2026-03-15'), null)).toBe(false);
  });

  it('finds the covering lock among many', () => {
    const locks = [
      { ...marchLock, periodStart: d('2026-01-01'), periodEnd: d('2026-01-31') },
      marchLock,
    ];
    expect(findCoveringLock(locks, d('2026-03-10'))).toBe(marchLock);
    expect(findCoveringLock(locks, d('2026-02-10'))).toBeNull();
    expect(isDateLocked(locks, d('2026-01-05'))).toBe(true);
  });

  it('detects any overlap when validating a range', () => {
    // Range fully inside the lock.
    expect(isRangeUnlocked([marchLock], d('2026-03-05'), d('2026-03-06'))).toBe(false);
    // Range straddling the lock start.
    expect(isRangeUnlocked([marchLock], d('2026-02-25'), d('2026-03-02'))).toBe(false);
    // Range entirely before the lock.
    expect(isRangeUnlocked([marchLock], d('2026-02-01'), d('2026-02-28'))).toBe(true);
  });

  it('treats a released lock as no obstacle to a range', () => {
    expect(
      isRangeUnlocked([{ ...marchLock, status: 'RELEASED' }], d('2026-03-05'), d('2026-03-06')),
    ).toBe(true);
  });
});
