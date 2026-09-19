import { z } from 'zod';

/**
 * Shared low-level HTTP client for Marketproof's `hdomi` REST API.
 *
 * Base URL / auth pattern per the ground-truth spec
 * (docs/site-data-agent-FULL-PROMPT-2026-09-18.md): POST
 * https://api.marketproof.com/hdomi/{dataset}, header `x-api-key:
 * $MARKETPROOF_API_KEY`, `Content-Type: application/json`.
 *
 * Error-handling philosophy, copied verbatim from the spec's HARD RULE: "if a
 * Marketproof REST call fails after one retry, null the field(s) it feeds --
 * for arrays, use [] (not null, not an object). NEVER substitute Marketproof
 * MCP search_inventory/market_snapshot for a failed REST call." This client
 * implements exactly that: one retry, then `null` -- callers decide their own
 * null-vs-[] convention for the payload fields they're populating. It never
 * throws on a normal HTTP/network failure; it only throws for a missing API
 * key (a config error, not a data-fetch failure) and for a response that
 * fails its caller-supplied Zod schema (a "the API changed shape under us"
 * signal that should be loud, not silently swallowed as if it were just
 * another retryable transient failure).
 */

const BASE_URL = 'https://api.marketproof.com/hdomi';
const RETRY_DELAY_MS = 2000;

export class MarketproofSchemaError extends Error {
  constructor(dataset: string, issues: string) {
    super(`Marketproof ${dataset} response failed schema validation: ${issues}`);
    this.name = 'MarketproofSchemaError';
  }
}

function getApiKey(): string {
  const key = process.env.MARKETPROOF_API_KEY;
  if (!key) {
    throw new Error(
      'Missing MARKETPROOF_API_KEY environment variable. Set it on the Railway service (or export it locally) before calling Marketproof.',
    );
  }
  return key;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postOnce(
  dataset: string,
  body: unknown,
  apiKey: string,
  query?: string,
): Promise<{ ok: true; json: unknown } | { ok: false; error: string }> {
  try {
    const url = `${BASE_URL}/${dataset}${query ? `?${query}` : ''}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return { ok: false, error: `HTTP ${response.status}${text ? `: ${text.slice(0, 500)}` : ''}` };
    }

    const json = await response.json();
    return { ok: true, json };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * POSTs to a Marketproof `hdomi` dataset endpoint, retrying exactly once on
 * failure (network error or non-2xx), then returning `null` -- never
 * fabricating, never substituting a different endpoint.
 *
 * `schema` validates the *shape* of a successful response. A response that
 * arrives with HTTP 200 but doesn't match the schema is NOT treated the same
 * as a network/HTTP failure (no silent retry-then-null) -- it throws
 * `MarketproofSchemaError` immediately, because that's a sign this client's
 * understanding of the API shape is wrong and needs a human to look, not a
 * transient condition a retry would fix.
 */
export async function fetchMarketproofDataset<T>(
  dataset: string,
  body: unknown,
  // Third type param (Input) is deliberately `any`, not `T`: several of our
  // response schemas use `.default(...)` internally, which makes the
  // schema's parsed Input type diverge from its Output type (`T`). Pinning
  // Input to `T` here would reject exactly those schemas at the call site.
  schema: z.ZodType<T, z.ZodTypeDef, any>,
  query?: string,
): Promise<T | null> {
  const apiKey = getApiKey();

  let attempt = await postOnce(dataset, body, apiKey, query);
  if (!attempt.ok) {
    console.error(`[marketproof:${dataset}] attempt 1 failed: ${attempt.error} -- retrying once`);
    await sleep(RETRY_DELAY_MS);
    attempt = await postOnce(dataset, body, apiKey, query);
  }

  if (!attempt.ok) {
    console.error(`[marketproof:${dataset}] attempt 2 failed: ${attempt.error} -- giving up, returning null`);
    return null;
  }

  const parsed = schema.safeParse(attempt.json);
  if (!parsed.success) {
    throw new MarketproofSchemaError(dataset, JSON.stringify(parsed.error.issues));
  }

  return parsed.data;
}
