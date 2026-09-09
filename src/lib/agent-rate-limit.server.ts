import { supabaseAdmin } from "@/integrations/supabase/client.server";

type RpcRow = { allowed: boolean; current_count: number };

async function hit(key: string, windowSeconds: number, limit: number): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc("agent_rate_limit_hit", {
    p_key: key,
    p_window_seconds: windowSeconds,
    p_limit: limit,
  });
  if (error || !data || !data.length) {
    console.error("[agent-rate-limit] rpc failed, failing closed", error);
    return false;
  }
  return (data[0] as RpcRow).allowed;
}

export async function checkIpRateLimit(
  ip: string,
): Promise<{ allowed: boolean; reason?: "minute" | "day" }> {
  if (process.env.AGENT_SKIP_RATE_LIMIT === "true") return { allowed: true };
  const perMinute = Number(process.env.AGENT_IP_PER_MINUTE_CAP ?? 10);
  const perDay = Number(process.env.AGENT_IP_DAILY_CAP ?? 40);

  if (!(await hit(`ip:${ip}:min`, 60, perMinute))) return { allowed: false, reason: "minute" };
  if (!(await hit(`ip:${ip}:day`, 86_400, perDay))) return { allowed: false, reason: "day" };
  return { allowed: true };
}

export async function checkGlobalDailyBudget(): Promise<boolean> {
  if (process.env.AGENT_SKIP_RATE_LIMIT === "true") return true;
  const budget = Number(process.env.AGENT_GLOBAL_DAILY_TOKEN_BUDGET ?? 2_000_000);
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabaseAdmin
    .from("agent_usage_daily")
    .select("total_tokens")
    .eq("day", today)
    .maybeSingle();
  if (error) {
    console.error("[agent-rate-limit] usage read failed, failing closed", error);
    return false;
  }
  const used = data?.total_tokens ?? 0;
  return used < budget;
}

export async function recordUsage(tokens: number): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const { error } = await supabaseAdmin.rpc("agent_usage_increment", {
    p_day: today,
    p_tokens: tokens,
  });
  if (error) console.error("[agent-rate-limit] usage increment failed", error);
}

// Raised 2026-07-26 from 20,000 after measuring real production sessions: a single
// legitimate 2-neighborhood-lookup turn hit 47,775 tokens (client_session_id
// 1742d374-31f5-4131-837c-fc9321ccc75c, 2026-07-24), more than double the old cap,
// because the AI SDK's multi-step tool loop resends the full running context
// (system prompt + tool schemas: ~2,879 tokens) plus every prior tool result at
// EVERY step of a turn. The get_neighborhood_report trim above cuts per-call
// payload 62% (1,943 -> 738 measured tokens), but even a full 6-call session
// (the max AGENT_SESSION_DATA_PULL_CAP allows) can still legitimately need
// headroom beyond 20,000 once that compounding is accounted for. 60,000 gives a
// real max-tool-call conversation room to finish, while staying at just 3% of the
// 2,000,000/day global budget (worst observed real day so far: 170,752 tokens,
// 8.5% of budget) — cost impact of the raise is negligible.
export function getSessionTokenCap(): number {
  return Number(process.env.AGENT_SESSION_TOKEN_CAP ?? 60000);
}
