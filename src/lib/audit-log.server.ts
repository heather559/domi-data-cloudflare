import { createHash } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Audit log for server-side actions performed with the service_role key.
 *
 * The tables backing this app (lead_submissions, agent_sessions,
 * agent_lead_requests, agent_enumeration_log) are intentionally fail-closed:
 * no client can read or write them. Every mutation therefore comes through
 * server code holding the service_role key. This helper records who did what
 * so those actions remain traceable.
 *
 * Best-effort: audit failures never propagate. A missing audit row must not
 * take down the caller.
 */

export type AuditEntry = {
  actor:
    | "lead_api"
    | "agent_session"
    | "agent_tools"
    | "agent_rate_limit"
    | "archive_resnapshot"
    | "weekly_reconciliation";
  action: string;
  targetTable?: string;
  sessionId?: string | null;
  leadId?: string | null;
  rowCount?: number | null;
  outcome?: "ok" | "error";
  errorCode?: string | null;
  errorMessage?: string | null;
  ip?: string | null;
  meta?: Record<string, unknown> | null;
};

function hashIp(ip: string | null | undefined): string | null {
  if (!ip || ip === "unknown") return null;
  const salt = process.env.AUDIT_IP_SALT ?? process.env.SUPABASE_URL ?? "domi-data";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

function truncate(value: string | null | undefined, max = 500): string | null {
  if (!value) return null;
  return value.length > max ? value.slice(0, max) : value;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  const row = {
    actor: entry.actor,
    action: entry.action,
    target_table: entry.targetTable ?? null,
    session_id: entry.sessionId ?? null,
    lead_id: entry.leadId ?? null,
    row_count: entry.rowCount ?? null,
    outcome: entry.outcome ?? "ok",
    error_code: entry.errorCode ?? null,
    error_message: truncate(entry.errorMessage ?? null),
    ip_hash: hashIp(entry.ip ?? null),
    meta: entry.meta ?? null,
  };

  // Mirror to worker logs so events appear alongside runtime logs.
  console.log(
    `[audit] ${row.actor} ${row.action}` +
      (row.target_table ? ` table=${row.target_table}` : "") +
      (row.outcome !== "ok" ? ` outcome=${row.outcome}` : "") +
      (row.error_code ? ` err=${row.error_code}` : ""),
  );

  try {
    const { error } = await supabaseAdmin
      .from("service_audit_log")
      .insert(row as never);
    if (error) console.error("[audit] insert failed", error.message);
  } catch (err) {
    console.error("[audit] threw", err);
  }
}
