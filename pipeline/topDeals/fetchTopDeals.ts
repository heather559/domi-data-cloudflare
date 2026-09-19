import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { topDealSchema, type TopDeal } from '../schema/weeklyReportPayload';

/**
 * STEP 6 (top_deals) -- the ONE deliberately non-deterministic piece of this
 * pipeline, and it must stay narrow.
 *
 * Every other module in this pipeline is plain, zero-AI TypeScript calling
 * Marketproof's REST API directly. top_deals is the one exception: named
 * addresses + prices for individual signed contracts is record-level detail
 * that Marketproof's REST API does not expose (confirmed by direct testing --
 * every REST dataset only ever returns aggregate counts/sums/percentiles,
 * never an address). Marketproof's own documentation says record-level
 * search lives behind their MCP connector instead.
 *
 * The approach: a single call to Anthropic's Messages API (NOT an
 * interactive Claude Code session, NOT a general reasoning task) with
 * Marketproof's remote MCP server attached via the MCP connector
 * (`mcp_servers` + `tools: [{type: "mcp_toolset", ...}]`, beta
 * `mcp-client-2025-11-20`). Anthropic connects to and calls the MCP server
 * SERVER-SIDE -- the tool calls and their results come back as
 * `mcp_tool_use`/`mcp_tool_result` content blocks inside the SAME response,
 * no client-side tool-execution loop needed (this is a "server tool" in that
 * sense, like web_search). The only client-side loop this code handles is
 * `stop_reason === "pause_turn"`, which the API can return if the model's
 * own server-side tool-calling sub-loop hits its internal round-trip limit
 * before finishing -- resuming is just resending the conversation so far,
 * per Anthropic's documented pattern for resumable server-tool turns.
 *
 * Determinism note: the spec asks for "temperature 0 (or as close to fully
 * deterministic as the API allows)". Current-generation models (including
 * claude-opus-5, used here) reject an explicit `temperature` parameter
 * outright (400) -- sampling controls were removed for this model
 * generation. There is no way to force temperature=0 on this model as of
 * this writing. What this code does instead, as the practical equivalent:
 * a narrow, single-purpose prompt with an explicit output-shape contract,
 * no open-ended instructions, and a hard validation gate (below) that
 * rejects anything that doesn't parse -- so drift shows up as a loud
 * failure, not a silently-accepted bad value.
 *
 * CONFIRMED FINDING (2026-09-19, live test against real Anthropic +
 * Marketproof endpoints): the MCP connector request itself is wired up
 * correctly (correct beta header, correct mcp_servers/mcp_toolset shape --
 * Anthropic's API accepted the request and attempted to reach the server),
 * but Marketproof's MCP server at mcp.marketproof.com REJECTS
 * MARKETPROOF_API_KEY as the `authorization_token`:
 *
 *   400 invalid_request_error: "mcp_servers[0] 'marketproof': Authentication
 *   error while communicating with MCP server. Please check your
 *   authorization token."
 *
 * Confirmed independently with three direct `curl` probes against
 * https://mcp.marketproof.com/tools (no auth header, `x-api-key`, and
 * `Authorization: Bearer <MARKETPROOF_API_KEY>`) -- all three get HTTP 401.
 * The server's `WWW-Authenticate` header and its
 * `/.well-known/oauth-protected-resource` metadata
 * (`{"resource":"https://mcp.marketproof.com/tools","authorization_servers":
 * ["https://mcp.marketproof.com"],"bearer_methods_supported":["header"],
 * "scopes_supported":["mcp"]}`) confirm this is a real OAuth 2.0 protected
 * resource (RFC 9728) -- it wants a genuine OAuth access token minted by
 * that authorization server, NOT the static REST `x-api-key` value. The
 * REST API and the MCP server are two independently-authenticated surfaces
 * of the same Marketproof account, not two views of the same credential.
 *
 * This is very likely why the `mcp__claude_ai_Marketproof_MCP__*` tools work
 * inside an interactive claude.ai session for this account already -- that
 * flow went through Marketproof's OAuth consent screen once, tied to a
 * claude.ai-managed session. A deployed Railway service can't reuse that;
 * it would need its own one-time OAuth authorization against
 * `https://mcp.marketproof.com`, and a place to store/refresh the resulting
 * token as a secret distinct from `MARKETPROOF_API_KEY`.
 *
 * Per this task's own instructions, this is a "stop and report, don't fake
 * a workaround" finding, not something to silently paper over: this
 * function IS correctly wired end-to-end and DOES fail safely (catches the
 * error, logs it clearly, returns `[]` rather than throwing or fabricating
 * data) -- but it cannot yet fetch a real top_deals list until someone
 * completes Marketproof's OAuth flow and supplies a real MCP access token.
 * A `[]` result from this function today is NOT evidence of "no qualifying
 * deals this week" -- check the logs for this exact error before trusting
 * an empty result as a real business signal.
 */

