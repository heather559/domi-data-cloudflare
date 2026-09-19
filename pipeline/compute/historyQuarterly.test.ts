import { describe, it, expect } from 'vitest';
import { planQuarterlyHistoryUpdate, applyQuarterlyHistoryUpdate, type QuarterlyHistory } from './historyQuarterly';

const prevHistory: QuarterlyHistory = {
  labels: ['Q1 2026', 'Q2 2026', 'Current'],
  p90: [4_800_000, 4_850_000, 4_900_000],
  p95: [7_000_000, 7_050_000, 7_100_000],
  p99: [18_000_000, 18_100_000, 18_200_000],
};

describe('planQuarterlyHistoryUpdate', () => {
  it('returns a null plan (first-ever run) when there is no prior history', () => {
    const plan = planQuarterlyHistoryUpdate(null, '2026-07-12');
    expect(plan.carriedForward).toBeNull();
    expect(plan.needsFetchForQuarter).toBeNull();
  });

  it('drops the trailing "Current" entry and detects no new quarter when the most recent completed quarter is already the last real entry', () => {
    // week_end 2026-07-12 -> most recently completed quarter is Q2 2026 (already last real entry after dropping "Current").
    const plan = planQuarterlyHistoryUpdate(prevHistory, '2026-07-12');
    expect(plan.carriedForward?.labels).toEqual(['Q1 2026', 'Q2 2026']);
    expect(plan.needsFetchForQuarter).toBeNull();
  });

  it('detects a newly-closed quarter and requests a fetch for it', () => {
    // week_end 2026-10-04 -> most recently completed quarter is Q3 2026, not yet in the carried-forward series.
    const plan = planQuarterlyHistoryUpdate(prevHistory, '2026-10-04');
    expect(plan.needsFetchForQuarter).toEqual({ label: 'Q3 2026', endDateForFetch: '2026-09-30' });
  });
});

describe('applyQuarterlyHistoryUpdate', () => {
  it('produces a minimal single-point object on a first-ever run', () => {
    const plan = planQuarterlyHistoryUpdate(null, '2026-07-12');
    const result = applyQuarterlyHistoryUpdate(plan, null, { luxury: 4_900_000, prime: 7_100_000, trophy: 18_200_000 });
    expect(result).toEqual({
      labels: ['Current'],
      p90: [4_900_000],
      p95: [7_100_000],
      p99: [18_200_000],
    });
  });

  it('refreshes only the Current tail when no new quarter closed', () => {
    const plan = planQuarterlyHistoryUpdate(prevHistory, '2026-07-12');
    const result = applyQuarterlyHistoryUpdate(plan, null, { luxury: 4_910_000, prime: 7_110_000, trophy: 18_210_000 });
    expect(result.labels).toEqual(['Q1 2026', 'Q2 2026', 'Current']);
    expect(result.p90).toEqual([4_800_000, 4_850_000, 4_910_000]);
  });

  it('appends a newly-fetched quarter before refreshing Current', () => {
    const plan = planQuarterlyHistoryUpdate(prevHistory, '2026-10-04');
    const result = applyQuarterlyHistoryUpdate(
      plan,
      { label: 'Q3 2026', p90: 4_950_000, p95: 7_150_000, p99: 18_300_000 },
      { luxury: 5_000_000, prime: 7_200_000, trophy: 18_400_000 },
    );
    expect(result.labels).toEqual(['Q1 2026', 'Q2 2026', 'Q3 2026', 'Current']);
    expect(result.p90).toEqual([4_800_000, 4_850_000, 4_950_000, 5_000_000]);
  });

  it('skips appending the new quarter if its fetch failed, but still refreshes Current', () => {
    const plan = planQuarterlyHistoryUpdate(prevHistory, '2026-10-04');
    const result = applyQuarterlyHistoryUpdate(plan, null, { luxury: 5_000_000, prime: 7_200_000, trophy: 18_400_000 });
    expect(result.labels).toEqual(['Q1 2026', 'Q2 2026', 'Current']);
    expect(result.p90).toEqual([4_800_000, 4_850_000, 5_000_000]);
  });
});
