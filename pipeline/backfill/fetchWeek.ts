/**
 * Fetch orchestration for one Mon-Sun week: makes every Marketproof REST
 * call the weekly run needs, shared by both the live pipeline (index.ts)
 * and the backfill harness (backfill/run.ts).
 *
 * This is deliberately I/O-heavy and NOT part of compute/ (which stays
 * pure) -- it exists only to feed compute/'s pure functions with real
 * fetched data, either for a real live run or for the backfill comparison
 * in backfill/run.ts.
 *
 * ANCHOR MODE -- `end_date` pinning, live vs. backfill (decided 2026-09-21):
 *
 * Every call below falls into one of two buckets:
 *
 *   1. "Current week" calls -- asking Marketproof "what does the trailing
 *      window looks like as of THIS week's own data". For backfill this
 *      has no choice but to pin `end_date` to that historical week's end
 *      (there is no other way to reconstruct a past week). For a LIVE run,
 *      the owner's explicit decision is to NOT pin `end_date` at all --
 *      omit it so Marketproof defaults to "as of right now", matching
 *      exactly what the old site-data-agent routine did (it never sent an
 *      end_date param). Two things drove this: (a) parity with the old
 *      system's methodology is the goal, not independent "precision", and
 *      (b) live testing found that supplying `end_date` on weekly-grain
 *      endpoints makes Marketproof snap the window a full week earlier
 *      than the date requested -- a real quirk, not a wash -- so pinning
 *      on the live path was actively making the numbers *less* correct,
 *      not more.
 *
 *   2. "Historical reference point" calls -- asking a question that is
 *      inherently about a specific date, e.g. "what did the cutoff look
 *      like exactly a year ago" (`lux52PriorYr`, `hoodRankHistorical`) or
 *      "what were a specific already-closed quarter's cutoffs"
 *      (`fetchQuarterCutoffs`). These are meaningless without a pinned
 *      date in EITHER context and are computed/passed identically for live
 *      and backfill, unchanged by this decision.
 *
 * `fetchWeekPhase1`/`fetchWeekPhase2`/`fetchNeighborhoodWeeklyStats` take
 * an explicit `mode: AnchorMode` so callers can't accidentally get this
 * backwards -- `currentWeekEndDate()` below is the one place that decides
 * whether a "current week" call gets a real date or `undefined`.
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

/**
 * `'live'` -- the real weekly pipeline run, reporting on the week that just
 * ended. `'backfill'` -- reconstructing an already-closed historical week.
 * See the module header for what this changes and why.
 */
export type AnchorMode = 'live' | 'backfill';

/**
 * The `end_date` to send on a "current week" call (see module header bucket
 * 1): the real historical week-end for backfill, or `undefined` for live so
 * Marketproof defaults to "as of right now" -- never pinned on the live
 * path, on purpose.
 */
