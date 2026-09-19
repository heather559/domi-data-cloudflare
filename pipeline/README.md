# domi-data-pipeline

Phase 1 of a multi-phase rebuild of the weekly Manhattan luxury market-data
refresh job that currently runs as a scheduled Claude AI agent (`site-data-agent`
/ `site-data-monitor-agent`), moving it to real, deployed TypeScript code on
Railway, as a second service in this repo.

The complete, ground-truth business-logic spec for the job this is rebuilding
lives in `../docs/site-data-agent-FULL-PROMPT-2026-09-18.md` and
`../docs/site-data-monitor-agent-FULL-PROMPT-2026-09-18.md` -- read those in
full before touching Phase 2+ work. **This phase implements almost none of
that spec's business logic** -- it's the infrastructure skeleton only, proven
end to end with zero live Marketproof data pulls (those are blocked on
getting a working Marketproof API key).

## What Phase 1 actually does

Running `npm start` (or `npm run build && npm start`):

1. Computes the current Mon-Sun week via DST-safe America/New_York date math.
2. Upserts a `running` row into `public.pipeline_run_status` for
   `agent_name = 'site-data-agent-v2'` (a distinct name from the existing
   `site-data-agent` AI routine, so the two never collide while both exist
   side by side during the rebuild).
3. Immediately upserts that same row to `completed`.
4. Sends one Slack message confirming the run, including the computed
   `week_start`/`week_end` so a human can eyeball it.
5. Exits cleanly (exit code 0 on success, 1 on an unhandled error).

**It does not write anything to `public.weekly_report`.** That starts in
Phase 2, once real Marketproof data is available.

## What's built but not yet wired into `index.ts`

These exist now, fully unit-tested, so Phase 2 can use them directly without
re-deriving the same guardrails:

- `schema/weeklyReportPayload.ts` -- the full Zod schema for the
  `weekly_report.payload` shape.
- `schema/checks.ts` -- the structural consistency checks from the spec
  (tier cutoff monotonicity, hero/demand_trend cross-check, supply
  sanity, leaderboard sort-order, bedroom-mix sum check), as small pure
  functions returning `{ ok, code, detail? }`.
- `lib/pct.ts` -- the shared percentage-change helper.
- `io/supabase.ts` -- `writeWeeklyReport()` with the write-then-read-back
  confirmation pattern the spec requires, ready for Phase 2 to call.

