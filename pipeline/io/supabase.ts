import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { WeeklyReportPayload } from '../schema/weeklyReportPayload';

/**
 * Supabase client factory + typed I/O helpers for the pipeline.
 *
 * Mirrors the pattern already used by the site's own server code
 * (src/integrations/supabase/client.server.ts): read SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY from process.env (same env var names the
 * deployed site already uses -- reused here, not reinvented), construct a
 * service-role client that bypasses RLS, and lazily instantiate it so a
 * missing env var only throws when the client is actually used, not at
 * module-import time.
 *
 * RLS note: `public.weekly_report` and `public.pipeline_run_status` have RLS
 * enabled with zero policies (deny-by-default, service-role-only access) by
 * design. This client uses the service role key exactly like the site's own
 * server code does -- no policies are added here.
 */

export type PipelineRunStatus = 'running' | 'completed' | 'failed';

export interface RunStatusRow {
  agent_name: string;
  week_start: string;
  started_at: string;
  status: string;
  completed_at: string | null;
  detail: string | null;
}

let cachedClient: SupabaseClient | undefined;

export function getSupabaseClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    const missing = [
      ...(!SUPABASE_URL ? ['SUPABASE_URL'] : []),
      ...(!SUPABASE_SERVICE_ROLE_KEY ? ['SUPABASE_SERVICE_ROLE_KEY'] : []),
    ];
    throw new Error(
      `Missing Supabase environment variable(s): ${missing.join(', ')}. Set these on the Railway service before running the pipeline.`,
    );
  }

  cachedClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return cachedClient;
}

/**
 * Upserts a pipeline_run_status row, keyed on (agent_name, week_start) --
 * matching the ON CONFLICT (agent_name, week_start) pattern the spec's own
 * INSERT statements use for this table (see site-data-agent STEP 0b and
 * site-data-monitor-agent's SELF-LOGGING section).
 */
export async function upsertRunStatus(
  agentName: string,
  weekStart: string,
  status: PipelineRunStatus,
  detail?: string | null,
): Promise<void> {
  const supabase = getSupabaseClient();

  const row: Record<string, unknown> = {
    agent_name: agentName,
    week_start: weekStart,
    status,
    started_at: new Date().toISOString(),
  };

  if (status === 'completed' || status === 'failed') {
    row.completed_at = new Date().toISOString();
  } else {
    row.completed_at = null;
  }

  row.detail = detail ?? null;

  const { error } = await supabase
    .from('pipeline_run_status')
    .upsert(row, { onConflict: 'agent_name,week_start' });

  if (error) {
    throw new Error(`upsertRunStatus(${agentName}, ${weekStart}, ${status}) failed: ${error.message}`);
  }
}

/**
 * Reads the current pipeline_run_status row for a given agent/week, or null
 * if none exists yet -- used by the concurrency guard (STEP 0a) and by the
 * monitor's completion checks.
 */
export async function getRunStatus(
  agentName: string,
  weekStart: string,
): Promise<RunStatusRow | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('pipeline_run_status')
    .select('agent_name, week_start, started_at, status, completed_at, detail')
    .eq('agent_name', agentName)
    .eq('week_start', weekStart)
    .maybeSingle();

  if (error) {
    throw new Error(`getRunStatus(${agentName}, ${weekStart}) failed: ${error.message}`);
  }

  return data as RunStatusRow | null;
}

export interface WriteWeeklyReportResult {
  confirmed: boolean;
  generatedAt: string | null;
}

/**
 * Writes (upserts) a weekly_report row and then immediately reads it back to
 * confirm the write landed -- matching the spec's "WRITE CONFIRMATION"
 * pattern (site-data-agent STEP 7's write confirmation: select generated_at
 * immediately after writing and confirm it's fresh, i.e. within the last
 * couple of minutes).
 *
 * Phase 1 note: index.ts does NOT call this yet -- Phase 1 explicitly does
 * not write to weekly_report (no real payload exists until Phase 2/3 land
 * live Marketproof data). This is wired up and exported now so Phase 2 can
 * use it directly without redesigning the write-confirmation contract.
 */
