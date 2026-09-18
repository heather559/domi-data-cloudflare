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
