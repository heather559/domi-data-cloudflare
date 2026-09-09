import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const schema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().toLowerCase().email().max(320),
  source_path: z.string().max(500).optional(),
  // honeypot — must be empty
  company: z.string().max(0).optional().or(z.literal("")),
});

type Bucket = { count: number; resetAt: number };
const rateBuckets = new Map<string, Bucket>();
const RATE_LIMIT = 3;
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

export const Route = createFileRoute("/api/public/subscribe")({
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

        try {
          const { createClient } = await import("@supabase/supabase-js");
          const url = process.env.SUBSCRIBER_SUPABASE_URL;
          const key = process.env.SUBSCRIBER_SUPABASE_ANON_KEY;
          if (!url || !key) {
            return Response.json({ ok: false, error: "server_error", detail: "missing_env", url: !!url, key: !!key }, { status: 500 });
          }
          const subscriberDb = createClient(url, key);
          const { error } = await subscriberDb
            .from("subscribers")
            .insert({
              name: data.name,
              email: data.email,
              source_path: data.source_path || null,
              user_agent: request.headers.get("user-agent"),
              referrer: request.headers.get("referer"),
            });
          if (error) {
            console.error("subscribe insert failed", error);
            return Response.json({ ok: false, error: "server_error" }, { status: 500 });
          }
          return Response.json({ ok: true });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("subscribe unexpected error", msg);
          return Response.json({ ok: false, error: "server_error", detail: msg }, { status: 500 });
        }
      },
    },
  },
});
