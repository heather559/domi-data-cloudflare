import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const PRICE_RANGES = ["under-3m", "3-5m", "5-10m", "10-20m", "20m-plus"] as const;
const TIMELINES = ["now", "3-months", "6-12-months", "exploring"] as const;
const INTENTS = ["buying", "selling", "both", "press", "consulting", "methodology", "other"] as const;

const transcriptTurn = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string().max(4000),
});

const schema = z.object({
  intent: z.enum(INTENTS),
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().toLowerCase().email().max(320),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  neighborhoods: z.array(z.string().max(80)).max(10).optional(),
  price_range: z.enum(PRICE_RANGES).optional().or(z.literal("")),
  timeline: z.enum(TIMELINES).optional().or(z.literal("")),
  reason: z.string().max(80).optional().or(z.literal("")),
  message: z.string().trim().max(4000).optional().or(z.literal("")),
  source_path: z.string().max(500).optional(),
  source: z.enum(["buy-sell", "contact"]).optional(),
  session_id: z.string().max(80).optional(),
  tier: z.enum(["soft", "hard"]).optional(),
  transcript: z.array(transcriptTurn).max(60).optional(),
  // honeypot — must be empty
  company: z.string().max(0).optional().or(z.literal("")),
});

type Bucket = { count: number; resetAt: number };
const rateBuckets = new Map<string, Bucket>();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;

function rateLimit(key: string): boolean {
  const now = Date.now();
  const b = rateBuckets.get(key);
  if (!b || b.resetAt < now) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (b.count >= RATE_LIMIT) return false;
  b.count += 1;
  return true;
}

export const Route = createFileRoute("/api/public/lead")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
        }

        const parsed = schema.safeParse(body);
        if (!parsed.success) {
          console.error("lead invalid_input", {
            issues: parsed.error.issues,
            received: body,
          });
          return Response.json(
            { ok: false, error: "invalid_input", issues: parsed.error.issues },
            { status: 400 },
          );
        }
        const data = parsed.data;

        // Honeypot: silently accept and drop
        if (data.company) {
          return Response.json({ ok: true });
        }

        const ip =
          request.headers.get("cf-connecting-ip") ||
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          "unknown";
        if (!rateLimit(`${ip}:${data.email}`)) {
          return Response.json({ ok: false, error: "rate_limited" }, { status: 429 });
        }

        const transcript = (data.transcript ?? []).slice(-40);
        const clientSessionId = isUuid(data.session_id) ? data.session_id : null;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { logAudit } = await import("@/lib/audit-log.server");
        const { data: inserted, error } = await supabaseAdmin
          .from("lead_submissions")
          .insert({
            intent: data.intent,
            name: data.name,
            email: data.email,
            phone: data.phone || null,
            neighborhoods: data.neighborhoods ?? [],
            price_range: data.price_range || null,
            timeline: data.timeline || null,
            reason: data.reason || null,
            message: data.message || null,
            source_path: data.source_path || null,
            user_agent: request.headers.get("user-agent"),
            referrer: request.headers.get("referer"),
            transcript: transcript.length ? transcript : null,
            client_session_id: clientSessionId,
            tier: data.tier ?? null,
          })
          .select("id")
          .single();

        if (error) {
          console.error("lead insert failed", error);
          await logAudit({
            actor: "lead_api",
            action: "insert",
            targetTable: "lead_submissions",
            sessionId: clientSessionId,
            outcome: "error",
            errorCode: error.code ?? null,
            errorMessage: error.message,
            ip,
            meta: { intent: data.intent, source: data.source ?? null },
          });
          return Response.json({ ok: false, error: "server_error" }, { status: 500 });
        }

        await logAudit({
          actor: "lead_api",
          action: "insert",
          targetTable: "lead_submissions",
          sessionId: clientSessionId,
          leadId: inserted?.id ?? null,
          rowCount: 1,
          ip,
          meta: {
            intent: data.intent,
            tier: data.tier ?? null,
            source: data.source ?? null,
            has_transcript: transcript.length > 0,
          },
        });

        const leadSource: LeadSource =
          transcript.length > 0
            ? "ask-heather"
            : data.source === "contact"
              ? "contact"
              : "buy-sell";

        // Run HubSpot sync + notification email in parallel and await both,
        // so neither is dropped by the Worker when the response returns.
        // Prior background-task approach (ctx.waitUntil) was silently dropping
        // work in production, so leads were saved but no email was sent.
        const recipient = leadSource === "contact" ? "press@heatherdomi.com" : "hdomi@heatherdomi.com";
        const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");

        await Promise.allSettled([
          (async () => {
            try {
              await syncToHubspot(data, transcript, leadSource);
            } catch (e) {
              console.error("hubspot sync failed", e);
            }
          })(),
          (async () => {
            try {
              await sendTemplateEmail("handoff-transcript", recipient, {
                idempotencyKey: `lead-${clientSessionId ?? data.email}-${Date.now()}`,
                replyTo: data.email,
                templateData: {
                  leadName: data.name,
                  leadEmail: data.email,
                  leadPhone: data.phone || undefined,
                  intent: data.intent,
                  neighborhoods: data.neighborhoods,
                  priceRange: data.price_range || undefined,
                  timeline: data.timeline || undefined,
                  message: data.message || undefined,
                  sourcePath: data.source_path || undefined,
                  sessionId: clientSessionId || undefined,
                  tier: data.tier ?? undefined,
                  leadSource,
                  reason: leadSource === "contact" ? (data.reason || data.intent) : undefined,
                  transcript,
                },
              });
            } catch (e) {
              console.error("lead email failed", e);
            }
          })(),
        ]);


        return Response.json({ ok: true });

      },

    },
  },
});

