// Shared, client-safe types and helpers for the Manhattan luxury registry.
// The registry is the single source of truth for two questions:
//   1. Which neighborhoods clear the qualification floor (>= MIN_QUALIFIED_LUX_CONTRACTS
//      luxury contracts over the trailing 52 weeks) and may therefore be cited by name.
//   2. How those neighborhoods rank on luxury dollar volume and on luxury intensity.

export interface LuxRegistryRow {
  name: string;
  contracts52wk: number | null;
  qualified: boolean;
  volumeRank: number | null;
  volumeRankDelta: number | null;
  vol52wk: number | null;
  intensityRank: number | null;
  intensityRankDelta: number | null;
  pctLux: number | null;
  localMedian: number | null;
  avgSale: number | null;
  /** Which upstream list the row came from. */
  source: "volume board" | "intensity board" | "both" | "qualified feed";
}

export interface LuxRegistry {
  weekStart: string | null;
  /** True once the pipeline emits an uncapped qualified_neighborhoods array. */
  complete: boolean;
  rows: LuxRegistryRow[];
  /** Names cited as nextNeighborhood that the registry cannot verify. */
  unverifiedCitations: Array<{ cited: string; citedBy: string }>;
}

// Neighborhood names arrive with inconsistent casing and spacing across sources.
export function normalizeGeoName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function fmtMoney(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "n/a";
  if (Math.abs(n) >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

export function fmtDelta(d: number | null): string {
  if (d === null || d === 0) return "flat";
  return d > 0 ? `up ${d}` : `down ${Math.abs(d)}`;
}

function csvCell(v: string | number | null | boolean): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildRegistryCsv(reg: LuxRegistry): string {
  const head = [
    "neighborhood",
    "contracts_52wk",
    "qualified_11_plus",
    "volume_rank",
    "volume_rank_delta",
    "vol_52wk",
    "intensity_rank",
    "intensity_rank_delta",
    "pct_lux",
    "local_median",
    "avg_sale",
    "source",
  ];
  const lines = [head.join(",")];
  for (const r of reg.rows) {
    lines.push(
      [
        r.name,
        r.contracts52wk,
        r.qualified,
        r.volumeRank,
        r.volumeRankDelta,
        r.vol52wk,
        r.intensityRank,
        r.intensityRankDelta,
        r.pctLux,
        r.localMedian,
        r.avgSale,
        r.source,
      ]
        .map(csvCell)
        .join(","),
    );
  }
  lines.push("");
  lines.push("cited_neighborhood,cited_by,status");
  for (const u of reg.unverifiedCitations) {
    lines.push([u.cited, u.citedBy, "unverifiable, comparison dropped"].map(csvCell).join(","));
  }
  return lines.join("\n");
}
