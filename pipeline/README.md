# domi-data-pipeline

A multi-phase rebuild of the weekly Manhattan luxury market-data refresh job
that currently runs as a scheduled Claude AI agent (`site-data-agent` /
`site-data-monitor-agent`), moving it to real, deployed TypeScript code on
Railway, as a second service in this repo.

The complete, ground-truth business-logic spec for the job this is rebuilding
lives in `../docs/site-data-agent-FULL-PROMPT-2026-09-18.md` and
`../docs/site-data-monitor-agent-FULL-PROMPT-2026-09-18.md`.

## What `index.ts` actually does now (live shadow run)

Running `npm start` (or `npm run build && npm start`):

1. Computes the current (just-ended) Mon-Sun week via DST-safe
   America/New_York date math (`lib/week.ts`).
2. Upserts a `running` row into `public.pipeline_run_status` for
   `agent_name = 'site-data-agent-v2'` (a distinct name from the existing
   `site-data-agent` AI routine, so the two never collide while both exist
   side by side during the rebuild).
3. Looks up the PRIOR week's real stored values from `public.weekly_report`
   (`io/supabase.ts`'s `getStoredWeeklyReportPayload`, fed through
   `lib/priorWeek.ts`'s `buildPriorWeekValues`) -- per STEP 0's statefulness
   rule. A missing prior week (expected: `weekly_report` hasn't been updated
   since 2026-08-31) yields `EMPTY_PRIOR_WEEK`, not an error -- every
   compute function already nulls the fields it feeds rather than failing.
4. Runs the real fetch -> compute -> assemble pipeline for that week,
   reusing the exact orchestration `backfill/run.ts` proved correct
   (`backfill/fetchWeek.ts` + `backfill/buildPayload.ts`), including the
   STEP 6 `fetchTopDeals` call (confirmed blocked on a missing Marketproof
   MCP OAuth token -- returns `[]`, logged, not treated as a failure).
5. Runs the STEP 7/7.5 output-contract and structural-consistency checks
   (`schema/checks.ts`) against the assembled payload and logs every
   result, pass or fail. A failed check is logged loudly but is NOT fatal
   here -- this is a shadow run meant to surface findings for a human
   reviewer, not a hard gate.
6. Writes the assembled payload to `public.weekly_report_shadow`
   (`is_provisional = true`, a fresh `run_id` per run) via
   `io/supabase.ts`'s `writeWeeklyReportShadow`, using the same
   write-then-read-back confirmation pattern as `writeWeeklyReport`.
   **Never writes to the real `public.weekly_report`.**
7. Upserts `pipeline_run_status` to `completed` with a one-line detail
   (week range, `run_id`, checks passed/failed, whether a prior week was
   found).
8. Sends one Slack message summarizing the run: the computed week, which of
   the 14 payload sections came back with real data vs. null/empty, the
   STEP 7/7.5 check pass/fail count, and a `week_start` + `run_id` pointer
   to the shadow row.
9. Exits cleanly (0 on success). On an unhandled error, marks
   `pipeline_run_status` as `failed` with the error detail before exiting 1.

**Confirmed via a real run against production Supabase (2026-09-20,
week 2026-09-07..2026-09-13):** all 16 checks passed; 12 of 14 sections came
back with real data (`weekly_activity_leaderboard` and `top_deals` were `[]`,
both expected -- the same Marketproof MCP OAuth blocker); the shadow row
wrote and read back cleanly; Slack delivered (200). One infra gap surfaced
and was fixed during this pass: `public.weekly_report_shadow` was missing
its `service_role` `SELECT/INSERT/UPDATE/DELETE` grants (present on
`weekly_report`/`pipeline_run_status` but not on this newer table) --
granted via a migration; RLS itself was already correctly enabled
deny-by-default on all three tables, matching the design.

## Core building blocks `index.ts` wires together

- `schema/weeklyReportPayload.ts` -- the full Zod schema for the
  `weekly_report.payload` shape.
- `schema/checks.ts` -- the structural consistency checks from the spec
  (tier cutoff monotonicity, hero/demand_trend cross-check, supply
  sanity, leaderboard sort-order, bedroom-mix sum check), as small pure
  functions returning `{ ok, code, detail? }`.
- `lib/pct.ts` -- the shared percentage-change helper.
- `lib/priorWeek.ts` -- `buildPriorWeekValues()`, shared by `index.ts` and
  `backfill/run.ts` to turn a stored `weekly_report.payload` (or `null`)
  into `PriorWeekValues`.
- `io/supabase.ts` -- `writeWeeklyReport()` (real table, write-then-read-back
  confirmed) and `writeWeeklyReportShadow()` / `getStoredWeeklyReportPayload()`
  (the shadow table + prior-week lookup `index.ts` actually calls).

## Required environment variables

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Same env var name the deployed site already uses. |
| `SUPABASE_SERVICE_ROLE_KEY` | Same env var name the deployed site already uses. Bypasses RLS -- `weekly_report`/`pipeline_run_status`/`weekly_report_shadow` have RLS enabled with zero policies (deny-by-default, service-role-only) by design. Note: RLS bypass alone isn't enough -- `service_role` also needs an explicit table-level `GRANT`; `weekly_report_shadow` was missing its CRUD grants until 2026-09-20 (see the confirmed-live-run note above). |
| `SLACK_WEBHOOK_URL` | A Slack **Incoming Webhook** URL (`https://hooks.slack.com/services/...`). See `io/slack.ts` for why a webhook was chosen over the `chat.postMessage` bot-token API. |
| `MARKETPROOF_API_KEY` | Used by every client in `fetch/` and by `topDeals/` (as the MCP server's `authorization_token`, currently rejected -- see below). |
| `ANTHROPIC_API_KEY` | Used only by `topDeals/fetchTopDeals.ts` -- the one deliberately AI-touched piece of this pipeline. |

## `fetch/` and `topDeals/`

- `fetch/` -- plain, zero-AI, typed Marketproof REST clients, one per
  dataset, sharing `fetch/marketproofClient.ts`'s retry-once-then-null
  helper (matching the spec's own HARD RULE verbatim). Built:
  `contractStats`, `weeklyContractStats`, `luxuryContractStats`,
  `neighborhoodRank`, `supply`. A response that comes back HTTP 200 but
  fails its Zod schema throws `MarketproofSchemaError` immediately rather
  than being silently retried/nulled -- that's a "our understanding of the
  API shape is wrong" signal, not a transient failure. **All five schemas
  are now CONFIRMED against real, live responses (2026-09-19)** --
  `contractStats.test.ts` and `neighborhoodRank.test.ts` pass against the
  live API. Two corrections came out of that live pass (both fixed in
  `fetch/schemas.ts`, with a comment at each site): `neighborhood-rank`'s
  per-entry field is `neighborhood`, not `name` as first guessed; and the
  base `contract-stats` dataset turned out to be QUARTERLY-bucketed with a
  `rolling90Day`/`previousRolling90Day` comparison section, not a flat
  aggregate mirroring `weekly-contract-stats` as first guessed -- see the
  schema file's own comments for the full real shape of both.

- `topDeals/fetchTopDeals.ts` -- the STEP 6 "Top 5 Deals" feature. This is
  the one part of the whole pipeline that can't be built from the plain
  REST API (record-level named addresses aren't in any REST dataset --
  confirmed by direct testing, and by Marketproof's own docs, which put
  that data behind their MCP connector instead). Implemented as a single,
  narrow call to Anthropic's Messages API with Marketproof's remote MCP
  server attached via the MCP connector (`mcp_servers` + `tools:
  [{type: "mcp_toolset", ...}]`, beta `mcp-client-2025-11-20`) -- not an
  open-ended agent, one request that must return only a JSON array
  matching `topDealSchema`, validated before it's ever trusted.
  **CONFIRMED BLOCKED as of 2026-09-19 (live test): Marketproof's MCP
  server requires a genuine OAuth 2.0 access token (confirmed via its
  `/.well-known/oauth-protected-resource` metadata) -- it rejects
  `MARKETPROOF_API_KEY` (the REST key) as the connector's
  `authorization_token` with a 401.** The request/error-handling code
  itself is confirmed correct (right beta header, right shapes, fails
  safely with `[]` + a clear log line rather than throwing or fabricating)
  -- what's missing is a real MCP OAuth token, which needs a one-time
  OAuth authorization against `https://mcp.marketproof.com` (separate from
  the REST API key) before this feature can return real data. See the
  file's own header comment for the full finding and the three `curl`
  probes that confirmed it, and for the determinism tradeoff (current
  models reject an explicit `temperature` parameter outright) and how
  `pause_turn` is handled. `fetchTopDeals.test.ts` passes today, but only
  in the "fails safely" sense -- see its own header comment before reading
  a green checkmark as "this returned real deals."

## Running locally

```bash
cd pipeline
npm install
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... SLACK_WEBHOOK_URL=... MARKETPROOF_API_KEY=... ANTHROPIC_API_KEY=... npm run build && npm start
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

- **Phase 1**: infrastructure skeleton -- schema, checks, week/pct helpers,
  Supabase + Slack I/O, a proof-of-life entrypoint. No business logic.
- **Phase 2**: real Marketproof HTTP clients, the full `compute/` layer
  implementing the spec's STEP 1-7.5 field mappings, `backfill/` proving that
  layer against 9 real historical weeks.
- **Phase 3 (current)**: `index.ts` runs the real fetch -> compute -> assemble
  -> checks pipeline for the live current week and writes the result to
  `public.weekly_report_shadow` (never the real `weekly_report`) -- confirmed
  working end to end against production Supabase on 2026-09-20. Still ahead:
  a real Marketproof MCP OAuth token (unblocks `top_deals` and
  `weekly_activity_leaderboard`), a human comparing enough shadow weeks
  against the AI agent's own output, and the actual cutover away from
  `site-data-agent`.

## Deployment

Runs on Railway as service `domi-data-pipeline` in the `domi-data` project,
root directory `pipeline/`, weekly cron schedule `5 8 * * 1` (Mon 8:05 UTC --
comfortably clears both EDT and EST so the DST-safe week math in `lib/week.ts`
is never evaluated right at a schedule boundary). Railway config/cron itself
is out of scope for this pass -- not touched here.

## Verified in production (Railway)

Confirmed 2026-09-20: this exact deployment ran successfully on Railway
itself (not just locally), writing a real shadow row and delivering the
Slack summary from the deployed service.
