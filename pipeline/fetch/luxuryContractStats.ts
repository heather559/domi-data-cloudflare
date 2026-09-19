import { fetchMarketproofDataset } from './marketproofClient';
import { luxuryContractStatsResponseSchema, type LuxuryContractStatsResponse } from './schemas';

/**
 * Request params for luxury-contract-stats, per STEP 1/1.5/1.6/1.7 of the
 * ground-truth spec. `end_date` anchors the trailing window to end on that
 * date instead of "now" (used for prior-year and quarterly-history pulls).
 */
export interface LuxuryContractStatsParams {
  q: string;
  granularity: 'weekly' | string;
  window: 'trailing-52w' | 'trailing-13w' | string;
  percentile: number[];
  history?: 'annual' | string;
  end_date?: string;
}

/**
 * luxury-contract-stats -- the P90/P95/P99 luxury/prime/trophy tier engine.
 * One retry on failure, then `null` (never a fabricated substitute) per the
 * spec's own HARD RULE.
 */
export async function fetchLuxuryContractStats(
  params: LuxuryContractStatsParams,
): Promise<LuxuryContractStatsResponse | null> {
  return fetchMarketproofDataset('luxury-contract-stats', params, luxuryContractStatsResponseSchema);
}
