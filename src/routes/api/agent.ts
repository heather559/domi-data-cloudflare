import { createFileRoute } from "@tanstack/react-router";
import { streamText, stepCountIs, type ModelMessage } from "ai";
import { z } from "zod";
import { createAiProvider } from "@/lib/ai-gateway.server";
import { buildAgentTools, type LeadCaptureSignal } from "@/lib/agent-tools.server";
import { buildSystemPrompt } from "@/lib/agent-prompt";
import { verifyTurnstileToken } from "@/lib/turnstile.server";
import {
  checkIpRateLimit,
  checkGlobalDailyBudget,
  recordUsage,
  getSessionTokenCap,
} from "@/lib/agent-rate-limit.server";
import {
  loadOrCreateSession,
  appendTurnAndSave,
  appendPostHandoffReply,
  markSessionClosed,
} from "@/lib/agent-session.server";

const MAX_POST_HANDOFF_REPLIES = 2;

const IDLE_MESSAGE =
  "This conversation timed out. Start a new one anytime, or reach Heather's team at hdomi@heatherdomi.com or (917) 267-8012.";
const HANDOFF_MESSAGE =
  "We'd love to help you with your search. Please complete the form below and a member of our team will be in touch shortly. You can also reach us directly at hdomi@heatherdomi.com or (917) 267-8012.";

const ALLOWED_ORIGINS = (
  process.env.SITE_ORIGINS ?? "https://heather559-domi-data.heather-aa9.workers.dev,https://domidata.heatherdomi.com"
)
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const requestSchema = z.object({
  session_id: z.string().uuid(),
  message: z.string().trim().min(1).max(2000),
  turnstile_token: z.string().min(1),
});

function getIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    return { "Access-Control-Allow-Origin": origin, Vary: "Origin" };
  }
  return {};
}

function isForbiddenOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return !!origin && !ALLOWED_ORIGINS.includes(origin);
}

function jsonError(status: number, error: string, extraHeaders: Record<string, string> = {}) {
  return Response.json({ error }, { status, headers: extraHeaders });
}

function closedResponse(
  message: string,
  state: string,
  cors: Record<string, string>,
  leadSignal?: LeadCaptureSignal,
) {
  const headers = new Headers(cors);
  headers.set("Content-Type", "text/plain; charset=utf-8");
  headers.set("X-Agent-Session-State", state);
  const body = leadSignal
    ? `${message}\n<<<LEAD_CAPTURE>>>${JSON.stringify(leadSignal)}\n`
    : message;
  return new Response(body, { status: 200, headers });
}

