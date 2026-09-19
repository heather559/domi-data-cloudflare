import { describe, expect, it } from 'vitest';
import { fetchNeighborhoodRank } from './neighborhoodRank';
import { neighborhoodRankResponseSchema } from './schemas';

/**
 * Real, read-only integration test against the live Marketproof API.
 * Skips gracefully (not a hard failure) when MARKETPROOF_API_KEY isn't set
 * in the environment running the tests.
 */
const hasKey = Boolean(process.env.MARKETPROOF_API_KEY);

describe.skipIf(!hasKey)('fetchNeighborhoodRank (live integration)', () => {
  it(
    'returns a neighborhoods[] response that parses against neighborhoodRankResponseSchema',
    async () => {
      // Exact params from STEP 4(a) of the spec (no min_price on this call).
      const result = await fetchNeighborhoodRank({
        borough: 'manhattan',
        window: 'trailing-52w',
        sort_by: 90,
        limit: 99,
        min_contracts: 0,
      });

      expect(result).not.toBeNull();
      expect(Array.isArray(result?.neighborhoods)).toBe(true);
      expect(result!.neighborhoods.length).toBeGreaterThan(0);

      const revalidated = neighborhoodRankResponseSchema.safeParse(result);
      expect(revalidated.success).toBe(true);

      console.log(
        '[neighborhoodRank live test] first neighborhood:',
        JSON.stringify(result?.neighborhoods[0]).slice(0, 500),
      );
    },
    30_000,
  );
});

describe.skipIf(hasKey)('fetchNeighborhoodRank (live integration)', () => {
  it.skip('MARKETPROOF_API_KEY not set in this environment -- skipping live test', () => {});
});
