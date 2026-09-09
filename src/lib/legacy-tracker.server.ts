// Server-only: the hand-kept Manhattan contract tracker that ran from May 2024
// until the live feed took over. It is bundled as data so the workbook can show
// one continuous series instead of only the weeks the pipeline has published.
import legacyWeeksRaw from "@/data/legacy-weekly-tracker.json";
import legacyNeighborhoodRaw from "@/data/legacy-neighborhood-tracker.json";

export interface LegacyBedroomSegment {
  contracts: number | null;
  volume: number | null;
}

export interface LegacyWeek {
  week_start: string;
  condo_contracts?: number | null;
  condo_volume?: number | null;
  coop_contracts?: number | null;
  coop_volume?: number | null;
  th_contracts?: number | null;
  th_volume?: number | null;
  total_contracts?: number | null;
  total_volume?: number | null;
  luxury_contracts?: number | null;
  luxury_volume?: number | null;
  luxury_volume_share?: number | null;
  bedroom?: { total_sales?: number | null; mix?: Record<string, LegacyBedroomSegment> } | null;
  price_points?: Record<string, LegacyBedroomSegment> | null;
}

export const LEGACY_SOURCE = "Legacy tracker";
export const LIVE_SOURCE = "Live feed";

/** Bedroom keys in the order the rest of the site uses. */
export const LEGACY_BED_KEYS = ["studio", "1", "2", "3", "4+"] as const;

/** Price bands the legacy tracker recorded, low to high. */
export const LEGACY_PRICE_BANDS = [
  "Below $1M",
  "$1M - $3M",
  "$3M - $5M",
  "$5M - $10M",
  "$10M+",
] as const;

export function legacyWeeks(): LegacyWeek[] {
  return (legacyWeeksRaw as LegacyWeek[])
    .filter((w) => !!w.week_start)
    .sort((a, b) => a.week_start.localeCompare(b.week_start));
}

/** Sunday-to-Saturday week end, matching how the live feed labels a week. */
export function weekEndOf(weekStart: string): string {
  const d = new Date(`${weekStart}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return weekStart;
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().slice(0, 10);
}

/**
 * Shapes a legacy week like a published weekly_report row so the history sheet
 * can treat both eras identically. Only the metrics the tracker actually held
 * are filled; everything else stays blank rather than being invented.
 */
export function legacyAsWeekRow(w: LegacyWeek) {
  return {
    week_start: w.week_start,
    week_end: weekEndOf(w.week_start),
    source: LEGACY_SOURCE,
    payload: {
      hero: {
        luxury_count: w.luxury_contracts ?? null,
        luxury_volume: w.luxury_volume ?? null,
      },
      market_pulse: {
        all: {
          contracts: w.total_contracts ?? null,
          volume: w.total_volume ?? null,
        },
        by_type: {
          condo: { contracts: w.condo_contracts ?? null, contracts_volume: w.condo_volume ?? null },
          coop: { contracts: w.coop_contracts ?? null, contracts_volume: w.coop_volume ?? null },
          townhouse: { contracts: w.th_contracts ?? null, contracts_volume: w.th_volume ?? null },
        },
      },
    },
  };
}

/** One neighborhood row from the hand-kept tracker's "By Neighborhood" tab. */
export interface LegacyNeighborhoodWeek {
  week_start: string;
  area: string;
  contracts: number | null;
  contracts_wow: number | null;
  dom: number | null;
  avg_ppsf: number | null;
  avg_price: number | null;
  volume: number | null;
  volume_wow: number | null;
  new_listings: number | null;
  new_listings_wow: number | null;
  nl_avg_ppsf: number | null;
  nl_avg_price: number | null;
  nl_volume: number | null;
  nl_volume_wow: number | null;
}

/**
 * Areas in the order the tracker listed them. Greenwich and SoHo were kept as
 * one line until August 2025, then split, so both forms appear in the history.
 */
export const LEGACY_AREAS = [
  "Greenwich / SoHo",
  "Greenwich",
  "SoHo",
  "Tribeca",
  "West Village",
  "Upper East Side",
] as const;

export function legacyNeighborhoodWeeks(): LegacyNeighborhoodWeek[] {
  const order = new Map<string, number>(LEGACY_AREAS.map((a, i) => [a as string, i]));
  return (legacyNeighborhoodRaw as LegacyNeighborhoodWeek[])
    .filter((r) => !!r.week_start && !!r.area)
    .sort(
      (a, b) =>
        a.week_start.localeCompare(b.week_start) ||
        (order.get(a.area) ?? 99) - (order.get(b.area) ?? 99),
    );
}
