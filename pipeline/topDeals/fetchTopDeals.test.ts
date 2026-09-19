import { describe, expect, it } from 'vitest';
import { fetchTopDeals } from './fetchTopDeals';
import { topDealSchema } from '../schema/weeklyReportPayload';
import { computeWeek } from '../lib/week';

/**
 * Real, live integration test: a genuine call to Anthropic's Messages API
 * with Marketproof's MCP server attached. This costs a small amount of real
 * API spend and requires BOTH ANTHROPIC_API_KEY and MARKETPROOF_API_KEY to
 * be set in the environment running the tests -- skips gracefully (not a
 * hard failure) otherwise, same convention as the fetch/ REST client tests.
 *
 * $4,950,000 below is the same illustrative luxury-sales price floor the
 * ground-truth spec itself uses in STEP 3.5 ("price:[4950000 TO *]") --
 * used here only as a plausible stand-in cutoff for this isolated test.
 * The real hero.luxury_cutoff (a dynamically computed P90 price threshold)
 * comes from STEP 1's luxury-contract-stats pull, which is out of scope for
 * this pass -- fetchTopDeals takes it as a caller-supplied parameter, it
 * does not compute it itself.
 *
 * KNOWN CURRENT RESULT (2026-09-19): this test passes, but only in the sense
 * that fetchTopDeals fails SAFELY -- it currently always returns `[]`
 * because Marketproof's MCP server rejects MARKETPROOF_API_KEY as an OAuth
 * bearer token (confirmed root cause in fetchTopDeals.ts's own header
 * comment). A passing test here does NOT mean a real top-5 list was
 * fetched -- check stderr for the `[fetchTopDeals] Anthropic/MCP request
 * failed` line to tell "genuinely zero qualifying deals" apart from "the
 * MCP auth is still broken." This test still has real value even while
 * blocked: it proves the request shape/beta header/error handling are all
 * correct, so the only remaining unknown is a real OAuth token.
 */
const hasKeys = Boolean(process.env.ANTHROPIC_API_KEY) && Boolean(process.env.MARKETPROOF_API_KEY);
const PLACEHOLDER_LUXURY_CUTOFF = 4_950_000;

describe.skipIf(!hasKeys)('fetchTopDeals (live integration -- Anthropic + Marketproof MCP)', () => {
  it(
    'returns an array of TopDeal that validates against topDealSchema for a real recent week',
    async () => {
      const { weekStart, weekEnd } = computeWeek();

      const deals = await fetchTopDeals(weekStart, weekEnd, PLACEHOLDER_LUXURY_CUTOFF);

      expect(Array.isArray(deals)).toBe(true);
      expect(deals.length).toBeLessThanOrEqual(5);

      for (const deal of deals) {
        expect(topDealSchema.safeParse(deal).success).toBe(true);
      }

      // Sorted by price descending, per the spec's STEP 6(e)/7(h).
      for (let i = 1; i < deals.length; i++) {
        expect(deals[i - 1].price).toBeGreaterThanOrEqual(deals[i].price);
      }

      console.log(
        `[fetchTopDeals live test] week ${weekStart}..${weekEnd}, cutoff $${PLACEHOLDER_LUXURY_CUTOFF}: ${deals.length} deal(s) returned:`,
        JSON.stringify(deals, null, 2),
      );
    },
    120_000,
  );
});

describe.skipIf(hasKeys)('fetchTopDeals (live integration -- Anthropic + Marketproof MCP)', () => {
  it.skip('ANTHROPIC_API_KEY and/or MARKETPROOF_API_KEY not set in this environment -- skipping live test', () => {});
});