## Required environment variables

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Same env var name the deployed site already uses. |
| `SUPABASE_SERVICE_ROLE_KEY` | Same env var name the deployed site already uses. Bypasses RLS -- `weekly_report`/`pipeline_run_status` have RLS enabled with zero policies (deny-by-default, service-role-only) by design. |
| `SLACK_WEBHOOK_URL` | A Slack **Incoming Webhook** URL (`https://hooks.slack.com/services/...`). See `io/slack.ts` for why a webhook was chosen over the `chat.postMessage` bot-token API. Needs to be created in Slack and set on the Railway service before this runs for real. |
| `MARKETPROOF_API_KEY` | Set on the `domi-data-pipeline` Railway service (Phase 2). Used by every client in `fetch/` and by `topDeals/` (as the MCP server's `authorization_token`). |
| `ANTHROPIC_API_KEY` | Set on the `domi-data-pipeline` Railway service (Phase 2). Used only by `topDeals/fetchTopDeals.ts` -- the one deliberately AI-touched piece of this pipeline. |

## Phase 2 additions: `fetch/` and `topDeals/`

Built and tested in isolation this pass -- **not yet wired into `index.ts`'s
scheduled run, and nothing here writes to `weekly_report`.** That's Phase 3.

- `fetch/` -- plain, zero-AI, typed Marketproof REST clients, one per
  dataset, sharing `fetch/marketproofClient.ts`'s retry-once-then-null
  helper (matching the spec's own HARD RULE verbatim). Built:
  `contractStats`, `weeklyContractStats`, `luxuryContractStats`,
  `neighborhoodRank`, `supply`. A response that comes back HTTP 200 but
  fails its Zod schema throws `MarketproofSchemaError` immediately rather
  than being silently retried/nulled -- that's a "our understanding of the
  API shape is wrong" signal, not a transient failure. **Provenance
  caveat:** `luxuryContractStats`/`weeklyContractStats`/`neighborhoodRank`'s
  schemas are built from the field names the ground-truth spec's own STEP
  1-5 usage text quotes (e.g. `lines.p90.cutoff`,
  `contractsByPeriod[].contractCount/totalPrice/avgDaysOnMarket`); the base
  `contractStats` and `supply` schemas are inferred (from Marketproof's own
  `{base, weekly-, monthly-}` dataset naming pattern, and from what STEP 5
  says is *done* with the response, respectively) rather than quoted
  anywhere in the spec -- both are kept deliberately loose
  (`.passthrough()`/`z.record`) until a live call confirms the real shape.
  `contractStats.test.ts` and `neighborhoodRank.test.ts` are real,
  read-only integration tests against the live API (skip gracefully if
  `MARKETPROOF_API_KEY` isn't set).

- `topDeals/fetchTopDeals.ts` -- the STEP 6 "Top 5 Deals" feature. This is
  the one part of the whole pipeline that can't be built from the plain
  REST API (record-level named addresses aren't in any REST dataset --
  confirmed by direct testing, and by Marketproof's own docs, which put
  that data behind their MCP connector instead). Implemented as a single,
  narrow call to Anthropic's Messages API with Marketproof's remote MCP
  server attached via the MCP connector (`mcp_servers` + `tools:
  [{type: "mcp_toolset", ...}]`, beta `mcp-client-2025-11-20`) -- not an
  open-ended agent, one request that must return only a JSON array
  matching `topDealSchema`, validated before it's ever trusted. See the
  file's own header comment for the exact determinism tradeoff (current
  models reject an explicit `temperature` parameter outright) and how
  `pause_turn` is handled. `fetchTopDeals.test.ts` is a real, live
  integration test (skips gracefully unless both `ANTHROPIC_API_KEY` and
  `MARKETPROOF_API_KEY` are set).

## Running locally

```bash
cd pipeline
npm install
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... SLACK_WEBHOOK_URL=... npm run build && npm start
```

## Scripts

- `npm run build` -- compiles with `tsc` (via `tsconfig.build.json`) to `dist/`.
- `npm start` -- runs the compiled entrypoint: `node dist/index.js`.
- `npm test` -- runs the vitest suite.
- `npm run typecheck` -- `tsc --noEmit` across the whole workspace, including tests.

### Why a `tsc` build step instead of `tsx`-at-runtime

The main site (`../src`) is a Vite/Nitro app with no `tsc` build step of its
own, but for this service -- a scheduled batch job, not a request-serving
app -- a plain `tsc` build followed by `node dist/index.js` was chosen over
running TypeScript directly via `tsx`/`ts-node`: one less runtime dependency
in the deployed container, and a `tsc` compile failure is a hard build-time
error on Railway rather than a runtime surprise mid-cron-run. The build
output targets CommonJS (see `tsconfig.build.json`) to avoid ESM
relative-import extension requirements entirely, since this is a small,
dependency-light service with no need for ESM-only packages.

## Phase plan (for context)

- **Phase 1 (this)**: infrastructure skeleton -- schema, checks, week/pct
  helpers, Supabase + Slack I/O, a proof-of-life entrypoint. No business logic.
- **Phase 2/3**: real Marketproof HTTP clients, the full `compute/` layer
  implementing the spec's STEP 1-7.5 field mappings, backfill/shadow-mode
  harness against the existing AI-agent's output before cutover.

## Deployment

Runs on Railway as service `domi-data-pipeline` in the `domi-data` project,
root directory `pipeline/`, weekly cron schedule `5 8 * * 1` (Mon 8:05 UTC --
comfortably clears both EDT and EST so the DST-safe week math in `lib/week.ts`
is never evaluated right at a schedule boundary).
