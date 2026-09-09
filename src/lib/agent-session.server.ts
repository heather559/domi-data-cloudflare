import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logAudit } from "@/lib/audit-log.server";

export type StoredMessage = { role: "user" | "assistant"; content: string };

export type AgentSession = {
  clientSessionId: string;
  turnCount: number;
  closed: boolean;
  closedReason: "handoff" | "idle" | null;
  tokenTotal: number;
  dataPullCount: number;
  postHandoffReplies: number;
  history: StoredMessage[];
};

const MAX_STORED_MESSAGES = 12;
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export async function loadOrCreateSession(clientSessionId: string, ip: string): Promise<AgentSession> {
  const { data, error } = await supabaseAdmin
    .from("agent_sessions")
    .select("client_session_id, turn_count, closed, history, token_total, last_message_at, idle_closed_at, data_pull_count, post_handoff_replies")
    .eq("client_session_id", clientSessionId)
    .maybeSingle();

  if (error) {
    console.error("[agent-session] load failed", error);
    throw new Error("session_load_failed");
  }

  if (data) {
    const lastAt = data.last_message_at ? new Date(data.last_message_at).getTime() : 0;
    const isIdle = !data.closed && lastAt > 0 && Date.now() - lastAt > IDLE_TIMEOUT_MS;

    if (isIdle) {
      await supabaseAdmin
        .from("agent_sessions")
        .update({ closed: true, idle_closed_at: new Date().toISOString() })
        .eq("client_session_id", clientSessionId);
      return {
        clientSessionId: data.client_session_id,
        turnCount: data.turn_count,
        closed: true,
        closedReason: "idle",
        tokenTotal: Number(data.token_total ?? 0),
        dataPullCount: Number(data.data_pull_count ?? 0),
        postHandoffReplies: Number(data.post_handoff_replies ?? 0),
        history: Array.isArray(data.history) ? (data.history as StoredMessage[]) : [],
      };
    }

    return {
      clientSessionId: data.client_session_id,
      turnCount: data.turn_count,
      closed: data.closed,
      closedReason: data.closed ? (data.idle_closed_at ? "idle" : "handoff") : null,
      tokenTotal: Number(data.token_total ?? 0),
      dataPullCount: Number(data.data_pull_count ?? 0),
      postHandoffReplies: Number(data.post_handoff_replies ?? 0),
      history: Array.isArray(data.history) ? (data.history as StoredMessage[]) : [],
    };
  }

  const { error: insertError } = await supabaseAdmin.from("agent_sessions").insert({
    client_session_id: clientSessionId,
    ip,
    turn_count: 0,
    closed: false,
    history: [],
    token_total: 0,
  });
  if (insertError) {
    console.error("[agent-session] create failed", insertError);
    await logAudit({
      actor: "agent_session",
      action: "insert",
      targetTable: "agent_sessions",
      sessionId: clientSessionId,
      outcome: "error",
      errorCode: insertError.code ?? null,
      errorMessage: insertError.message,
      ip,
    });
    throw new Error("session_create_failed");
  }
  await logAudit({
    actor: "agent_session",
    action: "insert",
    targetTable: "agent_sessions",
    sessionId: clientSessionId,
    rowCount: 1,
    ip,
  });

  return {
    clientSessionId,
    turnCount: 0,
    closed: false,
    closedReason: null,
    tokenTotal: 0,
    dataPullCount: 0,
    postHandoffReplies: 0,
    history: [],
  };
}

export async function appendPostHandoffReply(
  clientSessionId: string,
  history: StoredMessage[],
  userMessage: string,
  assistantMessage: string,
  turnCount: number,
  newTokenTotal: number,
  newPostHandoffReplies: number,
): Promise<void> {
  const next = [
    ...history,
    { role: "user" as const, content: userMessage },
    { role: "assistant" as const, content: assistantMessage },
  ].slice(-MAX_STORED_MESSAGES);

  const { error } = await supabaseAdmin
    .from("agent_sessions")
    .update({
      history: next,
      turn_count: turnCount,
      token_total: newTokenTotal,
      post_handoff_replies: newPostHandoffReplies,
      last_message_at: new Date().toISOString(),
    })
    .eq("client_session_id", clientSessionId);

  if (error) console.error("[agent-session] post-handoff save failed", error);
}

export async function appendTurnAndSave(
  clientSessionId: string,
  history: StoredMessage[],
  userMessage: string,
  assistantMessage: string,
  turnCount: number,
  tokensUsed: number,
  newTokenTotal: number,
  newDataPullCount: number,
  closed: boolean,
): Promise<void> {
  const next = [
    ...history,
    { role: "user" as const, content: userMessage },
    { role: "assistant" as const, content: assistantMessage },
  ].slice(-MAX_STORED_MESSAGES);

  const { error } = await supabaseAdmin
    .from("agent_sessions")
    .update({
      history: next,
      turn_count: turnCount,
      closed,
      token_total: newTokenTotal,
      data_pull_count: newDataPullCount,
      last_message_at: new Date().toISOString(),
    })
    .eq("client_session_id", clientSessionId);

  if (error) console.error("[agent-session] save failed", error);
  void tokensUsed;
}

export async function markSessionClosed(clientSessionId: string, reason: "handoff" | "idle"): Promise<void> {
  const patch =
    reason === "idle"
      ? { closed: true, idle_closed_at: new Date().toISOString() }
      : { closed: true };
  const { error } = await supabaseAdmin
    .from("agent_sessions")
    .update(patch)
    .eq("client_session_id", clientSessionId);
  if (error) console.error("[agent-session] close failed", error);
  await logAudit({
    actor: "agent_session",
    action: "close",
    targetTable: "agent_sessions",
    sessionId: clientSessionId,
    outcome: error ? "error" : "ok",
    errorCode: error?.code ?? null,
    errorMessage: error?.message ?? null,
    meta: { reason },
  });
}
