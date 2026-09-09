import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { MonthlyReportPayload, MonthlyReportRow } from "./monthly-report.functions";

export type MonthlyArchiveEntry = {
  month_start: string;
  month_end: string;
  archived_at: string;
  luxury_label: string | null;
};

export type ArchivedMonthlyReport = MonthlyReportRow & { archived_at: string };

type ArchiveRawRow = {
  month_start: string;
  month_end: string;
  archived_at: string;
  payload: MonthlyReportPayload;
};

async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

// Every protected function below runs only for a signed-in admin. The
// middleware proves the caller's identity; this proves the role, read through
// the caller's own RLS-scoped client so a non-admin simply sees nothing.
async function assertAdmin(supabase: any) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("role", "admin")
    .maybeSingle();
  if (error || !data) throw new Error("Forbidden: admin role required");
}

export const listMonthlyArchive = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MonthlyArchiveEntry[]> => {
    await assertAdmin((context as any).supabase);
    const client = await adminClient();
    const { data, error } = await client
      .from("monthly_report_archive")
      .select("month_start, month_end, archived_at, payload")
      .order("month_start", { ascending: false });
    if (error) {
      console.error("[monthly_report_archive] list failed:", error);
      return [];
    }
    return ((data ?? []) as ArchiveRawRow[]).map((r) => ({
      month_start: r.month_start,
      month_end: r.month_end,
      archived_at: r.archived_at,
      luxury_label:
        (r.payload as any)?.hero?.luxury_volume_display ??
        (r.payload as any)?.hero?.luxury_count?.toString() ??
        null,
    }));
  });

export const getArchivedMonthlyReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { monthStart: string }) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.monthStart)) throw new Error("Invalid monthStart");
    return input;
  })
  .handler(async ({ data: input, context }): Promise<ArchivedMonthlyReport | null> => {
    await assertAdmin((context as any).supabase);
    const client = await adminClient();
    const { data: row, error } = await client
      .from("monthly_report_archive")
      .select("month_start, month_end, archived_at, payload")
      .eq("month_start", input.monthStart)
      .maybeSingle();
    if (error) {
      console.error("[monthly_report_archive] get failed:", error);
      return null;
    }
    if (!row) return null;
    return {
      month_start: row.month_start,
      month_end: row.month_end,
      generated_at: row.archived_at,
      is_provisional: false,
      payload: row.payload as MonthlyReportPayload,
      archived_at: row.archived_at,
    };
  });

/** Freezes the current live monthly_report row into the archive. Re-running for
 *  the same month overwrites that snapshot, same behaviour as the neighborhood
 *  archive resnapshot. */
export const archiveCurrentMonthlyReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ month_start: string } | null> => {
    await assertAdmin((context as any).supabase);
    const client = await adminClient();

    const { data: live, error: readErr } = await client
      .from("monthly_report")
      .select("month_start, month_end, payload")
      .order("month_start", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (readErr) throw new Error(`monthly_report read failed: ${JSON.stringify(readErr)}`);
    if (!live) throw new Error("No monthly report to archive");

    const { error } = await client.from("monthly_report_archive").upsert(
      {
        month_start: live.month_start,
        month_end: live.month_end,
        payload: live.payload,
        archived_at: new Date().toISOString(),
      },
      { onConflict: "month_start" },
    );
    if (error) throw new Error(`archive write failed: ${JSON.stringify(error)}`);

    return { month_start: live.month_start };
  });