const MARKETPROOF_MCP_URL = 'https://mcp.marketproof.com/tools';
const MCP_SERVER_NAME = 'marketproof';
const MODEL = 'claude-opus-5';
const MAX_TOKENS = 4096;
const MAX_PAUSE_TURN_CONTINUATIONS = 5;

const topDealsArraySchema = z.array(topDealSchema);

let cachedClient: Anthropic | undefined;

function getAnthropicClient(): Anthropic {
  if (cachedClient) return cachedClient;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Missing ANTHROPIC_API_KEY environment variable. Set it on the Railway service (or export it locally) before calling fetchTopDeals.',
    );
  }

  cachedClient = new Anthropic({ apiKey });
  return cachedClient;
}

function buildSystemPrompt(): string {
  return [
    'You find real, named, in-contract residential deals in Manhattan for a specific week, using ONLY the marketproof tool results available to you in this conversation.',
    '',
    'Rules, no exceptions:',
    '- Use ONLY data returned by the marketproof tool calls. Never use your own general knowledge of NYC real estate, and never invent, estimate, or guess an address, price, or any other field.',
    '- If a field is genuinely unavailable in the tool results for a qualifying deal, set it to null. Do not omit the key and do not guess a plausible-looking value.',
    '- If you cannot find any qualifying deals at all, return an empty array: [].',
    '- Your FINAL reply must be ONLY a raw JSON array -- no markdown code fences, no prose before or after, no explanation. Nothing but the JSON array.',
    '- Each element of the array must be an object with exactly these keys: address, price, neighborhood, sf, ppsf, dom, property_type.',
    '  - address: string. Real, title-cased street address plus unit if known (e.g. "760 Madison Avenue, Apt 9"). No anonymization.',
    '  - price: number. The contract price in dollars.',
    '  - neighborhood: string, lowercase (e.g. "upper east side").',
    '  - sf: number or null. Square footage if known, else null.',
    '  - ppsf: number or null. Price per square foot if known, else null (null whenever sf is null or 0).',
    '  - dom: number or null. Days on market if known, else null.',
    '  - property_type: one of "condo", "co-op", "townhouse", or null if it cannot be determined.',
    '- Return at most 5 entries, sorted by price descending.',
  ].join('\n');
}

function buildUserPrompt(weekStart: string, weekEnd: string, luxuryCutoff: number): string {
  return [
    `Find the top 5 highest-priced Manhattan residential contracts signed between ${weekStart} and ${weekEnd} (inclusive), with a price at or above $${luxuryCutoff}.`,
    'Use the marketproof tool to search for contracts/activities in Manhattan within that exact date range, filtered to that price floor or above.',
    'When you have the qualifying deals (or have confirmed there are none), reply with ONLY the JSON array described in your instructions -- nothing else.',
  ].join('\n');
}

