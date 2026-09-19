/**
 * STEP 4c -- `weekly_activity_leaderboard`, the third leaderboard panel:
 * this week's own signed luxury-qualifying contracts by neighborhood,
 * independent of which neighborhoods place on `leaderboard` or
 * `concentrated_leaderboard`.
 *
 * Per this task's brief, `search_activities` (Marketproof's MCP tool) is
 * REST-unreachable in this pipeline's current deployment -- same
 * MCP/OAuth blocker already confirmed and documented for `top_deals`
 * (see topDeals/fetchTopDeals.ts's header comment). This module does NOT
 * attempt a REST workaround (explicitly out of scope per the task brief);
 * it accepts an already-fetched/paginated activity list (or `null`/`[]`
 * when unavailable) and returns `[]` gracefully, matching top_deals' own
 * null-vs-empty convention.
 */

import type { WeeklyActivityLeaderboardRow } from '../schema/weeklyReportPayload';

/** One deduped/paginated record from Marketproof's search_activities, in whatever shape the caller's fetch layer produces -- deliberately permissive since this pipeline has never actually called a working search_activities endpoint (see module header). */
export interface RawActivityRecord {
  address: string;
  unit: string | null;
  price: number | null;
  /** Lowercase neighborhood name, e.g. "tribeca" -- matches neighborhood[0] per the spec's field mapping. */
  neighborhood: string | null;
  /** Raw event_tags from the record, used for building-mirror/timeshare detection. Case-insensitive. */
  eventTags?: readonly string[];
}

const BUILDING_MIRROR_MARKERS = ['building', 'multi-residential', 'multi residential', 'vacant land', 'vacant-land', 'dwelling', 'aggregate'];
const TIMESHARE_MARKER = 'timeshare';

function hasTag(tags: readonly string[] | undefined, markers: readonly string[]): boolean {
  if (!tags || tags.length === 0) return false;
  const lower = tags.map((t) => t.toLowerCase());
  return markers.some((marker) => lower.some((t) => t.includes(marker)));
}

/**
 * Shared dedup rules from STEP 6/4c: exact-duplicate keys (address+unit,
 * case-insensitive), building-mirror rows (aggregate building/dwelling/
 * multi-residential/vacant-land entries rather than a single unit), and
 * timeshares excluded outright. First occurrence of a given address+unit
 * key wins.
 */
export function dedupeActivities(records: readonly RawActivityRecord[]): RawActivityRecord[] {
  const seen = new Set<string>();
  const out: RawActivityRecord[] = [];

  for (const record of records) {
    if (hasTag(record.eventTags, BUILDING_MIRROR_MARKERS)) continue;
    if (hasTag(record.eventTags, [TIMESHARE_MARKER])) continue;

    const key = `${record.address.trim().toLowerCase()}|${(record.unit ?? '').trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(record);
  }

  return out;
}

const TOP_N = 10;

/**
 * Computes weekly_activity_leaderboard. `activities` should be `null` (or
 * `[]`) when search_activities is unavailable this run -- both produce `[]`
 * here, never a fabricated/padded list. `luxuryCutoff` defensively re-filters
 * to price >= cutoff (the spec's own pagination stop condition is page-level,
 * not row-level, so a boundary page can carry a few sub-cutoff rows).
 */
export function computeWeeklyActivityLeaderboard(
  activities: readonly RawActivityRecord[] | null,
  luxuryCutoff: number | null,
  leaderboardNames: readonly string[],
  concentratedNames: readonly string[],
): WeeklyActivityLeaderboardRow[] {
  if (!activities || activities.length === 0) return [];

  const deduped = dedupeActivities(activities);
  const qualifying = luxuryCutoff !== null ? deduped.filter((r) => (r.price ?? -Infinity) >= luxuryCutoff) : deduped;

  const buckets = new Map<string, { wkContracts: number; wkVolume: number }>();
  for (const record of qualifying) {
    const name = record.neighborhood ?? 'unknown';
    const bucket = buckets.get(name) ?? { wkContracts: 0, wkVolume: 0 };
    bucket.wkContracts += 1;
    bucket.wkVolume += record.price ?? 0;
    buckets.set(name, bucket);
  }

  const sorted = [...buckets.entries()].sort((a, b) => {
    if (b[1].wkContracts !== a[1].wkContracts) return b[1].wkContracts - a[1].wkContracts;
    return b[1].wkVolume - a[1].wkVolume;
  });

  return sorted.slice(0, TOP_N).map(([name, stats], i) => {
    const largestIdx = leaderboardNames.indexOf(name);
    const concentratedIdx = concentratedNames.indexOf(name);
    return {
      rank: i + 1,
      name,
      wk_contracts: stats.wkContracts,
      wk_volume: stats.wkVolume,
      largest_rank: largestIdx === -1 ? null : largestIdx + 1,
      concentrated_rank: concentratedIdx === -1 ? null : concentratedIdx + 1,
    };
  });
}
