import { describe, it, expect } from 'vitest';
import { computeStep1 } from './hero';
import type { LuxuryContractStatsResponse, ContractPeriodEntry } from '../fetch/schemas';
import { EMPTY_PRIOR_WEEK } from './types';

/** Builds a minimal contractsByPeriod entry with sensible defaults. */
function entry(date: string, overrides: Partial<ContractPeriodEntry> = {}): ContractPeriodEntry {
  return {
    date,
    contractCount: 10,
    totalPrice: 50_000_000,
    medianPrice: 5_000_000,
    ppsf: 2000,
    avgDaysOnMarket: 150,
    ...overrides,
  };
}

/** Builds 30 weekly entries dated 2026-02-02..2026-08-24 (Mondays), so lastN(26) has a clean, predictable slice, with the last entry aligned to week_start. */
function buildSeries(weekStart: string, count: number, valueFn: (i: number) => Partial<ContractPeriodEntry>): ContractPeriodEntry[] {
  const start = new Date(weekStart + 'T00:00:00Z');
  const out: ContractPeriodEntry[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() - (count - 1 - i) * 7);
    const iso = d.toISOString().slice(0, 10);
    out.push(entry(iso, valueFn(i)));
  }
  return out;
}

function buildLux52(weekStart: string): LuxuryContractStatsResponse {
  const p90Series = buildSeries(weekStart, 30, (i) => ({ contractCount: 10 + i, totalPrice: 50_000_000 + i * 1_000_000 }));
  const p95Series = buildSeries(weekStart, 30, (i) => ({ contractCount: 5 + i, totalPrice: 30_000_000 }));
  const p99Series = buildSeries(weekStart, 30, (i) => ({ contractCount: 2, totalPrice: 10_000_000 }));
  return {
    lines: {
      p90: { cutoff: 4_800_000, count: 1000, contractsByPeriod: p90Series },
      p95: { cutoff: 7_000_000, count: 500, contractsByPeriod: p95Series },
      p99: { cutoff: 18_000_000, count: 100, contractsByPeriod: p99Series },
    },
    history: {
      p90: [
        { year: 2020, cutoff: 999 },
        { year: 2021, cutoff: 4_000_000 },
        { year: 2022, cutoff: 4_200_000 },
      ],
      p95: [
        { year: 2021, cutoff: 6_000_000 },
        { year: 2022, cutoff: 6_200_000 },
      ],
      p99: [
        { year: 2021, cutoff: 14_000_000 },
        { year: 2022, cutoff: 14_500_000 },
      ],
    },
  };
}

