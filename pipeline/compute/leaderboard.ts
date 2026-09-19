/**
 * STEP 4 + STEP 4b -- `leaderboard` (ranked by 52-week luxury dollar
 * volume, per the 2026-07-23 revert) and `concentrated_leaderboard` (ranked
 * by luxury intensity among neighborhoods with >= 11 luxury-qualifying
 * deals). Both panels share the same three neighborhood-rank responses and
 * the same per-neighborhood weekly-contract-stats lookups -- only the
 * selection/sort key and the >= 11 floor differ.
 */

import type { NeighborhoodEntry, NeighborhoodRankResponse } from '../fetch/schemas';
import type { RankedLeaderboardRow } from '../schema/weeklyReportPayload';
import type { NeighborhoodWeeklyStatsMap } from './types';

const CONCENTRATED_MIN_QUALIFYING_CONTRACTS = 11;
const TOP_N = 10;

function sortByVolumeDesc(neighborhoods: readonly NeighborhoodEntry[]): NeighborhoodEntry[] {
  // Deliberately ignoring the API's own native `rank` field -- it's always
  // intensity-ordered regardless of sort_by (a fact about the endpoint, not
  // an instruction), per STEP 4's 2026-07-23 revert to a manual volume sort.
  return [...neighborhoods].sort((a, b) => (b.tiers.p90.totalPrice ?? -Infinity) - (a.tiers.p90.totalPrice ?? -Infinity));
}

function sortByIntensityDesc(neighborhoods: readonly NeighborhoodEntry[]): NeighborhoodEntry[] {
  return [...neighborhoods].sort((a, b) => (b.tiers.p90.pct ?? -Infinity) - (a.tiers.p90.pct ?? -Infinity));
}

/** Builds a name -> 1-indexed rank map from an already-sorted neighborhood list. */
function buildRankMap(sorted: readonly NeighborhoodEntry[]): Map<string, number> {
  const map = new Map<string, number>();
  sorted.forEach((n, i) => map.set(n.neighborhood, i + 1));
  return map;
}

function buildRow(
  name: string,
  rank: number,
  anchoredByName: Map<string, NeighborhoodEntry>,
  weeklyStats: NeighborhoodWeeklyStatsMap,
  historicalRankMap: Map<string, number>,
): RankedLeaderboardRow {
  const anchored = anchoredByName.get(name);
  const p90 = anchored?.tiers.p90;
  const weekly = weeklyStats.get(name);
  const historicalRank = historicalRankMap.get(name) ?? null;

  return {
    rank,
    name,
    vol_52wk: p90?.totalPrice ?? null,
    contracts_52wk: p90?.count ?? p90?.totalCount ?? null,
    local_median: p90?.medianPrice ?? null,
    avg_sale: p90?.averagePrice ?? null,
    pct_lux: p90?.pct != null ? p90.pct * 100 : null, // UNITS RULE: 0-1 fraction -> percentage-scale
    wk_contracts: weekly?.wkContracts ?? null,
    wk_volume: weekly?.wkVolume ?? null,
    rank_delta: historicalRank !== null ? historicalRank - rank : null,
  };
}

export interface ComputeLeaderboardsInputs {
  /** neighborhood-rank, no min_price, limit:99, min_contracts:0 -- STEP 4(a). Provides the ranking basis for both panels. */
  hoodRankNoMinPrice: NeighborhoodRankResponse | null;
  /** neighborhood-rank?cache=refresh, min_price=hero.luxury_cutoff -- STEP 4(b). Provides every numeric field, bit-consistent with hero.luxury_cutoff. */
  hoodRankMinPriceAnchored: NeighborhoodRankResponse | null;
  /** neighborhood-rank, no min_price, end_date = week_end - 364d -- STEP 4(d)/4b's shared historical lookup for rank_delta. */
  hoodRankHistorical: NeighborhoodRankResponse | null;
  /** Per-neighborhood {wk_contracts, wk_volume} from weekly-contract-stats (STEP 4(c)), keyed by lowercase name, shared/reused across both panels. */
  weeklyStats: NeighborhoodWeeklyStatsMap;
}

export interface ComputeLeaderboardsResult {
  leaderboard: RankedLeaderboardRow[];
  concentrated_leaderboard: RankedLeaderboardRow[];
}

export function computeLeaderboards(inputs: ComputeLeaderboardsInputs): ComputeLeaderboardsResult {
  if (!inputs.hoodRankNoMinPrice) {
    return { leaderboard: [], concentrated_leaderboard: [] };
  }

  const anchoredByName = new Map(
    (inputs.hoodRankMinPriceAnchored?.neighborhoods ?? []).map((n) => [n.neighborhood, n] as const),
  );
  const historicalAll = inputs.hoodRankHistorical?.neighborhoods ?? [];

  // --- leaderboard: top 10 by 52-week luxury dollar volume ---
  const volumeSorted = sortByVolumeDesc(inputs.hoodRankNoMinPrice.neighborhoods);
  const top10ByVolume = volumeSorted.slice(0, TOP_N);
  const historicalVolumeRankMap = buildRankMap(sortByVolumeDesc(historicalAll));
  const leaderboard = top10ByVolume.map((n, i) =>
    buildRow(n.neighborhood, i + 1, anchoredByName, inputs.weeklyStats, historicalVolumeRankMap),
  );

  // --- concentrated_leaderboard: top 10 by luxury intensity among neighborhoods with >= 11 qualifying contracts ---
  const qualifying = inputs.hoodRankNoMinPrice.neighborhoods.filter(
    (n) => (n.tiers.p90.count ?? n.tiers.p90.totalCount ?? 0) >= CONCENTRATED_MIN_QUALIFYING_CONTRACTS,
  );
  const intensitySorted = sortByIntensityDesc(qualifying);
  const top10ByIntensity = intensitySorted.slice(0, TOP_N);
  const historicalQualifying = historicalAll.filter(
    (n) => (n.tiers.p90.count ?? n.tiers.p90.totalCount ?? 0) >= CONCENTRATED_MIN_QUALIFYING_CONTRACTS,
  );
  const historicalIntensityRankMap = buildRankMap(sortByIntensityDesc(historicalQualifying));
  const concentrated_leaderboard = top10ByIntensity.map((n, i) =>
    buildRow(n.neighborhood, i + 1, anchoredByName, inputs.weeklyStats, historicalIntensityRankMap),
  );

  return { leaderboard, concentrated_leaderboard };
}
