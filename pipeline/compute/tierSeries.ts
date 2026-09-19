/**
 * STEP 1.8(B)/(C) -- tier_series, a 52-point (or however many lux52 covers)
 * weekly trailing history across all 3 tiers x 5 metrics, plus its
 * methodology note. Built entirely from `lux52` (already fetched for
 * STEP 1) and two NEW price-banded weekly-contract-stats responses
 * (luxury band / prime band), both matched by their own `date` field per
 * the spec's explicit warning that these two calls' week boundaries don't
 * reliably index-align with lux52 or with each other.
 */

import type { LuxuryContractStatsResponse, WeeklyContractStatsResponse } from '../fetch/schemas';
import { findByDateExact } from './lib';
import type { TierSeriesEntry } from '../schema/weeklyReportPayload';

export const TIER_SERIES_METHODOLOGY_NOTE =
  "Luxury and Prime band median/PPSF/DOM are bounded by the current run's fixed P90/P95/P99 cutoffs at every historical week, not that week's own historical cutoff (no per-week percentile exists at weekly grain) -- same disclosed fixed-floor-across-time precedent as the Foundational Report's Part I methodology. Trophy needs no such caveat (already an exclusive, open-ended top band at every week, no cutoff-anchoring involved).";

function toMillions(v: number | null | undefined): number | null {
  return v === null || v === undefined ? null : v / 1_000_000;
}

/**
 * Computes tier_series. Returns `null` (per STEP 1.8(B)'s own fail-handling:
 * "If lux52 itself fails ... skip (A) and (B) entirely") if `lux52` is null.
 * `luxuryBand`/`primeBand` may each independently be null (their own call
 * failed) -- in that case that tier's median/ppsf/dom are null for every
 * week, but count/volume (sourced from lux52 alone) are unaffected.
 */
export function computeTierSeries(
  lux52: LuxuryContractStatsResponse | null,
  luxuryBand: WeeklyContractStatsResponse | null,
  primeBand: WeeklyContractStatsResponse | null,
  weekStart: string,
): TierSeriesEntry[] | null {
  if (!lux52) return null;

  const { p90, p95, p99 } = lux52.lines;

  // Coverage = every p90 entry whose date is <= week_start (drops any
  // trailing future/in-progress stub week(s) lux52's series may carry).
  // Compared on the date-only prefix, not full-string `<=` -- confirmed via
  // live 2026-09 backfill run that these entries carry a full ISO datetime
  // ("2026-07-27T00:00:00Z"), which string-sorts AFTER a plain "2026-07-27"
  // week_start, silently dropping the current week's own entry from
  // coverage entirely (a real off-by-one confirmed live: computed tier_series
  // was missing its own most-recent week every time).
  const coverage = p90.contractsByPeriod.filter((e) => e.date.slice(0, 10) <= weekStart);

  const luxuryBandByDate = luxuryBand?.all?.contractsByWeek ?? [];
  const primeBandByDate = primeBand?.all?.contractsByWeek ?? [];

  return coverage.map((p90Entry): TierSeriesEntry => {
    // Keep the raw (possibly full-ISO-datetime) date for internal
    // exact-matching against p95/p99/luxuryBand/primeBand -- they share the
    // same raw format since they come from the same API family, so matching
    // on the untruncated string is safe and simplest. Only the OUTPUT
    // week_start field needs truncating to plain "YYYY-MM-DD" (see below).
    const date = p90Entry.date;
    const p95Entry = findByDateExact(p95.contractsByPeriod, date);
    const p99Entry = findByDateExact(p99.contractsByPeriod, date);

    const p90Count = p90Entry.contractCount ?? null;
    const p95Count = p95Entry?.contractCount ?? null;
    const p99Count = p99Entry?.contractCount ?? null;
    const p90Price = p90Entry.totalPrice ?? null;
    const p95Price = p95Entry?.totalPrice ?? null;
    const p99Price = p99Entry?.totalPrice ?? null;

    // (1) Contracts + volume via exclusive-band subtraction -- 0 is a real, valid zero-contract week, never null just because a subtraction landed on 0.
    const luxuryCount = p90Count !== null && p95Count !== null ? p90Count - p95Count : null;
    const primeCount = p95Count !== null && p99Count !== null ? p95Count - p99Count : null;
    const trophyCount = p99Count ?? null;

    const luxuryVolume = p90Price !== null && p95Price !== null ? toMillions(p90Price - p95Price) : null;
    const primeVolume = p95Price !== null && p99Price !== null ? toMillions(p95Price - p99Price) : null;
    const trophyVolume = p99Price !== null ? toMillions(p99Price) : null;

    // (2) Trophy median/ppsf/dom straight off p99 (already exclusive).
    // Null the whole median/ppsf/dom trio when contractCount == 0 -- a "$0
    // median" with no underlying contracts isn't a real value even though
    // the API itself still returns 0, not null, for that case.
    const trophyHasContracts = (p99Entry?.contractCount ?? 0) > 0;
    const trophyMedian = trophyHasContracts ? toMillions(p99Entry?.medianPrice ?? null) : null;
    const trophyPpsf = trophyHasContracts ? p99Entry?.ppsf ?? null : null;
    // dom is nulled independently on a missing (not absent-due-to-zero-contracts) avgDaysOnMarket key, per spec -- optional access covers both "key missing" and "zero contracts" as null, which matches the required behavior in both cases here.
    const trophyDom = trophyHasContracts ? p99Entry?.avgDaysOnMarket ?? null : null;

    // (3) Luxury/Prime median/ppsf/dom from the two price-banded calls, matched by date (never by array position).
    const luxuryBandEntry = findByDateExact(luxuryBandByDate, date);
    const primeBandEntry = findByDateExact(primeBandByDate, date);

    return {
      week_start: date.slice(0, 10),
      luxury: {
        count: luxuryCount,
        volume: luxuryVolume,
        median: toMillions(luxuryBandEntry?.medianPrice ?? null),
        ppsf: luxuryBandEntry?.ppsf ?? null,
        dom: luxuryBandEntry?.avgDaysOnMarket ?? null,
      },
      prime: {
        count: primeCount,
        volume: primeVolume,
        median: toMillions(primeBandEntry?.medianPrice ?? null),
        ppsf: primeBandEntry?.ppsf ?? null,
        dom: primeBandEntry?.avgDaysOnMarket ?? null,
      },
      trophy: {
        count: trophyCount,
        volume: trophyVolume,
        median: trophyMedian,
        ppsf: trophyPpsf,
        dom: trophyDom,
      },
    };
  });
}
