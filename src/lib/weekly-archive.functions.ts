import { createServerFn } from "@tanstack/react-start";
import type { WeeklyReportPayload, WeeklyReportRow } from "./weekly-report.functions";
import { reconcileWeeklyHero } from "./weekly-hero-reconcile";

export type ArchiveIndexEntry = {
  week_start: string;
  week_end: string;
  archived_at: string;
  luxury_count: number | null;
  luxury_volume: number | null;
};

export type ArchivedWeek = WeeklyReportRow & { archived_at: string };

type ArchiveRawRow = {
  week_start: string;
  week_end: string;
  archived_at: string;
  payload: WeeklyReportPayload;
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

export const listWeeklyArchive = createServerFn({ method: "GET" }).handler(
  async (): Promise<ArchiveIndexEntry[]> => {
    const client = await getClient();
    const { data, error } = await client
      .from("weekly_report_archive")
      .select("week_start, week_end, archived_at, payload")
      .order("week_start", { ascending: false });
    if (error) {
      console.error("[weekly_report_archive] list failed:", error);
      return [];
    }
    return (data ?? []).map((r) => {
      const { payload } = reconcileWeeklyHero(r.payload);
      return {
        week_start: r.week_start,
        week_end: r.week_end,
        archived_at: r.archived_at,
        luxury_count: payload?.hero?.luxury_count ?? null,
        luxury_volume: payload?.hero?.luxury_volume ?? null,
      };
    });
  },
);

export const getArchivedWeek = createServerFn({ method: "GET" })
  .inputValidator((input: { weekStart: string }) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.weekStart)) throw new Error("Invalid weekStart");
    return input;
  })
  .handler(async ({ data }): Promise<ArchivedWeek | null> => {
    const client = await getClient();
    const { data: row, error } = await client
      .from("weekly_report_archive")
      .select("week_start, week_end, archived_at, payload")
      .eq("week_start", data.weekStart)
      .maybeSingle();
    if (error) {
      console.error("[weekly_report_archive] get failed:", error);
      return null;
    }
    if (!row) return null;
    return {
      week_start: row.week_start,
      week_end: row.week_end,
      generated_at: row.archived_at,
      is_provisional: false,
      payload: reconcileWeeklyHero(row.payload).payload as WeeklyReportPayload,
      archived_at: row.archived_at,
    };
  });
