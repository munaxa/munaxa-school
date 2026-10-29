import { ForbiddenException } from '@nestjs/common';

/**
 * How far a counted dimension (students, campuses, staff) may grow, decided before the unit of work
 * that grows it. `limit` is `null` when unlimited; `refusal` is the error to throw when it is
 * reached, built in advance so it can be thrown from inside a transaction without another lookup.
 *
 * The count is never part of it. A repository takes the dimension's per-tenant lock
 * (`lockScope`), counts and creates inside that one transaction, and calls {@link assertRoom} —
 * so two concurrent requests cannot both see room for the last place.
 */
export interface Capacity {
  readonly limit: number | null;
  readonly refusal: ForbiddenException | null;
}

export const UNLIMITED: Capacity = { limit: null, refusal: null };

/** Lock scopes, one per counted dimension. */
export const CAPACITY_SCOPE = {
  students: 'school:capacity:students',
  campuses: 'school:capacity:campuses',
  staff: 'school:capacity:staff',
} as const;

/** Throws the capacity's refusal when `current + additional` would pass its limit. */
export function assertRoom(capacity: Capacity, current: number, additional: number): void {
  if (capacity.limit !== null && current + additional > capacity.limit) {
    // Never pass for want of a message: a limit without its refusal still refuses.
    throw capacity.refusal ?? new ForbiddenException('Your plan does not allow adding more.');
  }
}
