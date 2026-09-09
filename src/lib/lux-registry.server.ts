// Server-only loader for the Manhattan luxury registry. Reads the latest
// weekly_report feed and merges the two capped leaderboards (dollar volume and
// luxury intensity) into one record per neighborhood. When the pipeline starts
// emitting an uncapped `qualified_neighborhoods` array, that array wins and the
// registry becomes borough-complete with no further code change.

import { MIN_QUALIFIED_LUX_CONTRACTS } from "@/lib/sowhat";
import {
  normalizeGeoName,
  type LuxRegistry,
  type LuxRegistryRow,
} from "@/lib/lux-registry";

interface BoardRow {
  name?: string;
  contracts_52wk?: number;
  vol_52wk?: number;
  pct_lux?: number;
  local_median?: number;
  avg_sale?: number;
  rank?: number;
  rank_delta?: number;
}

interface QualifiedRow extends BoardRow {
  volume_rank?: number;
  intensity_rank?: number;
}

function blank(name: string): LuxRegistryRow {
  return {
    name,
    contracts52wk: null,
    qualified: false,
    volumeRank: null,
    volumeRankDelta: null,
    vol52wk: null,
    intensityRank: null,
    intensityRankDelta: null,
    pctLux: null,
    localMedian: null,
    avgSale: null,
    source: "volume board",
  };
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export async function loadLuxRegistry(
  opts: { withCitations?: boolean } = {},
): Promise<LuxRegistry> {
  const empty: LuxRegistry = {
    weekStart: null,
    complete: false,
    rows: [],
    unverifiedCitations: [],
  };

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const client = supabaseAdmin as unknown as {
      from: (t: string) => {
        select: (cols: string) => {
          order: (col: string, o: { ascending: boolean }) => {
            limit: (n: number) => Promise<{ data: Array<Record<string, unknown>> | null }>;
          };
        };
      };
    };

    const { data } = await client
      .from("weekly_report")
      .select("week_start, payload")
      .order("week_start", { ascending: false })
      .limit(1);

    const top = data?.[0] as { week_start?: string; payload?: unknown } | undefined;
    if (!top) return empty;

    const payload = (top.payload ?? {}) as {
      leaderboard?: BoardRow[];
      concentrated_leaderboard?: BoardRow[];
      qualified_neighborhoods?: QualifiedRow[];
    };

    const byKey = new Map<string, LuxRegistryRow>();
    const upsert = (name: string): LuxRegistryRow => {
      const key = normalizeGeoName(name);
      let row = byKey.get(key);
      if (!row) {
        row = blank(name.trim());
        byKey.set(key, row);
      }
      return row;
    };

    const feed = payload.qualified_neighborhoods ?? [];
    const complete = feed.length > 0;

    if (complete) {
      for (const r of feed) {
        if (!r?.name) continue;
        const row = upsert(r.name);
        row.contracts52wk = num(r.contracts_52wk);
        row.vol52wk = num(r.vol_52wk);
        row.pctLux = num(r.pct_lux);
        row.localMedian = num(r.local_median);
        row.avgSale = num(r.avg_sale);
        row.volumeRank = num(r.volume_rank);
        row.intensityRank = num(r.intensity_rank);
        row.source = "qualified feed";
      }
    } else {
      for (const r of payload.leaderboard ?? []) {
        if (!r?.name) continue;
        const row = upsert(r.name);
        row.contracts52wk = num(r.contracts_52wk) ?? row.contracts52wk;
        row.vol52wk = num(r.vol_52wk) ?? row.vol52wk;
        row.pctLux = num(r.pct_lux) ?? row.pctLux;
        row.localMedian = num(r.local_median) ?? row.localMedian;
        row.avgSale = num(r.avg_sale) ?? row.avgSale;
        row.volumeRank = num(r.rank);
        row.volumeRankDelta = num(r.rank_delta) ?? 0;
        row.source = "volume board";
      }
      for (const r of payload.concentrated_leaderboard ?? []) {
        if (!r?.name) continue;
        const row = upsert(r.name);
        row.contracts52wk = num(r.contracts_52wk) ?? row.contracts52wk;
        row.vol52wk = num(r.vol_52wk) ?? row.vol52wk;
        row.pctLux = num(r.pct_lux) ?? row.pctLux;
        row.localMedian = num(r.local_median) ?? row.localMedian;
        row.avgSale = num(r.avg_sale) ?? row.avgSale;
        row.intensityRank = num(r.rank);
        row.intensityRankDelta = num(r.rank_delta) ?? 0;
        row.source = row.volumeRank !== null ? "both" : "intensity board";
      }
    }

    for (const row of byKey.values()) {
      row.qualified = (row.contracts52wk ?? 0) >= MIN_QUALIFIED_LUX_CONTRACTS;
    }

    const rows = [...byKey.values()].sort((a, b) => {
      const av = a.volumeRank ?? Number.MAX_SAFE_INTEGER;
      const bv = b.volumeRank ?? Number.MAX_SAFE_INTEGER;
      if (av !== bv) return av - bv;
      return (b.vol52wk ?? 0) - (a.vol52wk ?? 0);
    });

    const registry: LuxRegistry = {
      weekStart: top.week_start ?? null,
      complete,
      rows,
      unverifiedCitations: [],
    };

    if (opts.withCitations) {
      registry.unverifiedCitations = await loadUnverifiedCitations(byKey);
    }

    return registry;
  } catch (err) {
    console.error("[lux_registry] load failed:", err);
    return empty;
  }
}

// Every neighborhood report carries a `nextNeighborhood` name. When that name is
// absent from the registry, the So What engine drops the comparison rather than
// cite a number it cannot verify. This surfaces exactly which ones get dropped.
async function loadUnverifiedCitations(
  byKey: Map<string, LuxRegistryRow>,
): Promise<Array<{ cited: string; citedBy: string }>> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const client = supabaseAdmin as unknown as {
      from: (t: string) => {
        select: (cols: string) => {
          order: (col: string, o: { ascending: boolean }) => {
            limit: (n: number) => Promise<{ data: Array<Record<string, unknown>> | null }>;
          };
        };
      };
    };
    const { data } = await client
      .from("neighborhood_monthly_report")
      .select("neighborhood_slug, period, payload")
      .order("period", { ascending: false })
      .limit(200);

    const seenSlug = new Set<string>();
    const out: Array<{ cited: string; citedBy: string }> = [];
    for (const r of data ?? []) {
      const slug = String(r["neighborhood_slug"] ?? "");
      if (!slug || seenSlug.has(slug)) continue;
      seenSlug.add(slug);
      const payload = (r["payload"] ?? {}) as {
        geo?: string;
        rank?: { nextNeighborhood?: string | null };
      };
      const cited = payload.rank?.nextNeighborhood;
      if (!cited) continue;
      const hit = byKey.get(normalizeGeoName(cited));
      if (!hit || !hit.qualified) {
        out.push({ cited, citedBy: payload.geo ?? slug });
      }
    }
    return out.sort((a, b) => a.cited.localeCompare(b.cited));
  } catch (err) {
    console.error("[lux_registry] citation check failed:", err);
    return [];
  }
}
