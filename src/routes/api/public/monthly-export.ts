import { createFileRoute } from "@tanstack/react-router";

// Called by the scheduled job. Fires only when a month the job has not shipped
// yet is published, so it can safely run on the same Monday cadence as the
// weekly export. Pass ?force=1 to rebuild and resend the current month.
// Auth: shared secret header, checked before any work happens.

const RECIPIENTS = ["hdomi@heatherdomi.com"];
const LINK_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

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

  const force = new URL(request.url).searchParams.get("force") === "1";

  // Which month is published right now, and which one did we last ship?
  const { data: latest } = await (supabaseAdmin as any)
    .from("monthly_report")
    .select("month_start")
    .order("month_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  const monthStart = (latest?.month_start as string | undefined) ?? null;
  if (!monthStart) return json({ success: false, reason: "no_monthly_report" });

  const { data: state } = await (supabaseAdmin as any)
    .from("export_job_state")
    .select("last_monthly_period, last_monthly_sent_at")
    .eq("job", "monthly-tracker-export")
    .maybeSingle();

  if (!force && state?.last_monthly_period === monthStart) {
    return json({
      success: true,
      skipped: true,
      reason: "month_already_sent",
      monthStart,
      lastSentAt: state?.last_monthly_sent_at ?? null,
    });
  }

  const { buildMonthlyWorkbook } = await import("@/lib/monthly-workbook.server");
  const book = await buildMonthlyWorkbook();
  const bytes = Uint8Array.from(atob(book.base64), (c) => c.charCodeAt(0));
  const path = `monthly/${book.filename.replace(/\.xlsx$/, "")}-${Date.now()}.xlsx`;

  const upload = await supabaseAdmin.storage.from("exports").upload(path, bytes, {
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    upsert: true,
  });
  if (upload.error) {
    console.error("[monthly-export] upload failed:", upload.error);
    return json({ error: "upload_failed" }, 500);
  }

  const signed = await supabaseAdmin.storage
    .from("exports")
    .createSignedUrl(path, LINK_TTL_SECONDS, { download: book.filename });
  const downloadUrl = signed.data?.signedUrl ?? null;
  if (!downloadUrl) {
    console.error("[monthly-export] signed url failed:", signed.error);
    return json({ error: "signed_url_failed" }, 500);
  }

  const expires = new Date(Date.now() + LINK_TTL_SECONDS * 1000).toISOString().slice(0, 10);
  const monthLabel =
    book.periodLabel ??
    new Date(`${monthStart}T00:00:00Z`).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });

  const emailed: string[] = [];
  try {
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    for (const to of RECIPIENTS) {
      const result = await sendTemplateEmail("monthly-export", to, {
        idempotencyKey: `monthly-export-${path}-${to}`,
        templateData: {
          monthLabel,
          downloadUrl,
          filename: book.filename,
          neighborhoodsWithData: book.neighborhoodsWithData,
          neighborhoodsTotal: book.neighborhoodsTotal,
          contradictions: book.contradictions,
          isProvisional: book.isProvisional,
          linkExpiresLabel: expires,
        },
      });
      if (result.sent) emailed.push(to);
    }
  } catch (e) {
    console.error("[monthly-export] email failed:", e);
  }

  await (supabaseAdmin as any).from("export_job_state").upsert(
    {
      job: "monthly-tracker-export",
      last_monthly_period: monthStart,
      last_monthly_sent_at: new Date().toISOString(),
      last_monthly_path: path,
    },
    { onConflict: "job" },
  );

  return json({
    success: true,
    skipped: false,
    monthStart,
    monthLabel,
    path,
    filename: book.filename,
    contradictions: book.contradictions,
    emailed,
    expiresOn: expires,
  });
}

export const Route = createFileRoute("/api/public/monthly-export")({
  server: {
    handlers: {
      POST: async ({ request }) => run(request),
      GET: async ({ request }) => run(request),
    },
  },
});
