import { createFileRoute } from "@tanstack/react-router";

// Read-only queue for the upstream data agent.
//
// Returns every open weekly reconciliation flag with the context needed to fix
// the payload at source: the hero figure we published, the leaderboard total it
// should agree with, the per-neighborhood contributors, and that week's luxury
// cutoff so the agent can re-test which contracts belong in the borough rollup.
//
// Auth: a dedicated DATA_AGENT_TOKEN (reconciliation only, no export access),
// or the shared export secret for internal jobs and admins.
// This endpoint never writes. Use POST /api/public/weekly-reconciliation to
// rerun the checks after a fix lands.

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function authorize(request: Request): Promise<string | null> {
  const provided =
    request.headers.get("x-data-agent-token") ??
    request.headers.get("x-export-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  if (!provided) return null;

  // Data agents get their own read-only token. It works here and nowhere else,
  // so an agent credential can never pull a workbook export.
  const agentToken = process.env["DATA_AGENT_TOKEN"] ?? "";
  if (agentToken && timingSafeEqual(provided, agentToken)) return "data_agent_token";

  // Internal jobs and admins may still use the shared export secret.
  const envSecret = process.env["WEEKLY_EXPORT_SECRET"] ?? "";
  if (envSecret && timingSafeEqual(provided, envSecret)) return "export_secret";

  return null;
}

const FIX_HINTS: Record<string, string> = {
  signed_contracts_hero_vs_leaderboard:
    "Recompute payload.hero.luxury_count from the contract-level source for this week, including every contract at or above luxury_cutoff regardless of neighborhood. Leave weekly_activity_leaderboard as delivered.",
  signed_volume_hero_vs_leaderboard:
    "Recompute payload.hero.luxury_volume from the same contract set used for luxury_count, then rescale the dependent hero percentages. Leave weekly_activity_leaderboard as delivered.",
};

async function run(request: Request) {
  const credential = await authorize(request);
  if (!credential) return json({ error: "Unauthorized" }, 401);

  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? "open";
  const week = url.searchParams.get("week");

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let q = (supabaseAdmin as any)
      .from("weekly_reconciliation_flags")
      .select(
        "id, week_start, check_name, hero_value, table_value, delta, severity, status, detail, created_at, updated_at, resolved_at",
      )
      .order("week_start", { ascending: false });
    if (status !== "all") q = q.eq("status", status);
    if (week) q = q.eq("week_start", week);

    const { data: flags, error } = await q;
    if (error) throw new Error(error.message);

    const rows = (flags ?? []) as any[];
    const weeks = Array.from(new Set(rows.map((r) => r.week_start)));

    // Pull each affected week's luxury cutoff so the agent can re-test membership.
    const cutoffs = new Map<string, number | null>();
    if (weeks.length) {
      const { data: reports } = await (supabaseAdmin as any)
        .from("weekly_report")
        .select("week_start, week_end, payload")
        .in("week_start", weeks);
      for (const r of (reports ?? []) as any[]) {
        cutoffs.set(r.week_start, r.payload?.hero?.luxury_cutoff ?? null);
      }
    }

    return json({
      success: true,
      status,
      count: rows.length,
      generated_at: new Date().toISOString(),
      note: "Fix the payload at source, then POST /api/public/weekly-reconciliation to reverify. Flags auto-resolve once the hero and leaderboard agree.",
      flags: rows.map((r) => ({
        id: r.id,
        week_start: r.week_start,
        check: r.check_name,
        severity: r.severity,
        status: r.status,
        hero_value: r.hero_value,
        leaderboard_value: r.table_value,
        delta: r.delta,
        luxury_cutoff: cutoffs.get(r.week_start) ?? null,
        contributors: r.detail?.contributors ?? [],
        leaderboard_rows: r.detail?.leaderboardRows ?? null,
        note: r.detail?.note ?? null,
        fix: FIX_HINTS[r.check_name] ?? "Reconcile the hero rollup with the neighborhood activity leaderboard.",
        first_seen: r.created_at,
        last_seen: r.updated_at,
        resolved_at: r.resolved_at,
      })),
    });
  } catch (err) {
    console.error("[reconciliation-flags] failed:", err);
    return json({ error: String(err instanceof Error ? err.message : err) }, 500);
  }
}

export const Route = createFileRoute("/api/public/reconciliation-flags")({
  server: {
    handlers: {
      GET: async ({ request }) => run(request),
    },
  },
});
