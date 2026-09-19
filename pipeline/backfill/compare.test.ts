import { describe, it, expect } from 'vitest';
import { comparePayloads, summarizeDiffs } from './compare';

describe('comparePayloads', () => {
  it('marks identical primitives as exact', () => {
    const diffs = comparePayloads({ a: 1, b: 'x' }, { a: 1, b: 'x' });
    expect(diffs.every((d) => d.status === 'exact')).toBe(true);
  });

  it('marks numbers within tolerance as close, not mismatch', () => {
    const diffs = comparePayloads({ a: 100 }, { a: 101 }); // 0.99% relative diff
    expect(diffs[0].status).toBe('close');
  });

  it('marks numbers far apart as mismatch', () => {
    const diffs = comparePayloads({ a: 100 }, { a: 200 });
    expect(diffs[0].status).toBe('mismatch');
  });

  it('treats both-null as exact and one-null as mismatch', () => {
    expect(comparePayloads({ a: null }, { a: null })[0].status).toBe('exact');
    expect(comparePayloads({ a: null }, { a: 5 })[0].status).toBe('mismatch');
  });

  it('diffs arrays element-wise and flags length mismatches separately', () => {
    const diffs = comparePayloads({ a: [1, 2, 3] }, { a: [1, 2] });
    const lengthDiff = diffs.find((d) => d.path.endsWith('.length'));
    expect(lengthDiff?.status).toBe('mismatch');
  });

  it('recurses through nested objects with dotted paths', () => {
    const diffs = comparePayloads({ hero: { luxury_count: 10 } }, { hero: { luxury_count: 12 } });
    expect(diffs[0].path).toBe('$.hero.luxury_count');
  });

  it('flags type mismatches distinctly', () => {
    const diffs = comparePayloads({ a: 5 }, { a: 'five' });
    expect(diffs[0].status).toBe('type_mismatch');
  });
});

describe('summarizeDiffs', () => {
  it('buckets counts correctly', () => {
    const diffs = comparePayloads({ a: 1, b: 100, c: 5 }, { a: 1, b: 200, c: null });
    const summary = summarizeDiffs(diffs);
    expect(summary.exact).toBe(1);
    expect(summary.mismatch).toBeGreaterThanOrEqual(1);
    expect(summary.mismatches.length).toBe(summary.mismatch + summary.missing + summary.typeMismatch);
  });
});
