import { describe, expect, it } from 'vitest';
import { computeWeek } from './week';

describe('computeWeek', () => {
  it('computes a plain mid-DST week with no transition nearby (sanity baseline)', () => {
    // Monday 2026-06-01 12:05am EDT = 04:05 UTC
    const result = computeWeek(new Date('2026-06-01T04:05:00Z'));
    expect(result).toEqual({ weekStart: '2026-05-25', weekEnd: '2026-05-31' });
  });

  describe('spring forward 2026 (US clocks jump 2am -> 3am on Sunday 2026-03-08)', () => {
    it('on the Monday immediately BEFORE the transition (still EST, UTC-5)', () => {
      // Mon 2026-03-02 12:05am EST = 05:05 UTC
      const result = computeWeek(new Date('2026-03-02T05:05:00Z'));
      expect(result).toEqual({ weekStart: '2026-02-23', weekEnd: '2026-03-01' });
    });

    it('on the Monday immediately AFTER the transition (now EDT, UTC-4) -- the week that just ended straddles the DST change itself', () => {
      // Mon 2026-03-09 12:05am EDT = 04:05 UTC
      const result = computeWeek(new Date('2026-03-09T04:05:00Z'));
      expect(result).toEqual({ weekStart: '2026-03-02', weekEnd: '2026-03-08' });
    });

    it('one hour later on that same post-transition Monday (mirrors the monitor-agent 1:05am ET fire) still lands on the same week', () => {
      // Mon 2026-03-09 1:05am EDT = 05:05 UTC
      const result = computeWeek(new Date('2026-03-09T05:05:00Z'));
      expect(result).toEqual({ weekStart: '2026-03-02', weekEnd: '2026-03-08' });
    });
  });

  describe('fall back 2026 (US clocks drop 2am -> 1am on Sunday 2026-11-01)', () => {
    it('on the Monday immediately BEFORE the transition (still EDT, UTC-4)', () => {
      // Mon 2026-10-26 12:05am EDT = 04:05 UTC
      const result = computeWeek(new Date('2026-10-26T04:05:00Z'));
      expect(result).toEqual({ weekStart: '2026-10-19', weekEnd: '2026-10-25' });
    });

    it('on the Monday immediately AFTER the transition (now EST, UTC-5) -- the week that just ended straddles the DST change itself', () => {
      // Mon 2026-11-02 12:05am EST = 05:05 UTC
      const result = computeWeek(new Date('2026-11-02T05:05:00Z'));
      expect(result).toEqual({ weekStart: '2026-10-26', weekEnd: '2026-11-01' });
    });

    it('one hour later on that same post-transition Monday (mirrors the monitor-agent 1:05am ET fire) still lands on the same week', () => {
      // Mon 2026-11-02 1:05am EST = 06:05 UTC
      const result = computeWeek(new Date('2026-11-02T06:05:00Z'));
      expect(result).toEqual({ weekStart: '2026-10-26', weekEnd: '2026-11-01' });
    });
  });

  it('a mid-week manual run still computes the most recently completed Mon-Sun week, not the in-progress one', () => {
    // Wednesday 2026-07-15, mid-day ET
    const result = computeWeek(new Date('2026-07-15T18:00:00Z'));
    expect(result).toEqual({ weekStart: '2026-07-06', weekEnd: '2026-07-12' });
  });

  it('weekEnd is always exactly 6 days after weekStart (Mon-Sun span)', () => {
    const { weekStart, weekEnd } = computeWeek(new Date('2026-01-15T12:00:00Z'));
    const start = new Date(`${weekStart}T00:00:00Z`);
    const end = new Date(`${weekEnd}T00:00:00Z`);
    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBe(6);
  });
});
