import { describe, it, expect } from 'vitest';
import { computeTierSeries } from './tierSeries';
import type { LuxuryContractStatsResponse, WeeklyContractStatsResponse } from '../fetch/schemas';

function buildLux52(): LuxuryContractStatsResponse {
  return {
    lines: {
      p90: {
        cutoff: 4_800_000,
        count: 100,
        contractsByPeriod: [
          { date: '2026-08-10', contractCount: 20, totalPrice: 100_000_000 },
          { date: '2026-08-17', contractCount: 15, totalPrice: 80_000_000 },
          { date: '2026-08-24', contractCount: 0, totalPrice: 0 },
          { date: '2026-08-31', contractCount: 10, totalPrice: 50_000_000 }, // future stub week, past week_start -- excluded
        ],
      },
      p95: {
        cutoff: 7_000_000,
        count: 50,
        contractsByPeriod: [
          { date: '2026-08-10', contractCount: 8, totalPrice: 60_000_000 },
          { date: '2026-08-17', contractCount: 6, totalPrice: 45_000_000 },
          { date: '2026-08-24', contractCount: 0, totalPrice: 0 },
        ],
      },
      p99: {
        cutoff: 18_000_000,
        count: 10,
        contractsByPeriod: [
          { date: '2026-08-10', contractCount: 2, totalPrice: 40_000_000, medianPrice: 20_000_000, ppsf: 5000, avgDaysOnMarket: 100 },
          { date: '2026-08-17', contractCount: 1, totalPrice: 20_000_000, medianPrice: 20_000_000, ppsf: 4800, avgDaysOnMarket: 80 },
          { date: '2026-08-24', contractCount: 0, totalPrice: 0, medianPrice: 0, ppsf: 0 },
        ],
      },
    },
  };
}

function buildBand(entries: Array<{ date: string; medianPrice?: number; ppsf?: number; avgDaysOnMarket?: number }>): WeeklyContractStatsResponse {
  return { all: { total: entries.length, contractsByWeek: entries.map((e) => ({ ...e })) } };
}

describe('computeTierSeries', () => {
  it('returns null when lux52 itself is null', () => {
    expect(computeTierSeries(null, null, null, '2026-08-24')).toBeNull();
  });

  it('limits coverage to entries whose date <= week_start', () => {
    const result = computeTierSeries(buildLux52(), null, null, '2026-08-24');
    expect(result).toHaveLength(3);
    expect(result?.map((e) => e.week_start)).toEqual(['2026-08-10', '2026-08-17', '2026-08-24']);
  });

  it('computes exclusive-band count/volume via subtraction, in millions for volume', () => {
    const result = computeTierSeries(buildLux52(), null, null, '2026-08-24')!;
    const wk1 = result[0];
    expect(wk1.luxury.count).toBe(20 - 8); // 12
    expect(wk1.luxury.volume).toBeCloseTo((100_000_000 - 60_000_000) / 1_000_000, 6); // 40
    expect(wk1.prime.count).toBe(8 - 2); // 6
    expect(wk1.prime.volume).toBeCloseTo((60_000_000 - 40_000_000) / 1_000_000, 6); // 20
    expect(wk1.trophy.count).toBe(2);
    expect(wk1.trophy.volume).toBeCloseTo(40_000_000 / 1_000_000, 6); // 40
  });

  it('treats a genuine zero-contract week as 0, not null', () => {
    const result = computeTierSeries(buildLux52(), null, null, '2026-08-24')!;
    const zeroWeek = result[2]; // 2026-08-24, all lines 0
    expect(zeroWeek.luxury.count).toBe(0);
    expect(zeroWeek.trophy.count).toBe(0);
    expect(zeroWeek.trophy.volume).toBe(0);
  });

  it('nulls trophy median/ppsf/dom entirely on a zero-contract trophy week, even though the API returns 0 not null', () => {
    const result = computeTierSeries(buildLux52(), null, null, '2026-08-24')!;
    const zeroWeek = result[2];
    expect(zeroWeek.trophy.median).toBeNull();
    expect(zeroWeek.trophy.ppsf).toBeNull();
    expect(zeroWeek.trophy.dom).toBeNull();
  });

  it('populates trophy median/ppsf/dom (in millions for median) on a real week', () => {
    const result = computeTierSeries(buildLux52(), null, null, '2026-08-24')!;
    const wk1 = result[0];
    expect(wk1.trophy.median).toBeCloseTo(20, 6); // 20M -> 20
    expect(wk1.trophy.ppsf).toBe(5000);
    expect(wk1.trophy.dom).toBe(100);
  });

  it('matches luxury/prime band data by date, not array position, and converts median to millions', () => {
    const luxuryBand = buildBand([
      { date: '2026-08-17', medianPrice: 6_000_000, ppsf: 2500, avgDaysOnMarket: 120 },
      { date: '2026-08-10', medianPrice: 5_500_000, ppsf: 2400, avgDaysOnMarket: 110 },
    ]);
    const result = computeTierSeries(buildLux52(), luxuryBand, null, '2026-08-24')!;
    const wk1 = result.find((e) => e.week_start === '2026-08-10')!;
    expect(wk1.luxury.median).toBeCloseTo(5.5, 6);
    expect(wk1.luxury.ppsf).toBe(2400);
    expect(wk1.luxury.dom).toBe(110);
  });

  it('nulls luxury/prime median/ppsf/dom for every week when the band call failed', () => {
    const result = computeTierSeries(buildLux52(), null, null, '2026-08-24')!;
    for (const wk of result) {
      expect(wk.luxury.median).toBeNull();
      expect(wk.prime.median).toBeNull();
    }
    // but count/volume (from lux52 alone) are still populated
    expect(result[0].luxury.count).not.toBeNull();
  });
});