function isUuid(v: string | undefined): v is string {
  return !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

const HUBSPOT_BASE = "https://api.hubapi.com";

type LeadData = z.infer<typeof schema>;
type TranscriptTurn = z.infer<typeof transcriptTurn>;
type LeadSource = "ask-heather" | "buy-sell" | "contact";

const LEAD_SOURCE_LABEL: Record<LeadSource, string> = {
  "ask-heather": "Ask Heather",
  "buy-sell": "Buy / Sell",
  contact: "Contact",
};

function splitName(full: string): { firstname: string; lastname: string } {
  const trimmed = full.trim();
  const idx = trimmed.indexOf(" ");
  if (idx === -1) return { firstname: trimmed, lastname: "" };
  return {
    firstname: trimmed.slice(0, idx),
    lastname: trimmed.slice(idx + 1).trim(),
  };
}

function buildProperties(data: LeadData, leadSource: LeadSource) {
  const { firstname, lastname } = splitName(data.name);
  // HubSpot date-type property: must be exact midnight UTC. Send epoch ms for today at 00:00:00Z.
  const todayMidnightUtcMs = new Date(new Date().toISOString().slice(0, 10)).getTime();
  const props: Record<string, string | number> = {
    email: data.email,
    firstname,
    domi_last_submission_at: todayMidnightUtcMs,
    domi_data_lead_source: LEAD_SOURCE_LABEL[leadSource],
    hs_lead_status: "NEW",
    lifecyclestage: "lead",
  };
  if (lastname) props.lastname = lastname;
  if (data.phone) props.phone = data.phone;
  if (data.message) props.message = data.message;
  if (data.source_path) props.domi_source_path = data.source_path;

  // Buy/Sell intents
  if (["buying", "selling", "both"].includes(data.intent)) {
    props.domi_intent = data.intent;
  }
  // Contact reasons
  if (["press", "consulting", "methodology", "other"].includes(data.intent)) {
    props.domi_contact_reason = data.intent;
  }
  if (data.neighborhoods && data.neighborhoods.length) {
    // HubSpot multi-checkbox properties expect semicolon-separated values.
    props.domi_neighborhoods = data.neighborhoods.join(";");
  }
  if (data.price_range) props.domi_price_range = data.price_range;
  if (data.timeline) props.domi_timeline = data.timeline;

  return props;
}


async function hubspotFetch(path: string, method: "GET" | "POST" | "PATCH" | "PUT", body?: unknown) {
  const key = process.env.HUBSPOT_API_KEY;
  if (!key) {
    throw new Error("HUBSPOT_API_KEY missing");
  }
  return fetch(`${HUBSPOT_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function syncToHubspot(data: LeadData, transcript: TranscriptTurn[], leadSource: LeadSource) {
  // Try upsert-by-email via PATCH with idProperty=email.
  const email = encodeURIComponent(data.email);
  let contactId: string | null = null;

  const patchRes = await hubspotFetch(
    `/crm/v3/objects/contacts/${email}?idProperty=email`,
    "PATCH",
    { properties: buildProperties(data, leadSource) },
  );

  if (patchRes.ok) {
    contactId = await readContactId(patchRes);
  } else if (patchRes.status === 404) {
    // Contact does not exist yet; create it.
    const createRes = await hubspotFetch("/crm/v3/objects/contacts", "POST", {
      properties: buildProperties(data, leadSource),
    });
    if (!createRes.ok) {
      const body = await createRes.text();
      console.error(`hubspot create failed [${createRes.status}]`, body);
      return;
    }
    contactId = await readContactId(createRes);
  } else {
    const body = await patchRes.text();
    console.error(`hubspot upsert failed [${patchRes.status}]`, body);
    return;
  }

  // Increment submission count (best-effort).
  if (contactId) {
    try {
      await incrementSubmissionCount(contactId);
    } catch (e) {
      console.error("hubspot submission count increment failed", e);
    }
  }

  // Attach a Note engagement on the contact for every submission.
  if (contactId) {
    try {
      await attachSubmissionNote(contactId, data, transcript, leadSource);
    } catch (e) {
      console.error("hubspot note failed", e);
    }
  }

  // Create a Lead record on the Lead object (0-136), associated with the
  // contact, so the "Domi Data Lead Source" chip becomes filterable on the
  // Leads dashboard.
  if (contactId) {
    try {
      await createLeadRecord(contactId, data, leadSource);
    } catch (e) {
      console.error("hubspot lead create failed", e);
    }
  }
}

// Custom "Domi Data Pipeline" on the Lead object, "New Website Lead" stage.
const HUBSPOT_LEAD_PIPELINE_ID = process.env.HUBSPOT_LEAD_PIPELINE_ID ?? "920781414";
const HUBSPOT_LEAD_PIPELINE_STAGE_ID = process.env.HUBSPOT_LEAD_PIPELINE_STAGE_ID ?? "1404975033";
const HUBSPOT_LEAD_OWNER_ID = process.env.HUBSPOT_LEAD_OWNER_ID ?? "86475517";

async function createLeadRecord(contactId: string, data: LeadData, leadSource: LeadSource) {
  const leadName = `${data.name}, ${LEAD_SOURCE_LABEL[leadSource]}`;
  const createRes = await hubspotFetch("/crm/v3/objects/leads", "POST", {
    properties: {
      hs_lead_name: leadName,
      domi_data_lead_source: LEAD_SOURCE_LABEL[leadSource],
      hs_pipeline: HUBSPOT_LEAD_PIPELINE_ID,
      hs_pipeline_stage: HUBSPOT_LEAD_PIPELINE_STAGE_ID,
      hubspot_owner_id: HUBSPOT_LEAD_OWNER_ID,
    },
    associations: [
      {
        to: { id: contactId },
        // 578 = Lead -> primary Contact (HubSpot default association type id).
        types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 578 }],
      },
    ],
  });
  if (!createRes.ok) {
    const body = await createRes.text();
    console.error(`hubspot lead create failed [${createRes.status}]`, body);
  }
}

async function incrementSubmissionCount(contactId: string) {
  const getRes = await hubspotFetch(
    `/crm/v3/objects/contacts/${contactId}?properties=domi_submission_count`,
    "GET",
  );
  let current = 0;
  if (getRes.ok) {
    const j = (await getRes.json()) as { properties?: { domi_submission_count?: string | number | null } };
    const raw = j?.properties?.domi_submission_count;
    const n = typeof raw === "number" ? raw : raw ? Number(raw) : 0;
    if (Number.isFinite(n)) current = n;
  }
  await hubspotFetch(`/crm/v3/objects/contacts/${contactId}`, "PATCH", {
    properties: { domi_submission_count: current + 1 },
  });
}

async function readContactId(res: Response): Promise<string | null> {
  try {
    const j = (await res.clone().json()) as { id?: string };
    return j?.id ?? null;
  } catch {
    return null;
  }
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatSubmissionHtml(
  data: LeadData,
  transcript: TranscriptTurn[],
  leadSource: LeadSource,
): string {
  const meta: string[] = [];
  meta.push(`<strong>Source:</strong> ${esc(LEAD_SOURCE_LABEL[leadSource])}`);
  if (data.source_path) meta.push(`<strong>Page:</strong> ${esc(data.source_path)}`);
  meta.push(`<strong>Intent:</strong> ${esc(data.intent)}`);
  if (data.neighborhoods && data.neighborhoods.length) {
    meta.push(`<strong>Neighborhoods:</strong> ${esc(data.neighborhoods.join(", "))}`);
  }
  if (data.price_range) meta.push(`<strong>Price range:</strong> ${esc(data.price_range)}`);
  if (data.timeline) meta.push(`<strong>Timeline:</strong> ${esc(data.timeline)}`);
  if (data.phone) meta.push(`<strong>Phone:</strong> ${esc(data.phone)}`);
  if (data.reason) meta.push(`<strong>Reason:</strong> ${esc(data.reason)}`);
  if (data.message) meta.push(`<strong>Message:</strong> ${esc(data.message)}`);
  if (data.session_id) meta.push(`<strong>Session:</strong> ${esc(data.session_id)}`);
  if (data.tier) meta.push(`<strong>Gate:</strong> ${esc(data.tier)}`);

  let transcriptBlock = "";
  if (transcript.length) {
    const turns = transcript
      .map((t) => {
        const who = t.role === "user" ? "Visitor" : "Heather (AI)";
        const text = esc(t.text).replace(/\n/g, "<br>");
        return `<p><strong>${who}:</strong><br>${text}</p>`;
      })
      .join("");
    transcriptBlock = `<hr><p><strong>Transcript</strong></p>${turns}`;
  }

  return `${meta.map((m) => `<p>${m}</p>`).join("")}${transcriptBlock}`;
}

async function attachSubmissionNote(
  contactId: string,
  data: LeadData,
  transcript: TranscriptTurn[],
  leadSource: LeadSource,
) {
  const bodyHtml = formatSubmissionHtml(data, transcript, leadSource);
  const createRes = await hubspotFetch("/crm/v3/objects/notes", "POST", {
    properties: {
      hs_timestamp: Date.now(),
      hs_note_body: bodyHtml,
    },
  });
  if (!createRes.ok) {
    const body = await createRes.text();
    console.error(`hubspot note create failed [${createRes.status}]`, body);
    return;
  }
  const noteJson = (await createRes.json()) as { id?: string };
  const noteId = noteJson?.id;
  if (!noteId) return;

  // Associate note -> contact using the labeled v4 endpoint (version-stable).
  const assocRes = await hubspotFetch(
    `/crm/v4/objects/notes/${noteId}/associations/default/contacts/${contactId}`,
    "PUT",
  );
  if (!assocRes.ok) {
    const body = await assocRes.text();
    console.error(`hubspot note assoc failed [${assocRes.status}]`, body);
  }
}