describe('computeStep1', () => {
  const weekStart = '2026-08-24';

  it('returns the all-null/empty failure shape when lux52 is null', () => {
    const result = computeStep1(null, null, EMPTY_PRIOR_WEEK, weekStart);
    expect(result.hero.luxury_cutoff).toBeNull();
    expect(result.hero.luxury_count).toBeNull();
    expect(result.demandTrend.counts).toEqual([]);
    expect(result.historyAnnual.years).toEqual([]);
    expect(result.tierCards.luxury.cutoff).toBeNull();
  });

  it('maps hero fields from the week-aligned p90/p95/p99 entries', () => {
    const lux52 = buildLux52(weekStart);
    const result = computeStep1(lux52, null, EMPTY_PRIOR_WEEK, weekStart);

    // Last entry (index 29) of the 30-entry series is the week_start-aligned one.
    expect(result.hero.luxury_cutoff).toBe(4_800_000);
    expect(result.hero.prime_cutoff).toBe(7_000_000);
    expect(result.hero.trophy_cutoff).toBe(18_000_000);
    expect(result.hero.luxury_count).toBe(10 + 29); // 39
    expect(result.hero.luxury_volume).toBe(50_000_000 + 29_000_000); // 79M
    expect(result.hero.prime_count).toBe(5 + 29); // 34
    expect(result.hero.trophy_count).toBe(2);
    expect(result.hero.avg_dom).toBe(150);
    expect(result.hero.median_price).toBe(5_000_000);
  });

  it('computes luxury_count_wow_pct against the full-series average, not just last 26', () => {
    const lux52 = buildLux52(weekStart);
    const result = computeStep1(lux52, null, EMPTY_PRIOR_WEEK, weekStart);

    const counts = Array.from({ length: 30 }, (_, i) => 10 + i);
    const avg52 = counts.reduce((a, b) => a + b, 0) / 30;
    const expectedPct = ((39 - avg52) / avg52) * 100;

    expect(result.hero.luxury_count_avg52).toBeCloseTo(avg52, 6);
    expect(result.hero.luxury_count_wow_pct).toBeCloseTo(expectedPct, 6);
  });

  it('computes vs_lastweek_pct from prior week hero values, null when absent', () => {
    const lux52 = buildLux52(weekStart);
    const withPrior = computeStep1(lux52, null, { ...EMPTY_PRIOR_WEEK, prevLuxuryCount: 30, prevLuxuryVolume: 70_000_000 }, weekStart);
    // luxury_count = 39, prev = 30 -> (39-30)/30*100 = 30
    expect(withPrior.hero.luxury_count_vs_lastweek_pct).toBeCloseTo(30, 6);
    // luxury_volume = 79M, prev = 70M -> (79-70)/70*100 ≈ 12.857
    expect(withPrior.hero.luxury_volume_vs_lastweek_pct).toBeCloseTo(((79_000_000 - 70_000_000) / 70_000_000) * 100, 6);

    const withoutPrior = computeStep1(lux52, null, EMPTY_PRIOR_WEEK, weekStart);
    expect(withoutPrior.hero.luxury_count_vs_lastweek_pct).toBeNull();
  });

  it('computes tier cleared_52wk/volume_52wk/ppsf_avg and their wow deltas against prevTiers', () => {
    const lux52 = buildLux52(weekStart);
    const prevTierCard = {
      cutoff: 4_700_000,
      cutoff_wow_pct: null,
      cutoff_yoy_pct: null,
      ppsf_avg: 1900,
      ppsf_avg_wow_pct: null,
      ppsf_avg_yoy_pct: null,
      cleared_52wk: 900,
      cleared_52wk_wow_pct: null,
      cleared_52wk_yoy_pct: null,
      volume_52wk: 1_000_000_000,
      volume_52wk_wow_pct: null,
      volume_52wk_yoy_pct: null,
    };
    const result = computeStep1(
      lux52,
      null,
      { ...EMPTY_PRIOR_WEEK, prevTiers: { luxury: prevTierCard, prime: prevTierCard, trophy: prevTierCard } },
      weekStart,
    );

    expect(result.tierCards.luxury.cleared_52wk).toBe(1000); // readTierCount() -> `count`
    expect(result.tierCards.luxury.cutoff_wow_pct).toBeCloseTo(((4_800_000 - 4_700_000) / 4_700_000) * 100, 6);
    expect(result.tierCards.luxury.ppsf_avg).toBe(2000); // constant across the fixture series
    expect(result.tierCards.luxury.ppsf_avg_wow_pct).toBeCloseTo(((2000 - 1900) / 1900) * 100, 6);
    expect(result.tierCards.luxury.cleared_52wk_wow_pct).toBeCloseTo(((1000 - 900) / 900) * 100, 6);

    const expectedVolume52wk = Array.from({ length: 30 }, (_, i) => 50_000_000 + i * 1_000_000).reduce((a, b) => a + b, 0);
    expect(result.tierCards.luxury.volume_52wk).toBe(expectedVolume52wk);
    expect(result.tierCards.luxury.volume_52wk_wow_pct).toBeCloseTo(((expectedVolume52wk - 1_000_000_000) / 1_000_000_000) * 100, 6);
  });

  it('computes yoy fields from lux52PriorYr, null when it is missing', () => {
    const lux52 = buildLux52(weekStart);
    const priorYr = buildLux52(weekStart); // reuse shape; last entry acts as "same week last year"
    const result = computeStep1(lux52, priorYr, EMPTY_PRIOR_WEEK, weekStart);

    // priorYr's own last p90 entry (index 29): contractCount 39, totalPrice 79M -- identical to `lux52` since we reused buildLux52.
    expect(result.hero.luxury_count_yoy_pct).toBeCloseTo(0, 6); // (39-39)/39*100 = 0
    expect(result.hero.luxury_volume_yoy_pct).toBeCloseTo(0, 6);
    expect(result.tierCards.luxury.cutoff_yoy_pct).toBeCloseTo(0, 6);
    expect(result.tierCards.luxury.cleared_52wk_yoy_pct).toBeCloseTo(0, 6);

    const withoutPriorYr = computeStep1(lux52, null, EMPTY_PRIOR_WEEK, weekStart);
    expect(withoutPriorYr.hero.luxury_count_yoy_pct).toBeNull();
    expect(withoutPriorYr.tierCards.luxury.cutoff_yoy_pct).toBeNull();
  });

  it('builds demand_trend as the last-26-week flat slice with a trailing-4 rolling average', () => {
    const lux52 = buildLux52(weekStart);
    const result = computeStep1(lux52, null, EMPTY_PRIOR_WEEK, weekStart);

    expect(result.demandTrend.counts).toHaveLength(26);
    expect(result.demandTrend.rolling_avg).toHaveLength(26);
    expect(result.demandTrend.labels).toHaveLength(26);
    // last-26 of a 30-entry series starting at contractCount=10 means the
    // slice starts at index 4 (contractCount 14) through index 29 (39).
    expect(result.demandTrend.counts[0]).toBe(14);
    expect(result.demandTrend.counts[25]).toBe(39);
    // Trailing-4 average of the last point = mean(counts[22..25]).
    const last4 = result.demandTrend.counts.slice(22, 26) as number[];
    expect(result.demandTrend.rolling_avg[25]).toBeCloseTo(last4.reduce((a, b) => a + b, 0) / 4, 6);
    // First point has only itself in its window (padded).
    expect(result.demandTrend.rolling_avg[0]).toBe(14);
  });

  it('produces dom_series.luxury and luxury_p95 aligned to the same 26 dates', () => {
    const lux52 = buildLux52(weekStart);
    const result = computeStep1(lux52, null, EMPTY_PRIOR_WEEK, weekStart);
    expect(result.domSeriesLuxury).toHaveLength(26);
    expect(result.domSeriesLuxuryP95).toHaveLength(26);
    expect(result.domSeriesLuxury.every((v) => v === 150)).toBe(true);
  });

  it('filters history_annual to years 2021+ and index-aligns by year', () => {
    const lux52 = buildLux52(weekStart);
    const result = computeStep1(lux52, null, EMPTY_PRIOR_WEEK, weekStart);
    expect(result.historyAnnual.years).toEqual([2021, 2022]);
    expect(result.historyAnnual.p90).toEqual([4_000_000, 4_200_000]);
    expect(result.historyAnnual.p95).toEqual([6_000_000, 6_200_000]);
    expect(result.historyAnnual.p99).toEqual([14_000_000, 14_500_000]);
  });
});
