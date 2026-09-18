import { describe, expect, it } from 'vitest';
import { weeklyReportPayloadSchema } from './weeklyReportPayload';

/**
 * A representative payload matching the OUTPUT CONTRACT shape from
 * docs/site-data-agent-FULL-PROMPT-2026-09-18.md, adapted to exercise
 * nullable fields (rather than the spec's illustrative `0` placeholders)
 * so the schema is proven against realistic "some fields failed/were
 * unavailable" data, not just an all-happy-path fixture.
 */
function buildSamplePayload() {
  const tierCard = {
    cutoff: 4_950_000,
    cutoff_wow_pct: null,
    cutoff_yoy_pct: 3.2,
    ppsf_avg: 2168.31,
    ppsf_avg_wow_pct: 0.4,
    ppsf_avg_yoy_pct: 5.1,
    cleared_52wk: 520,
    cleared_52wk_wow_pct: 1.1,
    cleared_52wk_yoy_pct: -2.3,
    volume_52wk: 3_200_000_000,
    volume_52wk_wow_pct: 0.8,
    volume_52wk_yoy_pct: 4.0,
  };

  const byType = {
    contracts: 12,
    contracts_wow_pct: null,
    contracts_yoy_pct: null,
    contracts_volume: null,
    contracts_volume_wow_pct: null,
    contracts_volume_yoy_pct: null,
    recorded_sales: 8,
    recorded_sales_wow_pct: null,
    recorded_sales_yoy_pct: null,
    ppsf: 2100,
    ppsf_wow_pct: null,
    ppsf_yoy_pct: null,
    discount_pct: -7.5,
    discount_pct_wow_pct: null,
    discount_pct_yoy_pct: null,
    dom: 148,
    dom_wow_pct: null,
    dom_yoy_pct: null,
  };

  const leaderboardRow = {
    rank: 1,
    name: 'upper east side',
    vol_52wk: 500_000_000,
    contracts_52wk: 60,
    local_median: 6_500_000,
    avg_sale: 8_000_000,
    pct_lux: 35.0,
    wk_contracts: 4,
    wk_volume: 30_000_000,
    rank_delta: 2,
  };

  return {
    hero: {
      luxury_cutoff: 4_950_000,
      luxury_count: 21,
      luxury_count_wow_pct: -3.1,
      luxury_count_yoy_pct: null,
      luxury_count_vs_lastweek_pct: null,
      luxury_count_avg52: 24.2,
      luxury_volume: 180_000_000,
      luxury_volume_wow_pct: 2.4,
      luxury_volume_yoy_pct: null,
      luxury_volume_vs_lastweek_pct: null,
      luxury_volume_avg52: 190_000_000,
      prime_cutoff: 8_500_000,
      prime_count: 9,
      prime_volume: 90_000_000,
      trophy_cutoff: 18_000_000,
      trophy_count: 0,
      trophy_volume: 0,
      median_price: 5_950_000,
      median_ppsf: 2168.31,
      avg_dom: 147.33,
    },
    demand_trend: {
      counts: [18, 20, 21],
      rolling_avg: [null, null, 19.7],
      labels: ['2026-01-05', '2026-01-12', '2026-01-19'],
    },
    tiers: {
      luxury: tierCard,
      prime: tierCard,
      trophy: tierCard,
      history_annual: {
        years: [2021, 2022, 2023, 2024, 2025, 2026],
        p90: [3.1, 3.4, 3.8, 4.2, 4.6, 4.95],
        p95: [5.1, 5.4, 5.8, 6.2, 6.9, 8.5],
        p99: [10.1, 11.4, 12.8, 14.2, 16.9, 18.0],
      },
      history_quarterly: {
        labels: ['Q2 2022', 'Q3 2022', 'Current'],
        p90: [3.2, 3.3, 4.95],
        p95: [5.2, 5.3, 8.5],
        p99: [10.2, 10.3, 18.0],
      },
    },
    market_pulse: {
      all: {
        contracts: 210,
        contracts_wow_pct: 1.2,
        contracts_yoy_pct: null,
        contracts_avg52: 205,
        contracts_vs_lastweek_pct: null,
        volume: 950_000_000,
        volume_wow_pct: 0.5,
        volume_yoy_pct: null,
        volume_avg52: 900_000_000,
        volume_vs_lastweek_pct: null,
      },
      by_type: { condo: byType, coop: byType, townhouse: byType },
    },
    bedroom_mix: {
      volume: { studio: 1_000_000, '1': 5_000_000, '2': 8_000_000, '3': 4_000_000, '4+': 2_000_000 },
      count: { studio: 3, '1': 10, '2': 8, '3': 4, '4+': 1 },
    },
    leaderboard: [leaderboardRow],
    concentrated_leaderboard: [leaderboardRow],
    weekly_activity_leaderboard: [
      { rank: 1, name: 'noho', wk_contracts: 3, wk_volume: 20_000_000, largest_rank: null, concentrated_rank: 2 },
    ],
    supply: {
      luxury: {
        active: 120,
        active_wow_pct: null,
        active_yoy_pct: null,
        months_supply: 5.2,
        months_supply_wow_pct: null,
        months_supply_yoy_pct: null,
        absorption_pct: 19.2,
        absorption_pct_wow_pct: null,
        absorption_pct_yoy_pct: null,
      },
      prime: { active: 60, months_supply: 6.1, absorption_pct: 16.4, active_yoy_pct: null },
      all: {
        active: 900,
        active_wow_pct: null,
        active_yoy_pct: null,
        months_supply: 4.4,
        months_supply_wow_pct: null,
        months_supply_yoy_pct: null,
        absorption_pct: 22.7,
        absorption_pct_wow_pct: null,
        absorption_pct_yoy_pct: null,
      },
      supply_series: { luxury: [120, 118, 120], prime: [60, 59, 60], all: [900, 890, 900] },
      dom_series: {
        luxury: [140, 145, null],
        luxury_p95: [160, null, 170],
        all: [130, 135, null],
      },
    },
    type_trends: {
      labels: ['2025-07-14', '2025-07-21'],
      contracts_count: { condo: [10, 12], coop: [3, 2], townhouse: [1, null] },
      contracts_volume: { condo: [50_000_000, 60_000_000], coop: [null, null], townhouse: [null, null] },
      sales_avgprice: { condo: [4_000_000, 4_200_000], coop: [2_000_000, null], townhouse: [null, null] },
      sales_discount: { condo: [-5.2, -4.8], coop: [null, null], townhouse: [null, null] },
      sales_ppsf: { condo: [2100, 2150], coop: [null, null], townhouse: [null, null] },
      sales_count: { condo: [8, 9], coop: [2, 1], townhouse: [null, null] },
      sales_volume: { condo: [40_000_000, 45_000_000], coop: [null, null], townhouse: [null, null] },
    },
    top_deals: [
      {
        address: '1122 Madison Avenue, Apt 14N',
        price: 21_175_000,
        neighborhood: 'upper east side',
        sf: 3809,
        ppsf: 5558,
        dom: 62,
        property_type: 'condo' as const,
      },
    ],
    sowhat: {
      lede: 'At ~10 months of luxury supply, this is a buyer\'s market.',
      market_read: { badge: 'BUSY', class: 'read--busy' },
      supply_read: 'At ~10 months of luxury supply, this is a buyer\'s market.',
      supply_band_label: "buyer's market",
      pace_read: 'Luxury signing is running ~24 contracts/week.',
      dom_read: 'Luxury days-on-market are selling somewhat faster.',
      discount_read: 'On closed luxury sales, negotiating room is steady.',
      volume_read: null,
      trophy_read: 'No trophy ($18M+) contracts this week.',
      neighborhood_mover_read: 'NoHo is the week\'s real mover.',
      footnotes: {
        asking_not_achieved: 'text',
        count_reconciliation: 'text',
        provisional: 'text',
      },
      streak_weeks: 3,
    },
    tier_series: [
      {
        week_start: '2025-08-04',
        luxury: { count: 10, volume: 57.77, median: 5.95, ppsf: 2168.31, dom: 147.33 },
        prime: { count: 5, volume: 63.64, median: 10.65, ppsf: 3471.34, dom: 222.4 },
        trophy: { count: 3, volume: 131.45, median: 24.7, ppsf: 6828.74, dom: 234 },
      },
    ],
    tier_series_methodology_note: 'Luxury and Prime band median/PPSF/DOM are bounded by fixed cutoffs.',
  };
}

