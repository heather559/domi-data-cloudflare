import { createFileRoute } from "@tanstack/react-router";

// Called by the scheduled job on Monday mornings. Builds the weekly workbook,
// stores it in the private `exports` bucket, and emails a signed download link.
// Auth: shared secret header, checked before any work happens.

const RECIPIENTS = ["hdomi@heatherdomi.com"];
const LINK_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

function unauthorized() {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
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
  if (!provided) return unauthorized();

  const { buildWeeklyWorkbook } = await import("@/lib/weekly-workbook.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Two accepted callers: the scheduled database job (token row) and a manual
  // run using the environment secret.
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
  if (!ok) return unauthorized();

  const book = await buildWeeklyWorkbook();
  const bytes = Uint8Array.from(atob(book.base64), (c) => c.charCodeAt(0));
  const path = `weekly/${book.filename.replace(/\.xlsx$/, "")}-${Date.now()}.xlsx`;

  const upload = await supabaseAdmin.storage.from("exports").upload(path, bytes, {
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    upsert: true,
  });
  if (upload.error) {
    console.error("[weekly-export] upload failed:", upload.error);
    return new Response(JSON.stringify({ error: "upload_failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const signed = await supabaseAdmin.storage
    .from("exports")
    .createSignedUrl(path, LINK_TTL_SECONDS, { download: book.filename });
  const downloadUrl = signed.data?.signedUrl ?? null;
  if (!downloadUrl) {
    console.error("[weekly-export] signed url failed:", signed.error);
    return new Response(JSON.stringify({ error: "signed_url_failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const expires = new Date(Date.now() + LINK_TTL_SECONDS * 1000).toISOString().slice(0, 10);
  const emailed: string[] = [];
  try {
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    for (const to of RECIPIENTS) {
      const result = await sendTemplateEmail("weekly-export", to, {
        idempotencyKey: `weekly-export-${path}-${to}`,
        templateData: {
          weekStart: book.weekStart ?? undefined,
          weekEnd: book.weekEnd ?? undefined,
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
    console.error("[weekly-export] email failed:", e);
  }

  return new Response(
    JSON.stringify({
      success: true,
      path,
      filename: book.filename,
      weekStart: book.weekStart,
      contradictions: book.contradictions,
      emailed,
      expiresOn: expires,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
}

export const Route = createFileRoute("/api/public/weekly-export")({
  server: {
    handlers: {
      POST: async ({ request }) => run(request),
      GET: async ({ request }) => run(request),
    },
  },
});
