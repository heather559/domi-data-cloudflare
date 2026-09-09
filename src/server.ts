import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { requestCtxStorage } from "./lib/request-ctx";


// Answer-engine retrieval agents. These fetch a page live, in response to a
// real person's question, and cite the source back to them. They are the AEO
// channel and must never be blocked. Checked before the block list, since some
// of these share a vendor with a training crawler.
const ALLOWED_AI_USER_AGENTS = [
  "chatgpt-user",
  "oai-searchbot",
  "claudebot",
  "claude-searchbot",
  "claude-user",
  "perplexitybot",
  "perplexity-user",
  "google-extended",
  "applebot-extended",
  "bingbot",
];

// Bulk training-corpus and scraping crawlers. These take the whole corpus and
// return nothing. Blocked outright.
const BLOCKED_BOT_USER_AGENTS = [
  "gptbot",
  "ccbot",
  "anthropic-ai",
  "claude-web",
  "bytespider",
  "amazonbot",
  "meta-externalagent",
  "diffbot",
  "omgili",
  "omgilibot",
  "youbot",
  "cohere-ai",
  "timpibot",
  "imagesiftbot",
];

function isBlockedBot(request: Request): boolean {
  const ua = request.headers.get("user-agent")?.toLowerCase() ?? "";
  if (!ua) return false;
  if (ALLOWED_AI_USER_AGENTS.some((needle) => ua.includes(needle))) return false;
  return BLOCKED_BOT_USER_AGENTS.some((needle) => ua.includes(needle));
}


type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    if (isBlockedBot(request)) {
      return new Response(
        "Automated access to this content is restricted. For licensing or data inquiries, contact hdomi@heatherdomi.com.",
        { status: 403, headers: { "content-type": "text/plain; charset=utf-8" } },
      );
    }
    try {
      const handler = await getServerEntry();
      const waitUntil =
        ctx && typeof (ctx as { waitUntil?: unknown }).waitUntil === "function"
          ? (p: Promise<unknown>) => (ctx as { waitUntil: (p: Promise<unknown>) => void }).waitUntil(p)
          : undefined;
      const response = await requestCtxStorage.run({ waitUntil }, () =>
        handler.fetch(request, env, ctx),
      );
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
