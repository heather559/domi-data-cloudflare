import { describe, expect, it } from 'vitest';
import { fetchContractStats } from './contractStats';
import { contractStatsResponseSchema } from './schemas';

/**
 * Real, read-only integration test against the live Marketproof API.
 * Skips gracefully (not a hard failure) when MARKETPROOF_API_KEY isn't set
 * in the environment running the tests -- so CI or a teammate without the
 * key doesn't get a spurious red build.
 */
const hasKey = Boolean(process.env.MARKETPROOF_API_KEY);

describe.skipIf(!hasKey)('fetchContractStats (live integration)', () => {
  it(
    'returns a response that parses against contractStatsResponseSchema',
    async () => {
      const result = await fetchContractStats({ q: 'borough:manhattan' });

      expect(result).not.toBeNull();

      const revalidated = contractStatsResponseSchema.safeParse(result);
      expect(revalidated.success).toBe(true);

      console.log('[contractStats live test] response keys:', result ? Object.keys(result) : null);
    },
    30_000,
  );
});

describe.skipIf(hasKey)('fetchContractStats (live integration)', () => {
  it.skip('MARKETPROOF_API_KEY not set in this environment -- skipping live test', () => {});
});