describe('weeklyReportPayloadSchema', () => {
  it('accepts a representative payload matching the spec OUTPUT CONTRACT', () => {
    const result = weeklyReportPayloadSchema.safeParse(buildSamplePayload());
    expect(result.success).toBe(true);
  });

  it('rejects a payload missing a required top-level section', () => {
    const sample = buildSamplePayload() as Record<string, unknown>;
    delete sample.hero;
    const result = weeklyReportPayloadSchema.safeParse(sample);
    expect(result.success).toBe(false);
  });

  it('rejects an invalid property_type on a top deal (only condo/co-op/townhouse/null allowed)', () => {
    const sample = buildSamplePayload();
    // @ts-expect-error -- intentionally invalid for the test
    sample.top_deals[0].property_type = 'single-family';
    const result = weeklyReportPayloadSchema.safeParse(sample);
    expect(result.success).toBe(false);
  });

  it('accepts tier_series as null (absent because lux52 failed)', () => {
    const sample = buildSamplePayload();
    const result = weeklyReportPayloadSchema.safeParse({ ...sample, tier_series: null, tier_series_methodology_note: null });
    expect(result.success).toBe(true);
  });

  it('accepts empty arrays for leaderboard-style sections (never fabricated padding)', () => {
    const sample = buildSamplePayload();
    const result = weeklyReportPayloadSchema.safeParse({
      ...sample,
      leaderboard: [],
      concentrated_leaderboard: [],
      weekly_activity_leaderboard: [],
      top_deals: [],
    });
    expect(result.success).toBe(true);
  });
});
