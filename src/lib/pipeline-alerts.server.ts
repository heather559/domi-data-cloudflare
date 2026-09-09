// Server-only monitor for the pipeline run log. Flags runs that failed and
// runs that are still marked running past the stall timeout, then emails the
// operators once per run per condition.
import {
  fmtStamp,
  type AlertCheckResult,
  type AlertKind,
  type PipelineRun,
} from "@/lib/pipeline-runs";

export type { AlertCheckResult, AlertKind };

const DEFAULT_STALL_MINUTES = 90;
const DEFAULT_RECIPIENTS = ["hdomi@heatherdomi.com"];
const DASHBOARD_URL = "https://domidata.heatherdomi.com/pipeline-runs";
const FAILED_STATUSES = new Set(["failed", "error", "errored", "failure", "aborted"]);
const RUNNING_STATUSES = new Set(["running", "started", "in_progress"]);

export interface PipelineAlert {
  run: PipelineRun;
  kind: AlertKind;
  minutesRunning: number;
}

function stallMinutes(): number {
  const raw = Number(process.env["PIPELINE_STALL_MINUTES"]);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_STALL_MINUTES;
}

function recipients(): string[] {
  const raw = process.env["PIPELINE_ALERT_RECIPIENTS"];
  if (!raw) return DEFAULT_RECIPIENTS;
  const list = raw
    .split(/[,\s;]+/)
    .map((s) => s.trim())
    .filter((s) => s.includes("@"));
  return list.length ? list : DEFAULT_RECIPIENTS;
}

function minutesSince(iso: string): number {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.round((Date.now() - t) / 60000));
}

/** Pure classifier: which runs currently warrant an alert. */
export function findAlerts(runs: PipelineRun[], limitMinutes: number): PipelineAlert[] {
  const out: PipelineAlert[] = [];
  for (const run of runs) {
    const status = (run.status || "").toLowerCase();
    const mins = minutesSince(run.startedAt);
    if (FAILED_STATUSES.has(status)) {
      out.push({ run, kind: "failed", minutesRunning: mins });
      continue;
    }
    if (RUNNING_STATUSES.has(status) && !run.completedAt && mins > limitMinutes) {
      out.push({ run, kind: "stalled", minutesRunning: mins });
    }
  }
  return out;
}

function alertKey(a: PipelineAlert): string {
  return `${a.run.agentName}|${a.run.weekStart}|${a.run.startedAt}|${a.kind}`;
}

/**
 * Runs one monitoring pass. Safe to call on a schedule: each run and condition
 * notifies once, tracked in public.pipeline_alert_state.
 */
export async function runPipelineAlertCheck(): Promise<AlertCheckResult> {
  const limit = stallMinutes();
  const to = recipients();

  const { listPipelineRuns } = await import("@/lib/pipeline-runs.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const client = supabaseAdmin as unknown as { from: (t: string) => any };

  const runs = await listPipelineRuns();
  const alerts = findAlerts(runs, limit);

  const result: AlertCheckResult = {
    checked: runs.length,
    flagged: alerts.length,
    notified: 0,
    skippedAlreadyNotified: 0,
    stallMinutes: limit,
    recipients: to,
    alerts: alerts.map((a) => ({
      agentName: a.run.agentName,
      weekStart: a.run.weekStart,
      kind: a.kind,
    })),
  };

  if (alerts.length === 0) return result;

  // Claim the alerts that have not been notified yet. The primary key makes the
  // insert the lock, so a double-fired schedule cannot double-send.
  const fresh: PipelineAlert[] = [];
  for (const a of alerts) {
    const { error } = await client.from("pipeline_alert_state").insert({
      alert_key: alertKey(a),
      agent_name: a.run.agentName,
      week_start: a.run.weekStart || null,
      started_at: a.run.startedAt,
      kind: a.kind,
    });
    if (error) result.skippedAlreadyNotified += 1;
    else fresh.push(a);
  }

  if (fresh.length === 0) return result;

  const templateData = {
    items: fresh.map((a) => ({
      agentName: a.run.agentName,
      weekStart: a.run.weekStart,
      kind: a.kind,
      status: a.run.status,
      startedAt: fmtStamp(a.run.startedAt),
      minutesRunning: a.minutesRunning,
      detail: a.run.detail,
    })),
    stallMinutes: limit,
    dashboardUrl: DASHBOARD_URL,
    checkedAt: fmtStamp(new Date().toISOString()),
  };

  const batchKey = fresh.map(alertKey).sort().join(",");
  const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");

  for (const address of to) {
    try {
      const sent = await sendTemplateEmail("pipeline-alert", address, {
        idempotencyKey: `pipeline-alert-${address}-${batchKey}`.slice(0, 200),
        templateData,
      });
      if (sent.sent) result.notified += 1;
    } catch (err) {
      console.error("[pipeline-alerts] send failed:", err);
      // Release the claims so the next pass retries this batch.
      for (const a of fresh) {
        await client.from("pipeline_alert_state").delete().eq("alert_key", alertKey(a));
      }
      throw err;
    }
  }

  return result;
}
