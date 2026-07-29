import { PriorityEngine } from './priority.engine';

describe('PriorityEngine — channel selection & escalation', () => {
  const engine = new PriorityEngine();

  it('CRITICAL → push + email immediately', () => {
    expect(engine.channelsFor('CRITICAL').sort()).toEqual(['EMAIL', 'PUSH']);
  });

  it('HIGH → push first, escalates to email on unread', () => {
    expect(engine.channelsFor('HIGH')).toEqual(['PUSH']);
    expect(engine.escalatesOnUnread('HIGH')).toBe(true);
  });

  it('NORMAL → push only, no escalation', () => {
    expect(engine.channelsFor('NORMAL')).toEqual(['PUSH']);
    expect(engine.escalatesOnUnread('NORMAL')).toBe(false);
  });

  it('LOW → email only', () => {
    expect(engine.channelsFor('LOW')).toEqual(['EMAIL']);
    expect(engine.escalatesOnUnread('LOW')).toBe(false);
  });
});