export async function writeWeeklyReport(
  weekStart: string,
  weekEnd: string,
  payload: unknown,
  isProvisional: boolean,
): Promise<WriteWeeklyReportResult> {
  const supabase = getSupabaseClient();

  const { error: writeError } = await supabase.from('weekly_report').upsert(
    {
      week_start: weekStart,
      week_end: weekEnd,
      is_provisional: isProvisional,
      payload,
      generated_at: new Date().toISOString(),
    },
    { onConflict: 'week_start' },
  );

  if (writeError) {
    throw new Error(`writeWeeklyReport(${weekStart}) failed to write: ${writeError.message}`);
  }

  const { data, error: readError } = await supabase
    .from('weekly_report')
    .select('generated_at')
    .eq('week_start', weekStart)
    .maybeSingle();

  if (readError) {
    throw new Error(`writeWeeklyReport(${weekStart}) failed to confirm: ${readError.message}`);
  }

  const generatedAt = (data as { generated_at: string } | null)?.generated_at ?? null;
  const confirmed = generatedAt !== null && isRecent(generatedAt, 2 * 60 * 1000);

  return { confirmed, generatedAt };
}

function isRecent(isoTimestamp: string, withinMs: number): boolean {
  const ts = new Date(isoTimestamp).getTime();
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts <= withinMs;
}

/**
 * Reads the REAL, stored `weekly_report.payload` for one exact `week_start`,
 * or `null` if no row exists for that week -- used by the live run
 * (`index.ts`) to look up the prior week's real values per STEP 0's
 * statefulness rule (see `lib/priorWeek.ts`'s `buildPriorWeekValues`, which
 * already handles a `null` result by returning `EMPTY_PRIOR_WEEK` -- a
 * missing prior week is an expected, non-error state, not treated specially
 * here).
 */
export async function getStoredWeeklyReportPayload(weekStart: string): Promise<WeeklyReportPayload | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('weekly_report')
    .select('payload')
    .eq('week_start', weekStart)
    .maybeSingle();

  if (error) {
    throw new Error(`getStoredWeeklyReportPayload(${weekStart}) failed: ${error.message}`);
  }

  return (data as { payload: WeeklyReportPayload } | null)?.payload ?? null;
}

export interface WriteWeeklyReportShadowResult {
  confirmed: boolean;
  runId: string;
  generatedAt: string | null;
}

/**
 * Writes a NEW row to `public.weekly_report_shadow` -- an INSERT, not an
 * upsert, since the table's own primary key is `(week_start, run_id)`
 * specifically so multiple shadow runs for the same week can coexist for
 * comparison (unlike `weekly_report`, which is one row per `week_start`).
 * `run_id` is generated here (rather than left to the column's own
 * `gen_random_uuid()` default) so the caller can report it immediately --
 * in logs, in the Slack summary, and in the write-then-read-back
 * confirmation below -- without a second round trip to discover it.
 *
 * Mirrors `writeWeeklyReport`'s write-then-read-back confirmation pattern:
 * a write isn't trusted until it's read back and its `generated_at` is
 * confirmed fresh.
 *
 * This function NEVER touches `public.weekly_report` -- that table is
 * intentionally untouched by every function in this file's "shadow" path.
 */
export async function writeWeeklyReportShadow(
  weekStart: string,
  weekEnd: string,
  payload: unknown,
  isProvisional: boolean,
): Promise<WriteWeeklyReportShadowResult> {
  const supabase = getSupabaseClient();

  const runId = randomUUID();
  const generatedAt = new Date().toISOString();

  const { error: writeError } = await supabase.from('weekly_report_shadow').insert({
    week_start: weekStart,
    week_end: weekEnd,
    is_provisional: isProvisional,
    payload,
    generated_at: generatedAt,
    run_id: runId,
  });

  if (writeError) {
    throw new Error(`writeWeeklyReportShadow(${weekStart}, run_id=${runId}) failed to write: ${writeError.message}`);
  }

  const { data, error: readError } = await supabase
    .from('weekly_report_shadow')
    .select('generated_at')
    .eq('week_start', weekStart)
    .eq('run_id', runId)
    .maybeSingle();

  if (readError) {
    throw new Error(`writeWeeklyReportShadow(${weekStart}, run_id=${runId}) failed to confirm: ${readError.message}`);
  }

  const confirmedGeneratedAt = (data as { generated_at: string } | null)?.generated_at ?? null;
  const confirmed = confirmedGeneratedAt !== null && isRecent(confirmedGeneratedAt, 2 * 60 * 1000);

  return { confirmed, runId, generatedAt: confirmedGeneratedAt };
}
