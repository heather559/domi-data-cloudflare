import { createFileRoute } from "@tanstack/react-router";

// Batch job: re-snapshot an archived month's neighborhood payloads from the
// current live reports. Run this before a new month is loaded over the live
// table. Auth: same shared secret as the export and alert jobs.

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

type Credential = "export_secret" | "db_token" | null;

async function authorize(request: Request): Promise<Credential> {
  const provided =
    request.headers.get("x-export-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  if (!provided) return null;

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
  const triggeredBy = request.headers.get("x-triggered-by");
  const userAgent = request.headers.get("user-agent");

  const credential = await authorize(request);
  if (!credential) {
    await logAudit({
      actor: "archive_resnapshot",
      action: "resnapshot.unauthorized",
      targetTable: "neighborhood_monthly_archive",
      outcome: "error",
      errorCode: "401",
      errorMessage: "invalid or missing export secret",
      ip,
      meta: { method: request.method, triggeredBy, userAgent },
    });
    return json({ error: "Unauthorized" }, 401);
  }

  const url = new URL(request.url);
  let monthStart = url.searchParams.get("month") ?? "";
  let slugs: string[] | undefined;

  if (request.method === "POST") {
    try {
      const body = (await request.json()) as { month?: string; slugs?: string[] };
      if (body?.month) monthStart = body.month;
      if (Array.isArray(body?.slugs)) slugs = body.slugs;
    } catch {
      // no body, query params only
    }
  }

  const base = {
    actor: "archive_resnapshot" as const,
    targetTable: "neighborhood_monthly_archive",
    ip,
  };
  const context = {
    month: monthStart,
    requestedSlugs: slugs ?? null,
    credential,
    triggeredBy,
    userAgent,
    method: request.method,
  };

  if (!/^\d{4}-\d{2}-\d{2}$/.test(monthStart)) {
    await logAudit({
      ...base,
      action: "resnapshot.rejected",
      outcome: "error",
      errorCode: "400",
      errorMessage: "month must be YYYY-MM-DD",
      meta: context,
    });
    return json({ error: "month must be YYYY-MM-DD (the archived month start)" }, 400);
  }

  try {
    const { resnapshotArchiveMonth } = await import("@/lib/neighborhood-archive.server");
    const result = await resnapshotArchiveMonth(monthStart, slugs);
    await logAudit({
      ...base,
      action: "resnapshot.run",
      outcome: "ok",
      rowCount: result.updated.length,
      meta: {
        ...context,
        updated: result.updated,
        skipped: result.skipped,
        durationMs: Date.now() - startedAt,
      },
    });
    return json({ success: true, ...result });
  } catch (err) {
    console.error("[archive-resnapshot] failed:", err);
    const message = String(err instanceof Error ? err.message : err);
    await logAudit({
      ...base,
      action: "resnapshot.run",
      outcome: "error",
      errorCode: "500",
      errorMessage: message,
      meta: { ...context, durationMs: Date.now() - startedAt },
    });
    return json({ error: message }, 500);
  }
}

export const Route = createFileRoute("/api/public/archive-resnapshot")({
  server: {
    handlers: {
      POST: async ({ request }) => run(request),
      GET: async ({ request }) => run(request),
    },
  },
});
