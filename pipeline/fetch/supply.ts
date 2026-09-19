import { fetchMarketproofDataset } from './marketproofClient';
import { supplyResponseSchema, type SupplyResponse } from './schemas';

/** Request params for supply, per STEP 5 of the spec (three calls: all/luxury/prime). */
export interface SupplyParams {
  granularity: 'weekly' | string;
  borough: string;
  min_price?: number;
}

/**
 * supply -- active-listing/months-supply/absorption feed (STEP 5). One retry
 * on failure, then `null`. See schemas.ts for why the response schema here is
 * intentionally loose -- this is the least textually-confirmed endpoint of
 * the five built in this pass; a live call is what will reveal its real
 * field names before Phase 3's compute layer can rely on any of them.
 */
export async function fetchSupply(params: SupplyParams): Promise<SupplyResponse | null> {
  return fetchMarketproofDataset('supply', params, supplyResponseSchema);
}
