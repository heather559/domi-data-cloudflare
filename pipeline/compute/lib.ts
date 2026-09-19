/**
 * Shared pure helpers used across the compute/ layer. No I/O, no Supabase,
 * no Marketproof calls -- every function here is a plain data transform so
 * it can be unit-tested with fixture data and reused identically by both the
 * backfill harness and (eventually) the live weekly run.
 */

import type { ContractPeriodEntry } from '../fetch/schemas';

/**
 * Finds the entry in a contractsByPeriod-shaped array whose `date` matches a
 * target ISO date via `startsWith`, per STEP 1's explicit instruction
 * ("ISO dates, startsWith not equality"). Marketproof's period dates have
 * occasionally carried time-of-day suffixes in practice, hence the
 * startsWith requirement instead of strict equality.
 */
export function findByDateStartsWith<T extends { date: string }>(
  entries: readonly T[],
  isoDate: string,
): T | null {
  return entries.find((e) => e.date.startsWith(isoDate)) ?? null;
}

/** Strict-equality date lookup, for series where the spec calls for exact matching (e.g. STEP 1.8(B)(3)'s "match by date, never by array position"). */
export function findByDateExact<T extends { date: string }>(entries: readonly T[], isoDate: string): T | null {
  return entries.find((e) => e.date === isoDate) ?? null;
}

/** Mean of a numeric field across entries, skipping null/undefined values. Returns null if no valid values exist. */
export function averageField<T>(entries: readonly T[], field: (e: T) => number | null | undefined): number | null {
  const values = entries.map(field).filter((v): v is number => v !== null && v !== undefined && !Number.isNaN(v));
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Sum of a numeric field across entries, treating null/undefined as 0 (per spec's "sum of totalPrice across ALL entries" instructions -- a missing entry contributes nothing, it doesn't invalidate the sum). */
export function sumField<T>(entries: readonly T[], field: (e: T) => number | null | undefined): number {
  return entries.reduce((acc, e) => {
    const v = field(e);
    return acc + (v !== null && v !== undefined && !Number.isNaN(v) ? v : 0);
  }, 0);
}

/** Last N entries of an array, chronological order preserved. If fewer than N exist, returns all of them (never pads). */
export function lastN<T>(arr: readonly T[], n: number): T[] {
  if (arr.length <= n) return [...arr];
  return arr.slice(arr.length - n);
}

/**
 * Filters a chronological, date-keyed series to entries at or before
 * `endDateIso` (compared on the first 10 characters, so this works whether
 * `date` is a plain "YYYY-MM-DD" or a full ISO datetime string).
 *
 * Needed because a live 2026-09 backfill run confirmed that several
 * Marketproof endpoints (`weekly-contract-stats`, `weekly-sales-stats`,
 * `supply`) silently IGNORE their own `end_date` request parameter and
 * always return their series through "today" -- unlike `luxury-contract-stats`
 * and `neighborhood-rank`, which do respect it (confirmed by direct
 * comparison of anchored vs. unanchored responses). In the live weekly run
 * `endDateIso` is always "today" already, so this is a no-op there; it only
 * matters when computing a HISTORICAL week (backfill), where blindly taking
 * an unanchored series' raw tail would silently grab the wrong (too-recent)
 * window instead of that week's real one.
 */
export function filterUpToDate<T extends { date: string }>(entries: readonly T[], endDateIso: string): T[] {
  return entries.filter((e) => e.date.slice(0, 10) <= endDateIso);
}

/** `lastN` composed with `filterUpToDate` -- the last N entries of a series as of `endDateIso`, not just the array's raw tail. See `filterUpToDate` for why this distinction matters. */
export function lastNAsOf<T extends { date: string }>(entries: readonly T[], n: number, endDateIso: string): T[] {
  return lastN(filterUpToDate(entries, endDateIso), n);
}

/**
 * Trailing rolling average with window size `windowSize`, same length as the
 * input, "pad first (windowSize - 1)" per STEP 1's demand_trend.rolling_avg
 * instruction -- the padded leading entries use however many prior points
 * are actually available (a partial-window average), not null and not a
 * repeat of the first real value. This matches the one non-null example
 * value patterns seen in real stored payloads (rolling_avg has no nulls).
 */
export function trailingRollingAverage(values: readonly (number | null)[], windowSize: number): (number | null)[] {
  return values.map((_, i) => {
    const start = Math.max(0, i - windowSize + 1);
    const windowValues = values.slice(start, i + 1).filter((v): v is number => v !== null && !Number.isNaN(v));
    if (windowValues.length === 0) return null;
    return windowValues.reduce((a, b) => a + b, 0) / windowValues.length;
  });
}

/** Adds (or subtracts, if negative) whole calendar days to an ISO YYYY-MM-DD date string. Pure UTC calendar math, mirroring lib/week.ts's own approach -- no reliance on local timezone. */
export function addDaysIso(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() + days);
  const yy = utc.getUTCFullYear();
  const mm = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(utc.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/** True if `isoDate` falls within [startIso, endIso] inclusive (plain string comparison, valid for ISO YYYY-MM-DD). */
export function isWithinIsoRange(isoDate: string, startIso: string, endIso: string): boolean {
  return isoDate >= startIso && isoDate <= endIso;
}

export interface QuarterInfo {
  label: string; // e.g. "Q2 2026"
  lastDay: string; // ISO date, e.g. "2026-06-30"
}

/**
 * The most recently COMPLETED calendar quarter as of a given week_end date,
 * per STEP 1.7's example: week_end 2026-07-12 -> most recent completed
 * quarter is Q2 2026 (ending 2026-06-30).
 */
export function mostRecentCompletedQuarter(weekEndIso: string): QuarterInfo {
  const [year, month] = weekEndIso.split('-').map(Number);
  const currentQuarter = Math.floor((month - 1) / 3) + 1; // 1-4
  // The quarter containing week_end hasn't closed yet (we're mid-quarter or
  // at its very end but week_end itself doesn't guarantee the quarter's
  // last calendar day has passed) -- the most recently COMPLETED quarter is
  // always the one immediately before the quarter containing week_end.
  let completedQuarter = currentQuarter - 1;
  let completedYear = year;
  if (completedQuarter === 0) {
    completedQuarter = 4;
    completedYear = year - 1;
  }
  const lastMonthOfQuarter = completedQuarter * 3; // 3,6,9,12
  const lastDay = lastDayOfMonthIso(completedYear, lastMonthOfQuarter);
  return { label: `Q${completedQuarter} ${completedYear}`, lastDay };
}

function lastDayOfMonthIso(year: number, month: number): string {
  // Day 0 of the *next* month = last day of `month`.
  const d = new Date(Date.UTC(year, month, 0));
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}
