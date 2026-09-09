# Domi Data — Migration Brief

**Site:** domidata.heatherdomi.com  
**Repo:** github.com/heather559/domi-data  
**Framework:** TanStack Start + Nitro → Cloudflare Workers (already configured)  
**Goal:** Deploy independently on Cloudflare, replacing four Lovable-managed services

---

## Background

The site was built in Lovable. The code is solid and already on GitHub. The problem is that four backend services route through Lovable's infrastructure — AI agent, email, HubSpot sync, and Supabase. Each needs to be replaced before we can run independently.

The subscriber sign-up form is already built and in the repo (`src/components/subscribe-form.tsx`, `src/routes/api/public/subscribe.ts`). It just needs to be wired to Heather's own Supabase (see item 4 below).

---

## The four replacements

### 1. AI Chat Agent — swap Lovable gateway for Anthropic direct

**File:** `src/lib/ai-gateway.server.ts`

Current code routes through `https://ai.gateway.lovable.dev/v1` using a `LOVABLE_API_KEY`. Replace entirely:

```ts
import { createAnthropic } from "@ai-sdk/anthropic";

export function createAiProvider() {
  return createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}
```

Install: `npm install @ai-sdk/anthropic`

In `src/routes/api/agent.ts`: swap `createLovableAiGatewayProvider(lovableApiKey)` for `createAiProvider()` and remove the `LOVABLE_API_KEY` env lookup. Also update `ALLOWED_ORIGINS` — add the workers.dev URL during testing, lock to `domidata.heatherdomi.com` for production.

**Env var:** `ANTHROPIC_API_KEY` — from console.anthropic.com

---

### 2. Email notifications — swap Lovable email for Resend

**File:** `src/lib/email-templates/send-email.ts`

Currently uses `@lovable.dev/email-js`. Replace the send function with Resend. The email templates (`src/lib/email-templates/`) are React Email components and stay unchanged — only the send layer changes.

```ts
import { Resend } from "resend";
const resend = new Resend(process.env.RESEND_API_KEY);
```

Install: `npm install resend`

Create account at resend.com, verify `heatherdomi.com` as a sending domain, get the API key.

**Env var:** `RESEND_API_KEY`

---

### 3. HubSpot sync — swap Lovable connector for direct API

**File:** `src/routes/api/public/lead.ts` — bottom half, the `syncToHubspot` function

Currently routes through `https://connector-gateway.lovable.dev/hubspot`. Replace the `hubspotFetch` wrapper:

```ts
const HUBSPOT_BASE = "https://api.hubapi.com";

async function hubspotFetch(path: string, method: "GET" | "POST" | "PATCH" | "PUT", body?: unknown) {
  const key = process.env.HUBSPOT_API_KEY;
  if (!key) throw new Error("HUBSPOT_API_KEY missing");
  return fetch(`${HUBSPOT_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}
```

Remove the `LOVABLE_API_KEY` / `lovableKey` references from that function. Everything else (upsert contact, increment count, attach note, create lead record) stays identical.

**Env vars:** `HUBSPOT_API_KEY` (Heather has this), plus the pipeline/stage/owner IDs already have fallback values in the code at lines ~357–359.

---

### 4. Supabase — two parts

#### Part A: Subscriber form (do this first — independent of the rest)

Heather is creating her own Supabase project. Once she has it, run this in the SQL editor:

```sql
CREATE TABLE subscribers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  name text NOT NULL,
  email text NOT NULL,
  source_path text,
  user_agent text,
  referrer text
);

ALTER TABLE subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public subscribe" ON subscribers
  FOR INSERT TO anon
  WITH CHECK (true);
```

Then update `src/routes/api/public/subscribe.ts` — replace the `supabaseAdmin` insert with the anon client against the new project. RLS allows public inserts so no service role key needed:

```ts
import { createClient } from "@supabase/supabase-js";

const subscriberDb = createClient(
  process.env.SUBSCRIBER_SUPABASE_URL!,
  process.env.SUBSCRIBER_SUPABASE_ANON_KEY!,
);

