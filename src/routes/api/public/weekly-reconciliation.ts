import { createFileRoute } from "@tanstack/react-router";

// Reconciliation job: compares the hero signed-contract and dollar-volume
// totals against the neighborhood activity leaderboard for recent weeks and
// records any mismatch. Auth: same shared secret as the export and alert jobs.

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
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

  // Data agents may rerun the checks with their own token. It grants no export access.
  const agentToken = process.env["DATA_AGENT_TOKEN"] ?? "";
  if (agentToken && timingSafeEqual(provided, agentToken)) return "data_agent_token";


  const envSecret = process.env["WEEKLY_EXPORT_SECRET"] ?? "";
  if (envSecret && timingSafeEqual(provided, envSecret)) return "export_secret";

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (supabaseAdmin as any)
    .from("export_job_token")
    .select("token")
    .eq("id", true)
    .maybeSingle();
  const dbToken = (data?.token as string | undefined) ?? "";
  return dbToken && timingSafeEqual(provided, dbToken) ? "db_token" : null;
}

function callerIp(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null
  );
}

async function run(request: Request) {
  const { logAudit } = await import("@/lib/audit-log.server");
  const startedAt = Date.now();
  const ip = callerIp(request);

  const credential = await authorize(request);
  if (!credential) {
    await logAudit({
      actor: "weekly_reconciliation",
      action: "reconcile.unauthorized",
      targetTable: "weekly_reconciliation_flags",
      outcome: "error",
      errorCode: "401",
      errorMessage: "invalid or missing export secret",
      ip,
      meta: { method: request.method },
    });
    return json({ error: "Unauthorized" }, 401);
  }

  const weeksParam = Number(new URL(request.url).searchParams.get("weeks") ?? "8");
  const weeks = Number.isFinite(weeksParam) ? Math.max(1, Math.min(weeksParam, 52)) : 8;

  try {
    const { runWeeklyReconciliation } = await import("@/lib/weekly-reconciliation.server");
    const result = await runWeeklyReconciliation(weeks);
    await logAudit({
      actor: "weekly_reconciliation",
      action: "reconcile.run",
      targetTable: "weekly_reconciliation_flags",
      outcome: "ok",
      rowCount: result.findings.length,
      ip,
      meta: {
        weeks,
        credential,
        weeksChecked: result.weeksChecked,
        cleared: result.cleared,
        findings: result.findings.map((f) => ({
          week: f.weekStart,
          check: f.checkName,
          hero: f.heroValue,
          table: f.tableValue,
          delta: f.delta,
          severity: f.severity,
        })),
        durationMs: Date.now() - startedAt,
      },
    });
    return json({ success: true, ...result });
  } catch (err) {
    console.error("[weekly-reconciliation] failed:", err);
    const message = String(err instanceof Error ? err.message : err);
    await logAudit({
      actor: "weekly_reconciliation",
      action: "reconcile.run",
      targetTable: "weekly_reconciliation_flags",
      outcome: "error",
      errorCode: "500",
      errorMessage: message,
      ip,
      meta: { weeks, durationMs: Date.now() - startedAt },
    });
    return json({ error: message }, 500);
  }
}

export const Route = createFileRoute("/api/public/weekly-reconciliation")({
  server: {
    handlers: {
      POST: async ({ request }) => run(request),
      GET: async ({ request }) => run(request),
    },
  },
});
