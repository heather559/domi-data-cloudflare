import { describe, expect, it } from 'vitest';
import { pct } from './pct';

describe('pct', () => {
  it('computes a percentage-scale ratio (not a 0-1 fraction)', () => {
    // e.g. this-week vs 52-week-avg delta of +7 over a baseline of 20 => 35.0%
    expect(pct(7, 20)).toBe(35);
  });

  it('computes a genuine week-over-week delta pattern (current - previous, previous)', () => {
    const current = 27;
    const previous = 20;
    expect(pct(current - previous, previous)).toBe(35);
  });

  it('supports negative deltas', () => {
    expect(pct(-5, 20)).toBe(-25);
  });

  it('returns null when the denominator is exactly 0', () => {
    expect(pct(10, 0)).toBeNull();
  });

  it('returns null when the denominator is null', () => {
    expect(pct(10, null)).toBeNull();
  });

  it('returns null when the denominator is undefined', () => {
    expect(pct(10, undefined)).toBeNull();
  });

  it('returns null when the numerator is null', () => {
    expect(pct(null, 20)).toBeNull();
  });

  it('returns null when the numerator is undefined', () => {
    expect(pct(undefined, 20)).toBeNull();
  });

  it('returns null for NaN inputs rather than fabricating a value', () => {
    expect(pct(Number.NaN, 20)).toBeNull();
    expect(pct(10, Number.NaN)).toBeNull();
  });

  it('returns 0 for a zero numerator over a valid denominator (a real, valid zero-change reading)', () => {
    expect(pct(0, 20)).toBe(0);
  });
});
