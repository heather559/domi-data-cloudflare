import { getNeighborhoodReportBySlug } from "@/lib/neighborhood-report.functions";

// Rebuilds an already-archived month's stored payloads from the current live
// neighborhood reports. Used before a new month loads over the live table:
// the archive must hold what the pages actually published, including the
// ranks resolved off the qualified registry at snapshot time.
export type ResnapshotResult = {
  monthStart: string;
  updated: string[];
  skipped: string[];
};

export async function resnapshotArchiveMonth(
  monthStart: string,
  onlySlugs?: string[],
): Promise<ResnapshotResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const client = supabaseAdmin as any;

  const { data: row, error: readErr } = await client
    .from("neighborhood_monthly_archive")
    .select("payload")
    .eq("month_start", monthStart)
    .maybeSingle();
  if (readErr) throw new Error(`archive read failed: ${JSON.stringify(readErr)}`);
  if (!row) throw new Error(`no archive row for ${monthStart}`);

  const existing: Record<string, unknown> = row.payload ?? {};
  const slugs = (onlySlugs?.length ? onlySlugs : Object.keys(existing)).filter((s) =>
    /^[a-z0-9-]+$/.test(s),
  );

  const next: Record<string, unknown> = { ...existing };
  const updated: string[] = [];
  const skipped: string[] = [];

  for (const slug of slugs) {
    try {
      const report = await getNeighborhoodReportBySlug({ data: { slug } });
      if (!report?.payload) {
        skipped.push(slug);
        continue;
      }
      next[slug] = report.payload;
      updated.push(slug);
    } catch (err) {
      console.error(`[archive-resnapshot] ${slug} failed:`, err);
      skipped.push(slug);
    }
  }

  if (updated.length) {
    const { error } = await client
      .from("neighborhood_monthly_archive")
      .update({ payload: next, archived_at: new Date().toISOString() })
      .eq("month_start", monthStart);
    if (error) throw new Error(`archive write failed: ${JSON.stringify(error)}`);
  }

  return { monthStart, updated, skipped };
}