function currentWeekEndDate(mode: AnchorMode, weekEnd: string): string | undefined {
  const resolved = mode === 'backfill' ? weekEnd : undefined;
  // Deliberately loud, not debug-gated: this is the one line that proves,
  // in every Railway run, whether a given week's "current week" calls went
  // out pinned or not -- exactly the kind of thing the 2026-09-21 anchor
  // decision needs to stay provably correct over time, not just at review
  // time.
  console.log(`[fetchWeek] anchorMode=${mode} weekEnd=${weekEnd} -> current-week end_date=${resolved ?? 'undefined (omitted -- Marketproof defaults to "now")'}`);
  return resolved;
}

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
export async function fetchWeekPhase1(weekStart: string, weekEnd: string, mode: AnchorMode): Promise<WeekFetchBundlePhase1> {
  // Historical reference points (module header bucket 2) -- always a real
  // pinned date, identical for live and backfill.
  const priorYrEndDate = addDaysIso(weekEnd, -364);
  const historicalRankEndDate = addDaysIso(weekEnd, -364);
  // "Current week" calls (module header bucket 1) -- pinned for backfill,
  // omitted (Marketproof defaults to "now") for live.
  const currentEndDate = currentWeekEndDate(mode, weekEnd);

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
    fetchLuxuryContractStats({ q: MANHATTAN_Q, granularity: 'weekly', window: 'trailing-52w', percentile: [90, 95, 99], history: 'annual', end_date: currentEndDate }),
    fetchLuxuryContractStats({ q: MANHATTAN_Q, granularity: 'weekly', window: 'trailing-13w', percentile: [90, 95, 99], end_date: currentEndDate }),
    fetchLuxuryContractStats({ q: MANHATTAN_Q, granularity: 'weekly', window: 'trailing-52w', percentile: [90, 95, 99], end_date: priorYrEndDate }),
    fetchWeeklyContractStats({ q: MANHATTAN_Q, end_date: currentEndDate }),
    fetchWeeklySalesStats({ q: MANHATTAN_Q, end_date: currentEndDate }),
    fetchWeeklySalesStats({ q: `${MANHATTAN_Q} AND price:[4950000 TO *]`, end_date: currentEndDate }),
    fetchNeighborhoodRank({ borough: 'manhattan', window: 'trailing-52w', sort_by: 90, limit: 99, min_contracts: 0, end_date: currentEndDate }),
    fetchNeighborhoodRank({ borough: 'manhattan', window: 'trailing-52w', sort_by: 90, limit: 99, min_contracts: 0, end_date: historicalRankEndDate }),
    fetchNeighborhoodRank({ borough: 'manhattan', window: 'trailing-13w', sort_by: 90, limit: 10, end_date: currentEndDate, min_contracts: 0 }),
    fetchSupply({ granularity: 'weekly', borough: 'Manhattan', end_date: currentEndDate }),
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
export async function fetchWeekPhase2(weekEnd: string, cutoffs: TierCutoffs, mode: AnchorMode): Promise<WeekFetchBundlePhase2> {
  const { luxury, prime, trophy } = cutoffs;
  // All of phase 2 is "current week" calls (module header bucket 1) --
  // pinned for backfill, omitted for live.
  const currentEndDate = currentWeekEndDate(mode, weekEnd);

  const [hoodRankMinPriceAnchored, supplyLuxury, supplyPrime, luxuryBandWeeklyStats, primeBandWeeklyStats] = await Promise.all([
    luxury !== null
      ? fetchNeighborhoodRank({
          borough: 'manhattan',
          window: 'trailing-52w',
          sort_by: 90,
          limit: 99,
          min_contracts: 0,
          min_price: luxury,
          end_date: currentEndDate,
          cacheRefresh: true,
        })
      : Promise.resolve(null),
    luxury !== null ? fetchSupply({ granularity: 'weekly', borough: 'Manhattan', min_price: luxury, end_date: currentEndDate }) : Promise.resolve(null),
    prime !== null ? fetchSupply({ granularity: 'weekly', borough: 'Manhattan', min_price: prime, end_date: currentEndDate }) : Promise.resolve(null),
    luxury !== null && prime !== null
      ? fetchWeeklyContractStats({ q: `${MANHATTAN_Q} AND price:[${luxury} TO ${prime}}`, end_date: currentEndDate })
      : Promise.resolve(null),
    prime !== null && trophy !== null
      ? fetchWeeklyContractStats({ q: `${MANHATTAN_Q} AND price:[${prime} TO ${trophy}}`, end_date: currentEndDate })
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
  mode: AnchorMode,
): Promise<NeighborhoodWeeklyStatsMap> {
  const map: NeighborhoodWeeklyStatsMap = new Map();
  if (boroughP90Cutoff === null) return map;

  const currentEndDate = currentWeekEndDate(mode, weekEnd);
  const uniqueNames = [...new Set(names)];
  const results = await Promise.all(
    uniqueNames.map((name) =>
      fetchWeeklyContractStats({
        q: `${MANHATTAN_Q} AND neighborhood:"${name}" AND price:[${boroughP90Cutoff} TO *]`,
        end_date: currentEndDate,
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

/**
 * STEP 1.7's conditional new-quarter cutoff pull -- one luxury-contract-stats
 * call anchored to a just-closed quarter's last calendar day, ONLY made when
 * `planQuarterlyHistoryUpdate` says a new quarter needs appending.
 *
 * No `AnchorMode` param, deliberately: `endDateForFetch` (from
 * `mostRecentCompletedQuarter`) is always a specific already-closed
 * quarter's fixed last day -- a "historical reference point" call (module
 * header bucket 2), the same category as `lux52PriorYr`/`hoodRankHistorical`,
 * not a "current week" one. It's meaningless without a pinned date in either
 * live or backfill, so it stays pinned unconditionally, unchanged by the
 * live-vs-backfill anchor decision.
 */
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
