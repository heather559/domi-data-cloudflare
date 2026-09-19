import { describe, expect, it } from 'vitest';
import {
  checkPayloadMatchesSchema,
  checkLeaderboardSortedByVolume,
  checkConcentratedLeaderboardShape,
  checkWeeklyActivityLeaderboardShape,
  checkTopDealsShape,
  checkVolumeReadGate,
  checkLedeMatchesOtherReads,
  checkTypeTrendsAlignment,
  checkDemandTrendDomSeriesAlignment,
  checkDomSeriesAllLength,
  checkHistoryQuarterlyShape,
  checkTierSeriesChronological,
} from './checks';

describe('checkPayloadMatchesSchema', () => {
  it('fails on a payload missing required top-level sections', () => {
    const result = checkPayloadMatchesSchema({ hero: {} });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('payload_schema_violation');
  });
});

describe('checkLeaderboardSortedByVolume', () => {
  it('passes when non-increasing', () => {
    expect(checkLeaderboardSortedByVolume([{ vol_52wk: 100 }, { vol_52wk: 50 }]).ok).toBe(true);
  });
  it('fails when increasing', () => {
    expect(checkLeaderboardSortedByVolume([{ vol_52wk: 50 }, { vol_52wk: 100 }]).ok).toBe(false);
  });
});

describe('checkConcentratedLeaderboardShape', () => {
  it('fails when a row is below the 11-contract floor', () => {
    const result = checkConcentratedLeaderboardShape([{ pct_lux: 30, contracts_52wk: 5 }]);
    expect(result.ok).toBe(false);
    expect(result.code).toBe('concentrated_leaderboard_below_qualifying_floor');
  });
  it('fails when there are more than 10 rows', () => {
    const rows = Array.from({ length: 11 }, (_, i) => ({ pct_lux: 30 - i, contracts_52wk: 20 }));
    expect(checkConcentratedLeaderboardShape(rows).ok).toBe(false);
  });
  it('passes a valid shape', () => {
    const result = checkConcentratedLeaderboardShape([{ pct_lux: 30, contracts_52wk: 15 }, { pct_lux: 20, contracts_52wk: 12 }]);
    expect(result.ok).toBe(true);
  });
});

