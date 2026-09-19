import { describe, it, expect } from 'vitest';
import { computeLeaderboards, type ComputeLeaderboardsInputs } from './leaderboard';
import type { NeighborhoodEntry, NeighborhoodRankResponse } from '../fetch/schemas';

function hood(name: string, totalPrice: number, count: number, pct: number, extra: Partial<NeighborhoodEntry['tiers']['p90']> = {}): NeighborhoodEntry {
  return {
    neighborhood: name,
    rank: 1, // native rank -- deliberately ignored by the compute layer
    totalContracts: count * 3,
    tiers: { p90: { totalPrice, count, pct, averagePrice: totalPrice / count, medianPrice: totalPrice / count, ...extra } },
  };
}

function rankResp(hoods: NeighborhoodEntry[]): NeighborhoodRankResponse {
  return { neighborhoods: hoods };
}

const noMinPrice = rankResp([
  hood('upper east side', 1_700_000_000, 144, 0.19),
  hood('tribeca', 700_000_000, 83, 0.34),
  hood('nolita', 50_000_000, 16, 0.6), // high intensity but only 5 qualifying deals under the >=11 floor in a real scenario -- here count=16 so it clears; separate low-count case tested below
]);

const baseInputs: ComputeLeaderboardsInputs = {
  hoodRankNoMinPrice: noMinPrice,
  hoodRankMinPriceAnchored: noMinPrice,
  hoodRankHistorical: null,
  weeklyStats: new Map([
    ['upper east side', { wkContracts: 1, wkVolume: 7_750_000 }],
    ['tribeca', { wkContracts: 4, wkVolume: 22_395_000 }],
  ]),
};

describe('computeLeaderboards', () => {
  it('returns empty arrays when hoodRankNoMinPrice is null', () => {
    const result = computeLeaderboards({ ...baseInputs, hoodRankNoMinPrice: null });
    expect(result.leaderboard).toEqual([]);
    expect(result.concentrated_leaderboard).toEqual([]);
  });

  it('sorts leaderboard by 52-week luxury dollar volume descending, ignoring native rank', () => {
    const result = computeLeaderboards(baseInputs);
    expect(result.leaderboard.map((r) => r.name)).toEqual(['upper east side', 'tribeca', 'nolita']);
    expect(result.leaderboard[0].rank).toBe(1);
    expect(result.leaderboard[0].vol_52wk).toBe(1_700_000_000);
  });

  it('scales pct_lux from a 0-1 fraction to percentage-scale', () => {
    const result = computeLeaderboards(baseInputs);
    const tribeca = result.leaderboard.find((r) => r.name === 'tribeca')!;
    expect(tribeca.pct_lux).toBeCloseTo(34, 6);
  });

  it('fills wk_contracts/wk_volume from the shared weekly-stats map, null when absent', () => {
    const result = computeLeaderboards(baseInputs);
    const tribeca = result.leaderboard.find((r) => r.name === 'tribeca')!;
    expect(tribeca.wk_contracts).toBe(4);
    const nolita = result.leaderboard.find((r) => r.name === 'nolita')!;
    expect(nolita.wk_contracts).toBeNull();
  });

  it('computes rank_delta as historical_rank - current_rank, null when not found historically', () => {
    const historical = rankResp([
      hood('tribeca', 500_000_000, 80, 0.3), // was rank 1 historically by volume
      hood('upper east side', 1_600_000_000, 140, 0.18), // was rank 2 -- wait must sort by volume: tribeca 500M < upper east 1.6B, so actually upper east side ranks 1 historically too.
    ]);
    const result = computeLeaderboards({ ...baseInputs, hoodRankHistorical: historical });
    const ues = result.leaderboard.find((r) => r.name === 'upper east side')!;
    // historically upper east side (1.6B) ranks above tribeca (500M) by volume -> historical_rank=1, current_rank=1 -> delta 0
    expect(ues.rank_delta).toBe(0);
    const nolita = result.leaderboard.find((r) => r.name === 'nolita')!;
    expect(nolita.rank_delta).toBeNull(); // not present historically
  });

  it('filters concentrated_leaderboard to neighborhoods with >= 11 qualifying contracts and sorts by intensity', () => {
    const withThinHood = rankResp([
      hood('upper east side', 1_700_000_000, 144, 0.19),
      hood('tribeca', 700_000_000, 83, 0.34),
      hood('nolita', 50_000_000, 5, 0.6), // only 5 qualifying deals -- must be excluded despite high intensity
    ]);
    const result = computeLeaderboards({ ...baseInputs, hoodRankNoMinPrice: withThinHood, hoodRankMinPriceAnchored: withThinHood });
    expect(result.concentrated_leaderboard.map((r) => r.name)).toEqual(['tribeca', 'upper east side']);
  });

  it('caps both panels at 10 rows', () => {
    const many = rankResp(Array.from({ length: 15 }, (_, i) => hood(`hood${i}`, 1000 - i, 20, 0.1)));
    const result = computeLeaderboards({ ...baseInputs, hoodRankNoMinPrice: many, hoodRankMinPriceAnchored: many });
    expect(result.leaderboard).toHaveLength(10);
    expect(result.concentrated_leaderboard).toHaveLength(10);
  });
});
