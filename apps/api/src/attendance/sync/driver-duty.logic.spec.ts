import { resolveDriverDuty } from './driver-duty.logic';

describe('driver duty resolution', () => {
  it('reports a present driver as on duty with no impact', () => {
    const r = resolveDriverDuty('PRESENT');
    expect(r.status).toBe('ON_DUTY');
    expect(r.needsReplacement).toBe(false);
    expect(r.affectedLegs).toEqual([]);
  });

  it('flags only the morning leg when the driver is late', () => {
    const r = resolveDriverDuty('LATE');
    expect(r.status).toBe('LATE');
    expect(r.affectedLegs).toEqual(['MORNING']);
    expect(r.needsReplacement).toBe(false);
  });

  it('flags only the afternoon leg on early departure', () => {
    expect(resolveDriverDuty('EARLY_DEPARTURE').affectedLegs).toEqual(['AFTERNOON']);
  });

  it('requires a replacement for both legs when absent', () => {
    const r = resolveDriverDuty('ABSENT');
    expect(r.status).toBe('UNAVAILABLE');
    expect(r.needsReplacement).toBe(true);
    expect(r.affectedLegs).toEqual(['MORNING', 'AFTERNOON']);
  });

  it('treats approved leave like an absence for route planning', () => {
    const r = resolveDriverDuty('ON_LEAVE');
    expect(r.needsReplacement).toBe(true);
    expect(r.reason).toBe('transport.driver.onLeave');
  });

  it('does not raise a replacement need on a holiday (no service)', () => {
    const r = resolveDriverDuty('HOLIDAY');
    expect(r.needsReplacement).toBe(false);
    expect(r.affectedLegs).toEqual([]);
  });

  it('never mutates the shared legs array between calls', () => {
    const a = resolveDriverDuty('ABSENT');
    a.affectedLegs.pop();
    expect(resolveDriverDuty('ABSENT').affectedLegs).toEqual(['MORNING', 'AFTERNOON']);
  });
});
