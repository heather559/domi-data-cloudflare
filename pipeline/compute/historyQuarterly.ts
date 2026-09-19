/**
 * STEP 1.7 -- QUARTERLY CUTOFF-PRICE HISTORY.
 *
 * Split into two pure steps because the spec's own logic is conditional on
 * an extra API call that only fires "in the rare week a calendar quarter
 * just closed" -- and per this task's architectural rule, compute/ never
 * performs I/O itself. The caller (backfill harness or the live run) calls
 * `planQuarterlyHistoryUpdate` first (pure), does the fetch IF the plan asks
 * for one, then calls `applyQuarterlyHistoryUpdate` (also pure) with
 * whatever it got back (or `null` if the call failed or wasn't needed).
 */

import type { TierCutoffs } from './types';
import { mostRecentCompletedQuarter } from './lib';

export interface QuarterlyHistory {
  labels: string[];
  p90: number[];
  p95: number[];
  p99: number[];
}

export interface QuarterlyHistoryPlan {
  /** The carried-forward base (prev history with a trailing "Current" entry dropped), or null if there's no prior history at all (first run after this feature shipped). */
  carriedForward: QuarterlyHistory | null;
  /** Set when a new quarter has closed since last week's run and its cutoffs need fetching. Null when nothing new needs to be pulled. */
  needsFetchForQuarter: { label: string; endDateForFetch: string } | null;
}

/** Drops the trailing "Current" entry from a quarterly history object, if present -- it was last week's provisional live point, never accumulated. */
function dropTrailingCurrent(history: QuarterlyHistory): QuarterlyHistory {
  const isCurrent = history.labels.at(-1) === 'Current';
  if (!isCurrent) return history;
  return {
    labels: history.labels.slice(0, -1),
    p90: history.p90.slice(0, -1),
    p95: history.p95.slice(0, -1),
    p99: history.p99.slice(0, -1),
  };
}

/**
 * Decides whether a new luxury-contract-stats call (end_date = the newly
 * closed quarter's last calendar day) is needed this week, per STEP 1.7.
 */
export function planQuarterlyHistoryUpdate(
  prevQuarterlyHistory: QuarterlyHistory | null,
  weekEnd: string,
): QuarterlyHistoryPlan {
  if (!prevQuarterlyHistory) {
    return { carriedForward: null, needsFetchForQuarter: null };
  }

  const carriedForward = dropTrailingCurrent(prevQuarterlyHistory);
  const { label, lastDay } = mostRecentCompletedQuarter(weekEnd);

  const alreadyPresent = carriedForward.labels.at(-1) === label;
  return {
    carriedForward,
    needsFetchForQuarter: alreadyPresent ? null : { label, endDateForFetch: lastDay },
  };
}

/**
 * Applies the plan: appends a newly-fetched quarter's cutoffs (if the plan
 * asked for one and the fetch succeeded), then always appends the "Current"
 * tail using this week's own live cutoffs.
 *
 * `newQuarterCutoffs` should be `null` when either no new quarter needed
 * fetching, or the fetch was attempted and failed after 1 retry (per spec:
 * "skip appending that quarter this week ... still refresh the Current
 * tail").
 *
 * When `plan.carriedForward` is null (no prior history at all), this
 * produces the "minimal object containing just today's live point" the
 * spec calls for on a first-ever run.
 */
export function applyQuarterlyHistoryUpdate(
  plan: QuarterlyHistoryPlan,
  newQuarterCutoffs: { label: string; p90: number; p95: number; p99: number } | null,
  liveCutoffs: TierCutoffs,
): QuarterlyHistory {
  const base: QuarterlyHistory = plan.carriedForward ?? { labels: [], p90: [], p95: [], p99: [] };

  const withNewQuarter =
    plan.needsFetchForQuarter && newQuarterCutoffs && newQuarterCutoffs.label === plan.needsFetchForQuarter.label
      ? {
          labels: [...base.labels, newQuarterCutoffs.label],
          p90: [...base.p90, newQuarterCutoffs.p90],
          p95: [...base.p95, newQuarterCutoffs.p95],
          p99: [...base.p99, newQuarterCutoffs.p99],
        }
      : base;

  return {
    labels: [...withNewQuarter.labels, 'Current'],
    // Non-nullable number arrays per the payload schema -- 0 fallback only
    // if this week's own live cutoffs (from STEP 1) are somehow null, which
    // only happens if lux52 itself failed (an already-flagged, rarer failure).
    p90: [...withNewQuarter.p90, liveCutoffs.luxury ?? 0],
    p95: [...withNewQuarter.p95, liveCutoffs.prime ?? 0],
    p99: [...withNewQuarter.p99, liveCutoffs.trophy ?? 0],
  };
}
