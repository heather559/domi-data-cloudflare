/**
 * Assembles a full WeeklyReportPayload for one historical week, wiring
 * together every fetched response (from fetchWeek.ts) and every compute/
 * function. This is the same assembly the live run.ts entrypoint will
 * eventually use once backfill results are reviewed -- kept here for now,
 * per the task's instruction not to wire this into index.ts's scheduled
 * entrypoint yet.
 */

import { fetchTopDeals } from '../topDeals/fetchTopDeals';
import type { WeeklyReportPayload } from '../schema/weeklyReportPayload';
import type { PriorWeekValues } from '../compute/types';
import { computeStep1 } from '../compute/hero';
import { computeTierSeries } from '../compute/tierSeries';
import { computeMarketPulseAndTypeTrends } from '../compute/marketPulse';
import { computeSupply } from '../compute/supply';
import { computeLeaderboards } from '../compute/leaderboard';
import { computeWeeklyActivityLeaderboard } from '../compute/weeklyActivity';
import { computeSowhat } from '../compute/sowhat';
import type { WeekFetchBundlePhase1, WeekFetchBundlePhase2 } from './fetchWeek';
import type { NeighborhoodWeeklyStatsMap } from '../compute/types';

export interface BuildPayloadInputs {
  weekStart: string;
  weekEnd: string;
  phase1: WeekFetchBundlePhase1;
  phase2: WeekFetchBundlePhase2;
  prior: PriorWeekValues;
  /** Whether to actually call fetchTopDeals (Anthropic + Marketproof MCP) -- costs real API calls, and is confirmed blocked on a missing MCP OAuth credential (see topDeals/fetchTopDeals.ts). Defaults true so the plumbing is still exercised per the task brief ("call it anyway"). */
  callTopDeals?: boolean;
  /** Phase 3: per-neighborhood {wk_contracts, wk_volume} (STEP 4(c)), fetched by the caller (run.ts) before this function since it depends on the leaderboard's own top-10-by-volume and top-10-by-intensity name sets. */
  neighborhoodWeeklyStats?: NeighborhoodWeeklyStatsMap;
  /** STEP 1.7's resolved history_quarterly object -- resolved by the caller (run.ts) since appending a newly-closed quarter needs its own conditional fetch decided by planQuarterlyHistoryUpdate, which compute/ itself never performs. */
  historyQuarterly?: { labels: string[]; p90: number[]; p95: number[]; p99: number[] };
}

export async function buildPayloadForWeek(inputs: BuildPayloadInputs): Promise<WeeklyReportPayload> {
  const { weekStart, weekEnd, phase1, phase2, prior } = inputs;

  // --- STEP 1 / 1.6: hero, tier cards, demand_trend, history_annual, dom_series.luxury/luxury_p95 ---
  const step1 = computeStep1(phase1.lux52, phase1.lux52PriorYr, prior, weekStart);

  const cutoffs = {
    luxury: step1.hero.luxury_cutoff,
    prime: step1.hero.prime_cutoff,
    trophy: step1.hero.trophy_cutoff,
  };

  // --- STEP 1.7: quarterly history -- resolved entirely by the caller (run.ts) before calling this function; see BuildPayloadInputs.historyQuarterly. ---

  // --- STEP 1.8(B)/(C): tier_series ---
  const tierSeries = computeTierSeries(phase1.lux52, phase2.luxuryBandWeeklyStats, phase2.primeBandWeeklyStats, weekStart);

  // --- STEP 2/3: market_pulse, type_trends, bedroom_mix ---
  const { marketPulse, typeTrends, bedroomMix } = computeMarketPulseAndTypeTrends(
    phase1.weeklyContractStats,
    phase1.weeklySalesStats,
    prior,
    weekStart,
  );

  // --- STEP 5: supply ---
  const supply = computeSupply({
    supplyAll: phase1.supplyAll,
    supplyLuxury: phase2.supplyLuxury,
    supplyPrime: phase2.supplyPrime,
    weekEnd,
    lux52: phase1.lux52,
    lux52PriorYr: phase1.lux52PriorYr,
    marketPulseAllSeries: phase1.weeklyContractStats?.all?.contractsByWeek ?? [],
    marketPulseAllContractsAvg52: marketPulse.all.contracts_avg52,
    domSeriesLuxury: step1.domSeriesLuxury,
    domSeriesLuxuryP95: step1.domSeriesLuxuryP95,
    demandTrendLabels: step1.demandTrend.labels,
    weeklySalesStats: phase1.weeklySalesStats,
  });

  // --- STEP 4/4b: leaderboard + concentrated_leaderboard ---
  const neighborhoodWeeklyStats: NeighborhoodWeeklyStatsMap = inputs.neighborhoodWeeklyStats ?? new Map();

  const { leaderboard, concentrated_leaderboard } = computeLeaderboards({
    hoodRankNoMinPrice: phase1.hoodRankNoMinPrice,
    hoodRankMinPriceAnchored: phase2.hoodRankMinPriceAnchored,
    hoodRankHistorical: phase1.hoodRankHistorical,
    weeklyStats: neighborhoodWeeklyStats,
  });

  // --- STEP 4c: weekly_activity_leaderboard -- unavailable (search_activities MCP/OAuth blocker, same as top_deals) ---
  const weekly_activity_leaderboard = computeWeeklyActivityLeaderboard(
    null,
    cutoffs.luxury,
    leaderboard.map((r) => r.name),
    concentrated_leaderboard.map((r) => r.name),
  );

  // --- STEP 6: top_deals ---
  const topDeals =
    inputs.callTopDeals !== false && cutoffs.luxury !== null ? await fetchTopDeals(weekStart, weekEnd, cutoffs.luxury) : [];

  // --- STEP 6.5: sowhat ---
  const sowhat = computeSowhat({
    lux52: phase1.lux52,
    lux13: phase1.lux13,
    salesWk: phase1.weeklySalesStatsPriceFiltered,
    hoodRank13: phase1.hoodRank13,
    hoodRank52full: phase1.hoodRankNoMinPrice,
    supplyLuxuryActive: supply.luxury.active,
    heroLuxuryCount: step1.hero.luxury_count,
    heroLuxuryVolume: step1.hero.luxury_volume,
    topDeals,
    prevSupplyBandLabel: prior.prevSupplyBandLabel,
    prevStreakWeeks: prior.prevStreakWeeks,
    weekStart,
  });

  return {
    hero: step1.hero,
    demand_trend: step1.demandTrend,
    tiers: {
      luxury: step1.tierCards.luxury,
      prime: step1.tierCards.prime,
      trophy: step1.tierCards.trophy,
      history_annual: step1.historyAnnual,
      history_quarterly: inputs.historyQuarterly ?? { labels: [], p90: [], p95: [], p99: [] },
    },
    market_pulse: marketPulse,
    bedroom_mix: bedroomMix,
    leaderboard,
    concentrated_leaderboard,
    weekly_activity_leaderboard,
    supply,
    type_trends: typeTrends,
    top_deals: topDeals,
    sowhat,
    tier_series: tierSeries,
    tier_series_methodology_note: tierSeries
      ? "Luxury and Prime band median/PPSF/DOM are bounded by the current run's fixed P90/P95/P99 cutoffs at every historical week, not that week's own historical cutoff (no per-week percentile exists at weekly grain) -- same disclosed fixed-floor-across-time precedent as the Foundational Report's Part I methodology. Trophy needs no such caveat (already an exclusive, open-ended top band at every week, no cutoff-anchoring involved)."
      : null,
  };
}
