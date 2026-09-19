/**
 * Backfill-only fetch orchestration: for one historical Mon-Sun week,
 * makes every Marketproof REST call the live weekly run would make,
 * anchored to that week via `end_date` (see the provenance notes on
 * WeeklyContractStatsParams.end_date / SupplyParams.end_date /
 * WeeklySalesStatsParams.end_date) instead of "now".
 *
 * This is deliberately I/O-heavy and NOT part of compute/ (which stays
 * pure) -- it exists only to feed compute/'s pure functions with real
 * fetched data for the backfill comparison in backfill/run.ts.
 */

import {
  fetchLuxuryContractStats,
  fetchWeeklyContractStats,
  fetchWeeklySalesStats,
  fetchNeighborhoodRank,
  fetchSupply,
  type LuxuryContractStatsResponse,
  type WeeklyContractStatsResponse,
  type WeeklySalesStatsResponse,
  type NeighborhoodRankResponse,
  type SupplyResponse,
} from '../fetch';
import { addDaysIso, findByDateStartsWith } from '../compute/lib';
import type { NeighborhoodWeeklyStatsMap, TierCutoffs } from '../compute/types';

const MANHATTAN_Q = 'borough:manhattan';

export interface WeekFetchBundlePhase1 {
  lux52: LuxuryContractStatsResponse | null;
  lux13: LuxuryContractStatsResponse | null;
  lux52PriorYr: LuxuryContractStatsResponse | null;
  weeklyContractStats: WeeklyContractStatsResponse | null;
  weeklySalesStats: WeeklySalesStatsResponse | null;
  /** STEP 3.5's price-filtered pool (>= $4.95M), used only by sowhat's discount metric. */
  weeklySalesStatsPriceFiltered: WeeklySalesStatsResponse | null;
  hoodRankNoMinPrice: NeighborhoodRankResponse | null;
  hoodRankHistorical: NeighborhoodRankResponse | null;
  hoodRank13: NeighborhoodRankResponse | null;
  supplyAll: SupplyResponse | null;
}

/** Phase 1: every call that doesn't depend on this week's own computed cutoffs. All independent -- fetched in parallel. */
export async function fetchWeekPhase1(weekStart: string, weekEnd: string): Promise<WeekFetchBundlePhase1> {
  const priorYrEndDate = addDaysIso(weekEnd, -364);
  const historicalRankEndDate = addDaysIso(weekEnd, -364);

  const [
    lux52,
    lux13,
    lux52PriorYr,
    weeklyContractStats,
    weeklySalesStats,
    weeklySalesStatsPriceFiltered,
    hoodRankNoMinPrice,
    hoodRankHistorical,
    hoodRank13,
    supplyAll,
  ] = await Promise.all([
    fetchLuxuryContractStats({ q: MANHATTAN_Q, granularity: 'weekly', window: 'trailing-52w', percentile: [90, 95, 99], history: 'annual', end_date: weekEnd }),
    fetchLuxuryContractStats({ q: MANHATTAN_Q, granularity: 'weekly', window: 'trailing-13w', percentile: [90, 95, 99], end_date: weekEnd }),
    fetchLuxuryContractStats({ q: MANHATTAN_Q, granularity: 'weekly', window: 'trailing-52w', percentile: [90, 95, 99], end_date: priorYrEndDate }),
    fetchWeeklyContractStats({ q: MANHATTAN_Q, end_date: weekEnd }),
    fetchWeeklySalesStats({ q: MANHATTAN_Q, end_date: weekEnd }),
    fetchWeeklySalesStats({ q: `${MANHATTAN_Q} AND price:[4950000 TO *]`, end_date: weekEnd }),
    fetchNeighborhoodRank({ borough: 'manhattan', window: 'trailing-52w', sort_by: 90, limit: 99, min_contracts: 0, end_date: weekEnd }),
    fetchNeighborhoodRank({ borough: 'manhattan', window: 'trailing-52w', sort_by: 90, limit: 99, min_contracts: 0, end_date: historicalRankEndDate }),
    fetchNeighborhoodRank({ borough: 'manhattan', window: 'trailing-13w', sort_by: 90, limit: 10, end_date: weekEnd, min_contracts: 0 }),
    fetchSupply({ granularity: 'weekly', borough: 'Manhattan', end_date: weekEnd }),
  ]);

  return {
    lux52,
    lux13,
    lux52PriorYr,
    weeklyContractStats,
    weeklySalesStats,
    weeklySalesStatsPriceFiltered,
    hoodRankNoMinPrice,
    hoodRankHistorical,
    hoodRank13,
    supplyAll,
  };
}

