import { describe, expect, it } from 'vitest';
import {
  checkBedroomMixSumAgreesWithTotalContracts,
  checkHeroLuxuryCountMatchesDemandTrend,
  checkLeaderboardNonIncreasing,
  checkLuxurySupplyWithinAllSupply,
  checkTierCutoffMonotonicity,
} from './checks';

describe('checkTierCutoffMonotonicity', () => {
  it('passes when luxury < prime < trophy', () => {
    const result = checkTierCutoffMonotonicity({ luxury: 4_000_000, prime: 8_000_000, trophy: 18_000_000 });
    expect(result.ok).toBe(true);
  });

  it('fails when prime is not greater than luxury', () => {
    const result = checkTierCutoffMonotonicity({ luxury: 8_000_000, prime: 8_000_000, trophy: 18_000_000 });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('tier_cutoffs_not_monotonic');
  });

  it('fails when trophy is less than prime', () => {
    const result = checkTierCutoffMonotonicity({ luxury: 4_000_000, prime: 18_000_000, trophy: 10_000_000 });
    expect(result.ok).toBe(false);
  });

  it('passes (cannot verify, not a violation) when a cutoff is null', () => {
    const result = checkTierCutoffMonotonicity({ luxury: 4_000_000, prime: null, trophy: 18_000_000 });
    expect(result.ok).toBe(true);
  });
});

describe('checkHeroLuxuryCountMatchesDemandTrend', () => {
  it('passes when hero.luxury_count equals the last demand_trend.counts entry', () => {
    const result = checkHeroLuxuryCountMatchesDemandTrend(42, [10, 20, 30, 42]);
    expect(result.ok).toBe(true);
  });

  it('fails when they differ', () => {
    const result = checkHeroLuxuryCountMatchesDemandTrend(42, [10, 20, 30, 41]);
    expect(result.ok).toBe(false);
    expect(result.code).toBe('hero_demand_trend_count_mismatch');
  });

  it('passes (cannot verify) when hero.luxury_count is null', () => {
    const result = checkHeroLuxuryCountMatchesDemandTrend(null, [10, 20, 30]);
    expect(result.ok).toBe(true);
  });

  it('passes (cannot verify) when demand_trend.counts is empty', () => {
    const result = checkHeroLuxuryCountMatchesDemandTrend(42, []);
    expect(result.ok).toBe(true);
  });
});

describe('checkLuxurySupplyWithinAllSupply', () => {
  it('passes when luxury active is less than or equal to all active', () => {
    expect(checkLuxurySupplyWithinAllSupply(120, 500).ok).toBe(true);
    expect(checkLuxurySupplyWithinAllSupply(500, 500).ok).toBe(true);
  });

  it('fails when luxury active exceeds all active', () => {
    const result = checkLuxurySupplyWithinAllSupply(501, 500);
    expect(result.ok).toBe(false);
    expect(result.code).toBe('luxury_supply_exceeds_all_supply');
  });

  it('passes (cannot verify) when either value is null', () => {
    expect(checkLuxurySupplyWithinAllSupply(null, 500).ok).toBe(true);
    expect(checkLuxurySupplyWithinAllSupply(120, null).ok).toBe(true);
  });
});

describe('checkLeaderboardNonIncreasing', () => {
  it('passes for a properly descending-sorted leaderboard', () => {
    const rows = [{ vol: 100 }, { vol: 80 }, { vol: 80 }, { vol: 50 }];
    const result = checkLeaderboardNonIncreasing(rows, (r) => r.vol);
    expect(result.ok).toBe(true);
  });

  it('fails when a later row exceeds an earlier one', () => {
    const rows = [{ vol: 100 }, { vol: 50 }, { vol: 60 }];
    const result = checkLeaderboardNonIncreasing(rows, (r) => r.vol);
    expect(result.ok).toBe(false);
    expect(result.detail).toContain('row 2');
  });

  it('applies a tie-break key and fails if the tie-break also increases', () => {
    const rows = [
      { count: 10, volume: 500 },
      { count: 10, volume: 600 },
    ];
    const result = checkLeaderboardNonIncreasing(
      rows,
      (r) => r.count,
      { tieBreakKey: (r) => r.volume },
    );
    expect(result.ok).toBe(false);
  });

  it('passes a tie when the tie-break is also non-increasing', () => {
    const rows = [
      { count: 10, volume: 600 },
      { count: 10, volume: 500 },
    ];
    const result = checkLeaderboardNonIncreasing(
      rows,
      (r) => r.count,
      { tieBreakKey: (r) => r.volume },
    );
    expect(result.ok).toBe(true);
  });

  it('skips comparisons around null sort-key values rather than failing', () => {
    const rows = [{ vol: 100 as number | null }, { vol: null }, { vol: 90 }];
    const result = checkLeaderboardNonIncreasing(rows, (r) => r.vol);
    expect(result.ok).toBe(true);
  });
});

describe('checkBedroomMixSumAgreesWithTotalContracts', () => {
  it('passes when the sum matches total contracts exactly', () => {
    const result = checkBedroomMixSumAgreesWithTotalContracts(
      { studio: 5, '1': 10, '2': 8, '3': 4, '4+': 3 },
      30,
    );
    expect(result.ok).toBe(true);
  });

  it('passes within the 15% tolerance band', () => {
    const result = checkBedroomMixSumAgreesWithTotalContracts(
      { studio: 5, '1': 10, '2': 8, '3': 4, '4+': 2 }, // sum = 29, total 30 => 3.3% off
      30,
    );
    expect(result.ok).toBe(true);
  });

  it('fails when the sum differs by more than 15%', () => {
    const result = checkBedroomMixSumAgreesWithTotalContracts(
      { studio: 2, '1': 3, '2': 2, '3': 1, '4+': 0 }, // sum = 8, total 30 => way over 15%
      30,
    );
    expect(result.ok).toBe(false);
    expect(result.code).toBe('bedroom_mix_sum_mismatch');
  });

  it('passes (cannot verify) when any bucket is null', () => {
    const result = checkBedroomMixSumAgreesWithTotalContracts(
      { studio: 5, '1': null, '2': 8, '3': 4, '4+': 3 },
      30,
    );
    expect(result.ok).toBe(true);
  });

  it('passes (cannot verify) when total contracts is null or zero', () => {
    expect(
      checkBedroomMixSumAgreesWithTotalContracts({ studio: 5 }, null).ok,
    ).toBe(true);
    expect(
      checkBedroomMixSumAgreesWithTotalContracts({ studio: 5 }, 0).ok,
    ).toBe(true);
  });
});
