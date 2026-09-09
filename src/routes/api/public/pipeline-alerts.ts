import { createFileRoute } from "@tanstack/react-router";

// Called by the scheduled job every 15 minutes. Flags pipeline runs that
// failed or stalled past the timeout and emails the operators once per run.
// Auth: the same shared secret used by the export jobs, checked before any work.

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

async function run(request: Request) {
  const provided =
    request.headers.get("x-export-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  if (!provided) return json({ error: "Unauthorized" }, 401);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const envSecret = process.env["WEEKLY_EXPORT_SECRET"] ?? "";
  let ok = envSecret ? timingSafeEqual(provided, envSecret) : false;
  if (!ok) {
    const { data } = await (supabaseAdmin as any)
      .from("export_job_token")
      .select("token")
      .eq("id", true)
      .maybeSingle();
    const dbToken = (data?.token as string | undefined) ?? "";
    ok = dbToken ? timingSafeEqual(provided, dbToken) : false;
  }
  if (!ok) return json({ error: "Unauthorized" }, 401);

  try {
    const { runPipelineAlertCheck } = await import("@/lib/pipeline-alerts.server");
    const result = await runPipelineAlertCheck();
    return json({ success: true, ...result });
  } catch (err) {
    console.error("[pipeline-alerts] check failed:", err);
    return json({ error: "check_failed" }, 500);
  }
}

export const Route = createFileRoute("/api/public/pipeline-alerts")({
  server: {
    handlers: {
      POST: async ({ request }) => run(request),
      GET: async ({ request }) => run(request),
    },
  },
});