export interface WeekFetchBundlePhase2 {
  hoodRankMinPriceAnchored: NeighborhoodRankResponse | null;
  supplyLuxury: SupplyResponse | null;
  supplyPrime: SupplyResponse | null;
  luxuryBandWeeklyStats: WeeklyContractStatsResponse | null;
  primeBandWeeklyStats: WeeklyContractStatsResponse | null;
}

/** Phase 2: needs this week's own cutoffs (from lux52, already fetched in phase 1) to price-band its calls. */
export async function fetchWeekPhase2(weekEnd: string, cutoffs: TierCutoffs): Promise<WeekFetchBundlePhase2> {
  const { luxury, prime, trophy } = cutoffs;

  const [hoodRankMinPriceAnchored, supplyLuxury, supplyPrime, luxuryBandWeeklyStats, primeBandWeeklyStats] = await Promise.all([
    luxury !== null
      ? fetchNeighborhoodRank({
          borough: 'manhattan',
          window: 'trailing-52w',
          sort_by: 90,
          limit: 99,
          min_contracts: 0,
          min_price: luxury,
          end_date: weekEnd,
          cacheRefresh: true,
        })
      : Promise.resolve(null),
    luxury !== null ? fetchSupply({ granularity: 'weekly', borough: 'Manhattan', min_price: luxury, end_date: weekEnd }) : Promise.resolve(null),
    prime !== null ? fetchSupply({ granularity: 'weekly', borough: 'Manhattan', min_price: prime, end_date: weekEnd }) : Promise.resolve(null),
    luxury !== null && prime !== null
      ? fetchWeeklyContractStats({ q: `${MANHATTAN_Q} AND price:[${luxury} TO ${prime}}`, end_date: weekEnd })
      : Promise.resolve(null),
    prime !== null && trophy !== null
      ? fetchWeeklyContractStats({ q: `${MANHATTAN_Q} AND price:[${prime} TO ${trophy}}`, end_date: weekEnd })
      : Promise.resolve(null),
  ]);

  return { hoodRankMinPriceAnchored, supplyLuxury, supplyPrime, luxuryBandWeeklyStats, primeBandWeeklyStats };
}

/** Phase 3: per-neighborhood weekly-contract-stats for wk_contracts/wk_volume (STEP 4(c)), for a given set of (already lower-cased) neighborhood names. Quotes multi-word names, per the 2026-07-23 fix. */
export async function fetchNeighborhoodWeeklyStats(
  names: readonly string[],
  boroughP90Cutoff: number | null,
  weekStart: string,
  weekEnd: string,
): Promise<NeighborhoodWeeklyStatsMap> {
  const map: NeighborhoodWeeklyStatsMap = new Map();
  if (boroughP90Cutoff === null) return map;

  const uniqueNames = [...new Set(names)];
  const results = await Promise.all(
    uniqueNames.map((name) =>
      fetchWeeklyContractStats({
        q: `${MANHATTAN_Q} AND neighborhood:"${name}" AND price:[${boroughP90Cutoff} TO *]`,
        end_date: weekEnd,
      }),
    ),
  );

  uniqueNames.forEach((name, i) => {
    const response = results[i];
    const series = response?.all?.contractsByWeek ?? [];
    const entry = findByDateStartsWith(series, weekStart);
    map.set(name, {
      wkContracts: entry?.contractCount ?? entry?.salesCount ?? null,
      wkVolume: entry?.totalPrice ?? null,
    });
  });

  return map;
}

/** STEP 1.7's conditional new-quarter cutoff pull -- one luxury-contract-stats call anchored to a just-closed quarter's last calendar day, ONLY made when `planQuarterlyHistoryUpdate` says a new quarter needs appending. */
export async function fetchQuarterCutoffs(
  label: string,
  endDateForFetch: string,
): Promise<{ label: string; p90: number; p95: number; p99: number } | null> {
  const response = await fetchLuxuryContractStats({
    q: MANHATTAN_Q,
    granularity: 'weekly',
    window: 'trailing-52w',
    percentile: [90, 95, 99],
    end_date: endDateForFetch,
  });
  if (!response) return null;
  const { p90, p95, p99 } = response.lines;
  if (p90.cutoff == null || p95.cutoff == null || p99.cutoff == null) return null;
  return { label, p90: p90.cutoff, p95: p95.cutoff, p99: p99.cutoff };
}