// Replace the supabaseAdmin insert and logAudit call with:
const { data: inserted, error } = await subscriberDb
  .from("subscribers")
  .insert({
    name: data.name,
    email: data.email,
    source_path: data.source_path || null,
    user_agent: request.headers.get("user-agent"),
    referrer: request.headers.get("referer"),
  })
  .select("id")
  .single();
```

**Env vars:** `SUBSCRIBER_SUPABASE_URL`, `SUBSCRIBER_SUPABASE_ANON_KEY` — both from Heather's new project, Settings → API

---

#### Part B: Everything else (report data, lead form inserts)

The rest of the app reads from and writes to the Lovable-managed Supabase at `anjowhjllwozokdfbzsn.supabase.co`. To make those work on the Cloudflare deployment, you need the `SUPABASE_SERVICE_ROLE_KEY`.

Heather does not currently have access to it — Lovable provisioned that project under their own org. **Contact Lovable support** and request the service role key, explaining you're migrating to independent hosting. They should provide it. If they won't, the fallback is to create a new Supabase project, recreate the schema from `src/integrations/supabase/types.ts`, and re-point the data pipeline.

---

## Full environment variable list for Cloudflare

Set all of these as secrets in the Cloudflare Workers dashboard:  
`heather559-domi-data` → Settings → Variables and Secrets

| Variable | Where to get it |
|---|---|
| `SUPABASE_URL` | Already in `.env` in the repo |
| `SUPABASE_PUBLISHABLE_KEY` | Already in `.env` in the repo |
| `SUPABASE_SERVICE_ROLE_KEY` | Request from Lovable support |
| `SUBSCRIBER_SUPABASE_URL` | Heather's new Supabase project |
| `SUBSCRIBER_SUPABASE_ANON_KEY` | Heather's new Supabase project |
| `ANTHROPIC_API_KEY` | console.anthropic.com |
| `RESEND_API_KEY` | resend.com |
| `HUBSPOT_API_KEY` | Heather's HubSpot account |
| `TURNSTILE_SECRET_KEY` | Cloudflare dashboard → Turnstile → create widget for domidata.heatherdomi.com |
| `SITE_ORIGINS` | `https://domidata.heatherdomi.com` (add workers.dev URL during testing) |

---

## Deployment

The app already targets Cloudflare Workers — no preset changes needed.

```bash
npm install
npm run build
npx wrangler login        # opens browser to authenticate
npx wrangler deploy --config .output/server/wrangler.json
```

Set secrets via CLI:
```bash
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put RESEND_API_KEY
# repeat for each secret above
```

Test at `https://heather559-domi-data.workers.dev` before touching DNS. Check every page: home, this-week, monthly, a neighborhood page, the agent chat, the lead form, the subscribe form.

---

## Domain cutover (Heather does this step)

Once the workers.dev version is confirmed working end-to-end:

1. Log into GoDaddy → DNS management for `heatherdomi.com`
2. Find the `domidata` CNAME record (currently pointing to Lovable)
3. Change the value to: `heather559-domi-data.workers.dev`
4. Save — propagation takes 5–60 minutes

The Lovable version stays live as a fallback throughout. No downtime risk.

---

## Tag-team handoff order

1. **Heather** — creates Supabase project, shares URL + keys with Andrew
2. **Andrew** — runs SQL, updates subscribe endpoint, makes the four code swaps, deploys to workers.dev
3. **Heather** — tests the workers.dev URL like a real visitor (every page, agent chat, subscribe form)
4. **Heather** — contacts Lovable support for service role key, pulls HubSpot key, creates Turnstile widget
5. **Andrew** — sets all secrets in Cloudflare, re-tests, gives Heather the all-clear
6. **Heather** — updates GoDaddy DNS record, site goes live on Cloudflare

---

## Questions?

Andrew can open the Prime Agent Desk app on Heather's machine and ask questions directly — full codebase context is available there. Or reach out to Heather to relay questions.
