/**
 * Shared input/output types for the compute/ layer.
 *
 * ARCHITECTURAL RULE (per the task brief, non-negotiable): this pipeline is
 * NOT stateless week-to-week. Every function in compute/ that needs last
 * week's stored values takes them as an EXPLICIT parameter -- never fetches
 * them internally. This is what makes backfill/ possible: the harness reads
 * prior-week values from Supabase (or from its own previously-computed
 * result) and threads them in, one historical week at a time, exactly the
 * way the live weekly run will thread in yesterday's real stored row.
 */

import type { TierCard, RankedLeaderboardRow } from '../schema/weeklyReportPayload';

/** Everything STEP 0's "last week" lookup pulls from `public.weekly_report`, gathered in one place so callers only need to plumb one object around. Every field is null if no row existed for last week (first-ever run, or a gap). */
export interface PriorWeekValues {
  /** payload->'sowhat'->>'supply_band_label' */
  prevSupplyBandLabel: string | null;
  /** payload->'sowhat'->>'streak_weeks' */
  prevStreakWeeks: number | null;
  /** payload->'hero'->>'luxury_count' */
  prevLuxuryCount: number | null;
  /** payload->'hero'->>'luxury_volume' */
  prevLuxuryVolume: number | null;
  /** payload->'tiers'->'history_quarterly' */
  prevQuarterlyHistory: { labels: string[]; p90: number[]; p95: number[]; p99: number[] } | null;
  /** payload->'tiers' (luxury/prime/trophy TierCards only -- history_annual/history_quarterly not needed here) */
  prevTiers: { luxury: TierCard; prime: TierCard; trophy: TierCard } | null;
  /** payload->'market_pulse'->'all' */
  prevPulseAll: {
    contracts: number | null;
    volume: number | null;
  } | null;
}

export const EMPTY_PRIOR_WEEK: PriorWeekValues = {
  prevSupplyBandLabel: null,
  prevStreakWeeks: null,
  prevLuxuryCount: null,
  prevLuxuryVolume: null,
  prevQuarterlyHistory: null,
  prevTiers: null,
  prevPulseAll: null,
};

/** A single tier's cutoff, used repeatedly (STEP 4/5's price-banding, STEP 1.8's fixed-cutoff tier_series). */
export interface TierCutoffs {
  luxury: number | null;
  prime: number | null;
  trophy: number | null;
}

/** Minimal per-neighborhood weekly figures needed by STEP 4(c)/4b (`wk_contracts`/`wk_volume`), keyed by lowercase neighborhood name so callers can fetch once and reuse across leaderboard + concentrated_leaderboard. */
export type NeighborhoodWeeklyStatsMap = Map<string, { wkContracts: number | null; wkVolume: number | null }>;

/** A raw (pre-payload-shape) leaderboard row candidate, before rank_delta and final field selection -- shared shape used internally by compute/leaderboard.ts. */
export type LeaderboardCandidate = Omit<RankedLeaderboardRow, 'rank'>;