export const Route = createFileRoute("/api/agent")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => {
        const headers = new Headers(corsHeaders(request));
        headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
        headers.set("Access-Control-Allow-Headers", "Content-Type");
        return new Response(null, { status: 204, headers });
      },
      POST: async ({ request }) => {
        const cors = corsHeaders(request);

        if (isForbiddenOrigin(request)) return jsonError(403, "forbidden_origin", cors);

        if (!process.env.ANTHROPIC_API_KEY) {
          console.error("[api/agent] missing ANTHROPIC_API_KEY");
          return jsonError(500, "server_error", cors);
        }

        let rawBody: unknown;
        try {
          rawBody = await request.json();
        } catch {
          return jsonError(400, "invalid_json", cors);
        }

        const parsed = requestSchema.safeParse(rawBody);
        if (!parsed.success) return jsonError(400, "invalid_input", cors);
        const { session_id, message, turnstile_token } = parsed.data;

        const ip = getIp(request);

        const turnstileOk = await verifyTurnstileToken(turnstile_token, ip);
        if (!turnstileOk) return jsonError(403, "bot_check_failed", cors);

        const rateLimit = await checkIpRateLimit(ip);
        if (!rateLimit.allowed) return jsonError(429, "rate_limited", cors);

        const withinBudget = await checkGlobalDailyBudget();
        if (!withinBudget) return jsonError(503, "budget_exceeded", cors);

        let session;
        try {
          session = await loadOrCreateSession(session_id, ip);
        } catch {
          return jsonError(500, "server_error", cors);
        }

        if (session.closed && session.closedReason === "idle") {
          return closedResponse(IDLE_MESSAGE, "closed_idle", cors);
        }
        const postHandoffMode = session.closed && session.closedReason === "handoff";
        if (postHandoffMode && session.postHandoffReplies >= MAX_POST_HANDOFF_REPLIES) {
          return closedResponse(HANDOFF_MESSAGE, "closed_handoff", cors, {
            tier: "hard",
            reason: "Returning to a session already handed off to Heather's team.",
          });
        }

        const tokenCap = getSessionTokenCap();
        // IMPORTANT: do NOT block this message before the model sees it. If the session
        // already started this turn at/over the cap, let the model answer the user's
        // actual question first, then force a real handoff (lead-capture form) once the
        // answer is done, instead of serving a canned reply that skips the question.
        const willHandoffThisTurn = !postHandoffMode && session.tokenTotal >= tokenCap;

        const newTurnCount = session.turnCount + 1;

        const provider = createAiProvider();
        const model = provider("claude-haiku-4-5-20251001");

        const modelMessages: ModelMessage[] = [
          ...session.history.map((m) => ({ role: m.role, content: m.content }) as ModelMessage),
          { role: "user", content: message } as ModelMessage,
        ];

        const leadSignal: { value: LeadCaptureSignal | null } = { value: null };
        const dataPullState = { count: session.dataPullCount };

        try {
          const result = streamText({
            model,
            system: buildSystemPrompt({ postHandoff: postHandoffMode }),
            messages: modelMessages,
            tools: postHandoffMode ? undefined : buildAgentTools(ip, session_id, leadSignal, dataPullState),
            stopWhen: stepCountIs(postHandoffMode ? 1 : 6),
            onFinish: async ({ text, usage }) => {
              const u = usage as
                | { totalTokens?: number; inputTokens?: number; outputTokens?: number }
                | undefined;
              const totalTokens =
                u?.totalTokens ?? (u?.inputTokens ?? 0) + (u?.outputTokens ?? 0);
              const newTokenTotal = session.tokenTotal + totalTokens;
              if (postHandoffMode) {
                await appendPostHandoffReply(
                  session_id,
                  session.history,
                  message,
                  text,
                  newTurnCount,
                  newTokenTotal,
                  session.postHandoffReplies + 1,
                );
                await recordUsage(totalTokens);
                return;
              }
              const overCap = newTokenTotal >= tokenCap;
              const shouldClose = willHandoffThisTurn || overCap;
              await appendTurnAndSave(
                session_id,
                session.history,
                message,
                text,
                newTurnCount,
                totalTokens,
                newTokenTotal,
                dataPullState.count,
                shouldClose,
              );
              await recordUsage(totalTokens);
            },
            onError: ({ error }) => {
              console.error("[api/agent] stream error", error);
            },
          });

          const encoder = new TextEncoder();
          const upstream = result.textStream;

          const stream = new ReadableStream<Uint8Array>({
            async start(controller) {
              try {
                for await (const chunk of upstream) {
                  controller.enqueue(encoder.encode(chunk));
                }
                if (willHandoffThisTurn && !leadSignal.value) {
                  leadSignal.value = {
                    tier: "hard",
                    reason: "This conversation has covered a lot; time to bring in Heather's team.",
                  };
                }
                if (postHandoffMode && !leadSignal.value) {
                  leadSignal.value = {
                    tier: "soft",
                    reason: "Following up after being connected with Heather's team. Happy to keep answering directly-related questions.",
                  };
                }
                if (leadSignal.value) {
                  controller.enqueue(
                    encoder.encode(
                      `\n<<<LEAD_CAPTURE>>>${JSON.stringify(leadSignal.value)}\n`,
                    ),
                  );
                }
              } catch (err) {
                console.error("[api/agent] stream pipe failed", err);
              } finally {
                controller.close();
              }
            },
          });

          const headers = new Headers(cors);
          headers.set("Content-Type", "text/plain; charset=utf-8");
          headers.set("Cache-Control", "no-store");
          headers.set("X-Agent-Session-State", postHandoffMode ? "handoff_grace" : "open");
          return new Response(stream, { status: 200, headers });
        } catch (error) {
          console.error("[api/agent] streamText failed", error);
          return jsonError(500, "server_error", cors);
        }
      },
    },
  },
});