describe('checkWeeklyActivityLeaderboardShape', () => {
  it('fails when not sorted by wk_contracts descending', () => {
    const result = checkWeeklyActivityLeaderboardShape([{ wk_contracts: 1, wk_volume: 100 }, { wk_contracts: 4, wk_volume: 100 }]);
    expect(result.ok).toBe(false);
  });
  it('flags a volume reconciliation mismatch when provided', () => {
    const result = checkWeeklyActivityLeaderboardShape([{ wk_contracts: 4, wk_volume: 100 }], {
      heroLuxuryVolume: 1000,
      totalVolumeAcrossAllNeighborhoods: 500,
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('weekly_activity_volume_reconciliation_mismatch');
  });
  it('passes when volumes reconcile within tolerance', () => {
    const result = checkWeeklyActivityLeaderboardShape([{ wk_contracts: 4, wk_volume: 100 }], {
      heroLuxuryVolume: 1000,
      totalVolumeAcrossAllNeighborhoods: 1000,
    });
    expect(result.ok).toBe(true);
  });
});

describe('checkTopDealsShape', () => {
  it('fails when more than 5 entries', () => {
    const deals = Array.from({ length: 6 }, (_, i) => ({ price: 10 - i, sf: 1000, ppsf: 10 }));
    expect(checkTopDealsShape(deals).ok).toBe(false);
  });
  it('fails when not sorted by price descending', () => {
    expect(checkTopDealsShape([{ price: 5, sf: 1000, ppsf: 5 }, { price: 10, sf: 1000, ppsf: 10 }]).ok).toBe(false);
  });
  it('fails when ppsf is non-null despite null/0 sf', () => {
    expect(checkTopDealsShape([{ price: 5, sf: null, ppsf: 5000 }]).ok).toBe(false);
    expect(checkTopDealsShape([{ price: 5, sf: 0, ppsf: 5000 }]).ok).toBe(false);
  });
  it('passes a valid list', () => {
    expect(checkTopDealsShape([{ price: 10, sf: 1000, ppsf: 10 }, { price: 5, sf: null, ppsf: null }]).ok).toBe(true);
  });
});

describe('checkVolumeReadGate', () => {
  it('fails when volume_read is set but momentum did not clear 0.20', () => {
    expect(checkVolumeReadGate('some read', 0.1).ok).toBe(false);
  });
  it('passes when volume_read is null regardless of momentum', () => {
    expect(checkVolumeReadGate(null, 0.1).ok).toBe(true);
  });
  it('passes when momentum cleared the gate', () => {
    expect(checkVolumeReadGate('some read', 0.25).ok).toBe(true);
  });
  it('cannot verify (passes) when momentum is unavailable', () => {
    expect(checkVolumeReadGate('some read', null).ok).toBe(true);
  });
});

describe('checkLedeMatchesOtherReads', () => {
  it('passes when lede is null', () => {
    expect(checkLedeMatchesOtherReads({ lede: null, supply_read: 'a', pace_read: null, dom_read: null, discount_read: null, volume_read: null }).ok).toBe(true);
  });
  it('passes when lede matches one of the other reads verbatim', () => {
    expect(checkLedeMatchesOtherReads({ lede: 'a', supply_read: 'a', pace_read: null, dom_read: null, discount_read: null, volume_read: null }).ok).toBe(true);
  });
  it('fails when lede does not match any other read', () => {
    expect(checkLedeMatchesOtherReads({ lede: 'made up', supply_read: 'a', pace_read: null, dom_read: null, discount_read: null, volume_read: null }).ok).toBe(false);
  });
});

describe('checkTypeTrendsAlignment', () => {
  const aligned = { condo: [1, 2], coop: [1, 2], townhouse: [1, 2] };
  it('passes when every array matches labels length', () => {
    const result = checkTypeTrendsAlignment({
      labels: ['a', 'b'],
      contracts_count: aligned,
      contracts_volume: aligned,
      sales_avgprice: aligned,
      sales_discount: aligned,
      sales_ppsf: aligned,
      sales_count: aligned,
      sales_volume: aligned,
    });
    expect(result.ok).toBe(true);
  });
  it('fails when one array is a different length', () => {
    const result = checkTypeTrendsAlignment({
      labels: ['a', 'b'],
      contracts_count: { condo: [1], coop: [1, 2], townhouse: [1, 2] },
      contracts_volume: aligned,
      sales_avgprice: aligned,
      sales_discount: aligned,
      sales_ppsf: aligned,
      sales_count: aligned,
      sales_volume: aligned,
    });
    expect(result.ok).toBe(false);
  });
});

describe('checkDemandTrendDomSeriesAlignment', () => {
  it('passes when all five arrays share the same length', () => {
    const arr = [1, 2, 3];
    const result = checkDemandTrendDomSeriesAlignment({
      demandTrendCounts: arr,
      demandTrendRollingAvg: arr,
      demandTrendLabels: arr,
      domSeriesLuxury: arr,
      domSeriesLuxuryP95: arr,
    });
    expect(result.ok).toBe(true);
  });
  it('fails when one array has a different length', () => {
    const result = checkDemandTrendDomSeriesAlignment({
      demandTrendCounts: [1, 2, 3],
      demandTrendRollingAvg: [1, 2, 3],
      demandTrendLabels: [1, 2, 3],
      domSeriesLuxury: [1, 2],
      domSeriesLuxuryP95: [1, 2, 3],
    });
    expect(result.ok).toBe(false);
  });
});

describe('checkDomSeriesAllLength', () => {
  it('fails when dom_series.all is a raw 52-point dump instead of the same 26-length slice', () => {
    expect(checkDomSeriesAllLength(Array(52).fill(1), Array(26).fill(1)).ok).toBe(false);
  });
  it('passes when lengths match', () => {
    expect(checkDomSeriesAllLength(Array(26).fill(1), Array(26).fill(1)).ok).toBe(true);
  });
});

describe('checkHistoryQuarterlyShape', () => {
  it('fails when the last label is not "Current"', () => {
    const result = checkHistoryQuarterlyShape({ labels: ['Q1 2026', 'Q2 2026'], p90: [1, 2], p95: [1, 2], p99: [1, 2] });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('history_quarterly_missing_current_tail');
  });
  it('fails on length mismatch', () => {
    const result = checkHistoryQuarterlyShape({ labels: ['Current'], p90: [1, 2], p95: [1], p99: [1] });
    expect(result.ok).toBe(false);
  });
  it('passes a valid shape', () => {
    const result = checkHistoryQuarterlyShape({ labels: ['Q1 2026', 'Current'], p90: [1, 2], p95: [1, 2], p99: [1, 2] });
    expect(result.ok).toBe(true);
  });
});

describe('checkTierSeriesChronological', () => {
  it('passes when null (legitimate when lux52 itself failed)', () => {
    expect(checkTierSeriesChronological(null).ok).toBe(true);
  });
  it('fails on out-of-order or duplicate week_start', () => {
    expect(checkTierSeriesChronological([{ week_start: '2026-01-08' }, { week_start: '2026-01-01' }]).ok).toBe(false);
    expect(checkTierSeriesChronological([{ week_start: '2026-01-01' }, { week_start: '2026-01-01' }]).ok).toBe(false);
  });
  it('fails when the last entry does not match the expected week_start', () => {
    const result = checkTierSeriesChronological([{ week_start: '2026-01-01' }], '2026-01-08');
    expect(result.ok).toBe(false);
    expect(result.code).toBe('tier_series_last_entry_mismatch');
  });
  it('passes a valid chronological series ending on the expected week', () => {
    const result = checkTierSeriesChronological([{ week_start: '2026-01-01' }, { week_start: '2026-01-08' }], '2026-01-08');
    expect(result.ok).toBe(true);
  });
});
