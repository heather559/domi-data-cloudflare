import { createServerFn } from "@tanstack/react-start";
import {
  normalizeNeighborhoodPayload,
  buildNeighborhoodReport,
  EMPTY_LUX_LEADERBOARD,
  type NeighborhoodPayload,
  type NeighborhoodReport,
} from "@/lib/neighborhood-report.functions";

export type NeighborhoodArchiveIndexEntry = {
  month_start: string;
  archived_at: string;
  geo: string;
  luxury_count: number | null;
  luxury_volume_display: string | null;
};

export type ArchivedNeighborhoodMonth = NeighborhoodReport & { archived_at: string };

type ArchiveRawRow = {
  month_start: string;
  archived_at: string;
  payload: Record<string, NeighborhoodPayload>;
};

async function getClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        order: (col: string, o: { ascending: boolean }) => Promise<{ data: ArchiveRawRow[] | null; error: unknown }>;
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{ data: ArchiveRawRow | null; error: unknown }>;
        };
      };
    };
  };
}

// Every archived month is one row in neighborhood_monthly_archive with a
// payload jsonb object keyed by neighborhood slug (not one row per
// neighborhood, unlike the live neighborhood_monthly_report table). Pulling
// every month's row and plucking this neighborhood's key in JS is simplest —
// there are only a handful of neighborhoods and archived months today, so a
// JSONB path query isn't worth the added complexity yet.
export const listNeighborhoodArchive = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => {
    if (!/^[a-z0-9-]+$/.test(input.slug)) throw new Error("Invalid slug");
    return input;
  })
  .handler(async ({ data: input }): Promise<NeighborhoodArchiveIndexEntry[]> => {
    const client = await getClient();
    const { data, error } = await client
      .from("neighborhood_monthly_archive")
      .select("month_start, archived_at, payload")
      .order("month_start", { ascending: false });
    if (error) {
      console.error("[neighborhood_monthly_archive] list failed:", error);
      return [];
    }
    const out: NeighborhoodArchiveIndexEntry[] = [];
    for (const row of data ?? []) {
      const p = row.payload?.[input.slug];
      if (!p) continue;
      out.push({
        month_start: row.month_start,
        archived_at: row.archived_at,
        geo: p.geo,
        luxury_count: typeof p.hero?.luxuryContractsCount === "number" ? p.hero.luxuryContractsCount : null,
        luxury_volume_display: p.hero?.luxuryVolumeDisplay ?? null,
      });
    }
    return out;
  });

export const getArchivedNeighborhoodMonth = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string; monthStart: string }) => {
    if (!/^[a-z0-9-]+$/.test(input.slug)) throw new Error("Invalid slug");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.monthStart)) throw new Error("Invalid monthStart");
    return input;
  })
  .handler(async ({ data: input }): Promise<ArchivedNeighborhoodMonth | null> => {
    const client = await getClient();
    const { data: row, error } = await client
      .from("neighborhood_monthly_archive")
      .select("month_start, archived_at, payload")
      .eq("month_start", input.monthStart)
      .maybeSingle();
    if (error) {
      console.error("[neighborhood_monthly_archive] get failed:", error);
      return null;
    }
    if (!row) return null;

    const rawPayload = row.payload?.[input.slug];
    if (!rawPayload) return null;

    const payload = normalizeNeighborhoodPayload(rawPayload);
    // Archived snapshots never get today's live leaderboard rank injected —
    // this is a frozen historical page. EMPTY_LUX_LEADERBOARD reproduces
    // exactly the "not found on the board" branch of buildNeighborhoodReport,
    // leaving volumeRank/manhattanRank absent, matching what's already true
    // of the stored payload (those fields are stripped before archiving).
    const report = buildNeighborhoodReport(payload, input.monthStart, EMPTY_LUX_LEADERBOARD);

    return { ...report, archived_at: row.archived_at };
  });