function extractFinalText(message: Anthropic.Beta.Messages.BetaMessage): string {
  return message.content
    .filter((block): block is Anthropic.Beta.Messages.BetaTextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();
}

/** Strips a ```json ... ``` (or bare ```) fence if the model wrapped its JSON in one despite instructions not to. */
function stripCodeFence(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fenced ? fenced[1].trim() : text;
}

/**
 * Calls Anthropic's Messages API with Marketproof's MCP server attached and
 * returns the raw final BetaMessage once the turn reaches `end_turn`,
 * transparently resuming through any `pause_turn` (the server's own
 * tool-calling sub-loop hit its internal round-trip limit but wasn't done).
 */
async function runMcpRequest(
  client: Anthropic,
  systemPrompt: string,
  userPrompt: string,
  marketproofApiKey: string,
): Promise<Anthropic.Beta.Messages.BetaMessage> {
  let messages: Anthropic.Beta.Messages.BetaMessageParam[] = [{ role: 'user', content: userPrompt }];

  for (let attempt = 0; attempt <= MAX_PAUSE_TURN_CONTINUATIONS; attempt++) {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages,
      betas: ['mcp-client-2025-11-20'],
      mcp_servers: [
        {
          type: 'url',
          url: MARKETPROOF_MCP_URL,
          name: MCP_SERVER_NAME,
          authorization_token: marketproofApiKey,
        },
      ],
      tools: [{ type: 'mcp_toolset', mcp_server_name: MCP_SERVER_NAME }],
    });

    if (response.stop_reason === 'pause_turn') {
      // Per Anthropic's documented server-tool resume pattern: resend the
      // conversation so far (including the paused assistant turn) rather
      // than injecting a "continue" message -- the API detects the trailing
      // server-tool-use block and resumes automatically.
      messages = [...messages, { role: 'assistant', content: response.content }];
      continue;
    }

    return response;
  }

  throw new Error(
    `fetchTopDeals: exceeded ${MAX_PAUSE_TURN_CONTINUATIONS} pause_turn continuations without reaching end_turn`,
  );
}

/**
 * Fetches this week's top luxury deals via the Anthropic + Marketproof MCP
 * hybrid described above. Never throws for a normal failure mode (missing
 * key, MCP/API error, bad JSON, schema validation failure) -- every one of
 * those logs clearly and returns `[]`, matching the rest of this pipeline's
 * "never fabricate, empty array on failure" convention. It DOES throw if
 * ANTHROPIC_API_KEY itself is missing (a config error, not a data failure --
 * same convention as io/supabase.ts's getSupabaseClient()).
 */
export async function fetchTopDeals(weekStart: string, weekEnd: string, luxuryCutoff: number): Promise<TopDeal[]> {
  const marketproofApiKey = process.env.MARKETPROOF_API_KEY;
  if (!marketproofApiKey) {
    console.error('[fetchTopDeals] Missing MARKETPROOF_API_KEY -- cannot attach the Marketproof MCP server. Returning [].');
    return [];
  }

  const client = getAnthropicClient();
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(weekStart, weekEnd, luxuryCutoff);

  let finalMessage: Anthropic.Beta.Messages.BetaMessage;
  try {
    finalMessage = await runMcpRequest(client, systemPrompt, userPrompt, marketproofApiKey);
  } catch (err) {
    console.error(`[fetchTopDeals] Anthropic/MCP request failed: ${err instanceof Error ? err.message : String(err)} -- returning [].`);
    return [];
  }

  if (finalMessage.stop_reason === 'refusal') {
    console.error('[fetchTopDeals] model refused the request -- returning [].');
    return [];
  }

  if (finalMessage.stop_reason !== 'end_turn') {
    console.error(`[fetchTopDeals] unexpected stop_reason "${finalMessage.stop_reason}" -- returning [].`);
    return [];
  }

  const rawText = extractFinalText(finalMessage);
  const jsonText = stripCodeFence(rawText);

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(jsonText);
  } catch {
    console.error(`[fetchTopDeals] model's final reply was not valid JSON -- returning []. Raw reply (truncated): ${rawText.slice(0, 500)}`);
    return [];
  }

  const validated = topDealsArraySchema.safeParse(parsedJson);
  if (!validated.success) {
    console.error(
      `[fetchTopDeals] model's response failed schema validation -- returning []. Issues: ${JSON.stringify(validated.error.issues)}`,
    );
    return [];
  }

  if (validated.data.length > 5) {
    console.error(`[fetchTopDeals] model returned ${validated.data.length} deals (more than the max 5) -- truncating to top 5 by price.`);
  }

  return [...validated.data].sort((a, b) => b.price - a.price).slice(0, 5);
}
