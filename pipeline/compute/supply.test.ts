import { describe, it, expect } from 'vitest';
import { computeSupply, type ComputeSupplyInputs } from './supply';
import type { ContractPeriodEntry, LuxuryContractStatsResponse, SupplyResponse } from '../fetch/schemas';

function supplyResp(values: number[]): SupplyResponse {
  return { series: values.map((v, i) => ({ date: `2026-01-${String(i + 1).padStart(2, '0')}`, supply: v })) };
}

function lux52WithP90Counts(counts: number[]): LuxuryContractStatsResponse {
  const p90: ContractPeriodEntry[] = counts.map((c, i) => ({ date: `2026-01-${String(i + 1).padStart(2, '0')}`, contractCount: c }));
  return {
    lines: {
      p90: { contractsByPeriod: p90 },
      p95: { contractsByPeriod: counts.map((c) => ({ date: 'x', contractCount: c / 2 })) },
      p99: { contractsByPeriod: [] },
    },
  };
}

const baseInputs: ComputeSupplyInputs = {
  supplyAll: null,
  supplyLuxury: null,
  supplyPrime: null,
  lux52: null,
  lux52PriorYr: null,
  marketPulseAllSeries: [],
  marketPulseAllContractsAvg52: null,
  domSeriesLuxury: [],
  domSeriesLuxuryP95: [],
  demandTrendLabels: [],
  weeklySalesStats: null,
};

describe('computeSupply', () => {
  it('nulls a section when its own call failed, independent of the others', () => {
    const result = computeSupply({ ...baseInputs, supplyAll: supplyResp([100, 110]) });
    expect(result.all.active).toBe(110);
    expect(result.luxury.active).toBeNull();
    expect(result.supply_series.luxury).toEqual([]);
    expect(result.supply_series.all).toEqual([100, 110]);
  });

  it('computes months_supply and absorption_pct from active / (avg weekly pace * 4.33)', () => {
    const counts = Array.from({ length: 10 }, () => 20); // constant pace of 20/week
    const lux52 = lux52WithP90Counts(counts);
    const result = computeSupply({ ...baseInputs, supplyLuxury: supplyResp([800]), lux52 });
    const expectedMonths = 800 / (20 * 4.33);
    expect(result.luxury.months_supply).toBeCloseTo(expectedMonths, 6);
    expect(result.luxury.absorption_pct).toBeCloseTo((1 / expectedMonths) * 100, 6);
  });

  it('computes active_wow_pct / active_yoy_pct from the series first/last/second-to-last points', () => {
    const series = [500, 520, 540, 560];
    const result = computeSupply({ ...baseInputs, supplyAll: supplyResp(series) });
    expect(result.all.active_wow_pct).toBeCloseTo(((560 - 540) / 540) * 100, 6);
    expect(result.all.active_yoy_pct).toBeCloseTo(((560 - 500) / 500) * 100, 6);
  });

  it('nulls active_wow_pct/yoy_pct when the series has fewer than 2 points', () => {
    const result = computeSupply({ ...baseInputs, supplyAll: supplyResp([500]) });
    expect(result.all.active_wow_pct).toBeNull();
    expect(result.all.active_yoy_pct).toBeNull();
  });

  it('computes LUXURY months_supply_wow_pct using pace excluding lux52 last entry, months one week earlier', () => {
    // pace now = mean(all 10) = 20; pace one week ago = mean(first 9, excluding last) still 20 in this constant fixture -- use a ramping series to make wow non-trivial.
    const counts = [10, 10, 10, 10, 10, 10, 10, 10, 10, 30]; // last week spiked
    const lux52 = lux52WithP90Counts(counts);
    const luxurySeries = [700, 720]; // second-to-last=700, last=720
    const result = computeSupply({ ...baseInputs, supplyLuxury: supplyResp(luxurySeries), lux52 });

    const paceNow = counts.reduce((a, b) => a + b, 0) / counts.length; // 12
    const paceWow = counts.slice(0, -1).reduce((a, b) => a + b, 0) / (counts.length - 1); // 10
    const monthsNow = 720 / (paceNow * 4.33);
    const monthsWow = 700 / (paceWow * 4.33);
    expect(result.luxury.months_supply).toBeCloseTo(monthsNow, 6);
    expect(result.luxury.months_supply_wow_pct).toBeCloseTo(((monthsNow - monthsWow) / monthsWow) * 100, 6);
  });

  it('computes ALL months_supply_wow_pct only when marketPulseAllSeries has >= 53 entries', () => {
    const shortSeries: ContractPeriodEntry[] = Array.from({ length: 10 }, (_, i) => ({ date: `d${i}`, contractCount: 100 }));
    const result = computeSupply({
      ...baseInputs,
      supplyAll: supplyResp([1000, 1050]),
      marketPulseAllSeries: shortSeries,
      marketPulseAllContractsAvg52: 100,
    });
    expect(result.all.months_supply_wow_pct).toBeNull();

    const longSeries: ContractPeriodEntry[] = Array.from({ length: 54 }, (_, i) => ({ date: `d${i}`, contractCount: i < 53 ? 100 : 999 }));
    const result2 = computeSupply({
      ...baseInputs,
      supplyAll: supplyResp([1000, 1050]),
      marketPulseAllSeries: longSeries,
      marketPulseAllContractsAvg52: 100,
    });
    expect(result2.all.months_supply_wow_pct).not.toBeNull();
  });

  it('passes through dom_series.luxury and luxury_p95 unchanged', () => {
    const result = computeSupply({ ...baseInputs, domSeriesLuxury: [100, null, 120], domSeriesLuxuryP95: [90, 95, null] });
    expect(result.dom_series.luxury).toEqual([100, null, 120]);
    expect(result.dom_series.luxury_p95).toEqual([90, 95, null]);
  });

  it('builds dom_series.all as an array of nulls when weeklySalesStats has no usable data', () => {
    const result = computeSupply({ ...baseInputs, demandTrendLabels: ['2026-01-01', '2026-01-08'] });
    expect(result.dom_series.all).toEqual([null, null]);
  });

  it('salesCount-weights condos/coops/townhouses into dom_series.all when no pooled "all" bucket exists', () => {
    const result = computeSupply({
      ...baseInputs,
      demandTrendLabels: ['2026-01-01'],
      weeklySalesStats: {
        condos: { salesByWeek: [{ date: '2026-01-01', avgDaysOnMarket: 100, salesCount: 10 }] },
        coops: { salesByWeek: [{ date: '2026-01-01', avgDaysOnMarket: 200, salesCount: 30 }] },
      },
    });
    // weighted avg = (100*10 + 200*30) / 40 = 175
    expect(result.dom_series.all[0]).toBeCloseTo(175, 6);
  });
});
