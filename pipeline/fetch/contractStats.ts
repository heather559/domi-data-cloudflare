import { fetchMarketproofDataset } from './marketproofClient';
import { contractStatsResponseSchema, type ContractStatsResponse } from './schemas';

/**
 * Request params for the base contract-stats dataset. The ground-truth spec
 * never calls this dataset directly (it always uses the weekly-/luxury-
 * prefixed variants), but it's one of the endpoints already confirmed
 * working with real data (per the task brief), and Marketproof's own
 * {base, weekly-, monthly-} naming pattern strongly implies this is the
 * plain aggregate-over-the-query-window sibling of weekly-contract-stats
 * (no time bucketing) -- same `q` filter param as its siblings.
 */
export interface ContractStatsParams {
  q: string;
}

/**
 * contract-stats -- aggregate (non-time-bucketed) contract stats for a
 * `q` filter. One retry on failure, then `null`. See schemas.ts for the
 * provenance caveat on this endpoint's response shape (least textually
 * confirmed of the endpoints built in this pass, alongside `supply`) --
 * contractStats.test.ts is what actually proves the real shape.
 */
export async function fetchContractStats(params: ContractStatsParams): Promise<ContractStatsResponse | null> {
  return fetchMarketproofDataset('contract-stats', params, contractStatsResponseSchema);
}
