import { describe, it, expect } from 'vitest';
import { computeMarketPulseAndTypeTrends } from './marketPulse';
import type { WeeklyContractStatsResponse, WeeklySalesStatsResponse } from '../fetch/schemas';
import { EMPTY_PRIOR_WEEK } from './types';

function buildWeeklyContractStats(): WeeklyContractStatsResponse {
  const allSeries = [
    { date: '2026-08-17', contractCount: 200, totalPrice: 400_000_000 },
    { date: '2026-08-24', contractCount: 129, totalPrice: 220_000_000 },
  ];
  return {
    all: { total: 2, contractsByWeek: allSeries },
    condos: {
      total: 2,
      contractsByWeek: [
        { date: '2026-08-17', contractCount: 70, totalPrice: 190_000_000 },
        { date: '2026-08-24', contractCount: 48, totalPrice: 91_784_887 },
      ],
    },
    coops: {
      total: 2,
      contractsByWeek: [
        { date: '2026-08-17', contractCount: 74, totalPrice: 118_000_000 },
        { date: '2026-08-24', contractCount: 78, totalPrice: 109_968_800 },
      ],
    },
    townhouses: {
      total: 2,
      contractsByWeek: [
        { date: '2026-08-17', contractCount: 4, totalPrice: 30_000_000 },
        { date: '2026-08-24', contractCount: 1, totalPrice: 7_750_000 },
      ],
    },
    contractsByBeds: [
      {
        date: '2026-08-24',
        totalSales: 127,
        unitMix: [
          { bedrooms: 0, salesCount: 15, dollarVolume: 9_116_000 },
          { bedrooms: 1, salesCount: 54, dollarVolume: 51_694_788 },
          { bedrooms: 2, salesCount: 35, dollarVolume: 63_727_899 },
          { bedrooms: 3, salesCount: 15, dollarVolume: 47_995_000 },
          { bedrooms: '4+', salesCount: 8, dollarVolume: 36_970_000 },
        ],
      },
    ],
  };
}

describe('computeMarketPulseAndTypeTrends', () => {
  const weekStart = '2026-08-24';

  it('returns the all-null failure shape when weeklyContractStats is null', () => {
    const result = computeMarketPulseAndTypeTrends(null, null, EMPTY_PRIOR_WEEK, weekStart);
    expect(result.marketPulse.all.contracts).toBeNull();
    expect(result.typeTrends.labels).toEqual([]);
    expect(result.bedroomMix.count.studio).toBeNull();
  });

  it('maps market_pulse.all from the week-aligned entry', () => {
    const result = computeMarketPulseAndTypeTrends(buildWeeklyContractStats(), null, EMPTY_PRIOR_WEEK, weekStart);
    expect(result.marketPulse.all.contracts).toBe(129);
    expect(result.marketPulse.all.volume).toBe(220_000_000);
    expect(result.marketPulse.all.contracts_avg52).toBeCloseTo((200 + 129) / 2, 6);
  });

  it('computes contracts_vs_lastweek_pct from prevPulseAll, null when absent', () => {
    const withPrior = computeMarketPulseAndTypeTrends(buildWeeklyContractStats(), null, { ...EMPTY_PRIOR_WEEK, prevPulseAll: { contracts: 150, volume: 300_000_000 } }, weekStart);
    expect(withPrior.marketPulse.all.contracts_vs_lastweek_pct).toBeCloseTo(((129 - 150) / 150) * 100, 6);
    const withoutPrior = computeMarketPulseAndTypeTrends(buildWeeklyContractStats(), null, EMPTY_PRIOR_WEEK, weekStart);
    expect(withoutPrior.marketPulse.all.contracts_vs_lastweek_pct).toBeNull();
  });

  it('builds bedroom_mix metric-first from contractsByBeds', () => {
    const result = computeMarketPulseAndTypeTrends(buildWeeklyContractStats(), null, EMPTY_PRIOR_WEEK, weekStart);
    expect(result.bedroomMix.count).toEqual({ studio: 15, '1': 54, '2': 35, '3': 15, '4+': 8 });
    expect(result.bedroomMix.volume['1']).toBe(51_694_788);
  });

  it('builds type_trends with contracts_count/volume aligned to shared labels', () => {
    const result = computeMarketPulseAndTypeTrends(buildWeeklyContractStats(), null, EMPTY_PRIOR_WEEK, weekStart);
    expect(result.typeTrends.labels).toEqual(['2026-08-17', '2026-08-24']);
    expect(result.typeTrends.contracts_count.condo).toEqual([70, 48]);
    expect(result.typeTrends.contracts_volume.coop).toEqual([118_000_000, 109_968_800]);
  });

  it('computes by_type contracts_wow_pct/yoy_pct from the type_trends series (last vs last-1, last vs index 0)', () => {
    const result = computeMarketPulseAndTypeTrends(buildWeeklyContractStats(), null, EMPTY_PRIOR_WEEK, weekStart);
    // condo contracts_count = [70, 48] -> wow = (48-70)/70*100, yoy = (48-70)/70*100 (only 2 points, so wow==yoy here)
    const expected = ((48 - 70) / 70) * 100;
    expect(result.marketPulse.by_type.condo.contracts_wow_pct).toBeCloseTo(expected, 6);
    expect(result.marketPulse.by_type.condo.contracts_yoy_pct).toBeCloseTo(expected, 6);
    expect(result.marketPulse.by_type.condo.contracts).toBe(48);
  });

  it('leaves sales_* as null-filled arrays and by_type recorded_sales/dom_wow/yoy null when weeklySalesStats is absent', () => {
    const result = computeMarketPulseAndTypeTrends(buildWeeklyContractStats(), null, EMPTY_PRIOR_WEEK, weekStart);
    expect(result.typeTrends.sales_count.condo).toEqual([null, null]);
    expect(result.marketPulse.by_type.condo.recorded_sales).toBeNull();
    expect(result.marketPulse.by_type.condo.dom_wow_pct).toBeNull();
    expect(result.marketPulse.by_type.condo.dom_yoy_pct).toBeNull();
  });

  it('populates recorded_sales/ppsf/discount_pct/dom when weeklySalesStats is type-split', () => {
    const salesStats: WeeklySalesStatsResponse = {
      condos: {
        total: 2,
        salesByWeek: [
          { date: '2026-08-17', salesCount: 90, ppsf: 1700, discount: -6.5, avgDaysOnMarket: 130 },
          { date: '2026-08-24', salesCount: 116, ppsf: 1598, discount: -7.9, avgDaysOnMarket: 132 },
        ],
      },
    };
    const result = computeMarketPulseAndTypeTrends(buildWeeklyContractStats(), salesStats, EMPTY_PRIOR_WEEK, weekStart);
    expect(result.marketPulse.by_type.condo.recorded_sales).toBe(116);
    expect(result.marketPulse.by_type.condo.ppsf).toBe(1598);
    expect(result.marketPulse.by_type.condo.discount_pct).toBeCloseTo(-7.9, 6);
    expect(result.marketPulse.by_type.condo.dom).toBe(132);
    expect(result.typeTrends.sales_ppsf.condo).toEqual([1700, 1598]);
  });
});
