// Shared types and formatting for the internal pipeline run dashboard.

export interface PipelineRun {
  agentName: string;
  weekStart: string;
  startedAt: string;
  completedAt: string | null;
  status: string;
  detail: string | null;
}

export function durationMs(run: PipelineRun): number | null {
  if (!run.completedAt) return null;
  const a = Date.parse(run.startedAt);
  const b = Date.parse(run.completedAt);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.max(0, b - a);
}

export function fmtDuration(run: PipelineRun): string {
  const ms = durationMs(run);
  if (ms === null) return "\u2013";
  if (ms < 1000) return `${ms} ms`;
  const s = ms / 1000;
  if (s < 90) return `${s.toFixed(1)} s`;
  const m = Math.floor(s / 60);
  return `${m}m ${Math.round(s - m * 60)}s`;
}

export function fmtStamp(iso: string | null): string {
  if (!iso) return "\u2013";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "\u2013";
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/New_York",
  });
}

export function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function cell(v: string | number | null): string {
  const s = v === null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function runsCsv(runs: PipelineRun[]): string {
  const head = [
    "agent_name",
    "week_start",
    "status",
    "started_at",
    "completed_at",
    "duration_ms",
    "detail",
  ].join(",");
  const lines = runs.map((r) =>
    [
      cell(r.agentName),
      cell(r.weekStart),
      cell(r.status),
      cell(r.startedAt),
      cell(r.completedAt),
      cell(durationMs(r)),
      cell(r.detail),
    ].join(","),
  );
  return [head, ...lines].join("\n");
}

export type AlertKind = "failed" | "stalled";

export interface AlertCheckResult {
  checked: number;
  flagged: number;
  notified: number;
  skippedAlreadyNotified: number;
  stallMinutes: number;
  recipients: string[];
  alerts: Array<{ agentName: string; weekStart: string; kind: AlertKind }>;
}
