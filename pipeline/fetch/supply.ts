import { fetchMarketproofDataset } from './marketproofClient';
import { supplyResponseSchema, type SupplyResponse } from './schemas';

/** Request params for supply, per STEP 5 of the spec (three calls: all/luxury/prime). */
export interface SupplyParams {
  granularity: 'weekly' | string;
  borough: string;
  min_price?: number;
  /** Pinned for backfill, omitted on live "current week" calls -- see the identical note on WeeklyContractStatsParams.end_date. */
  end_date?: string;
}

/**
 * supply -- active-listing feed (STEP 5). One retry on failure, then `null`.
 * Response shape confirmed 2026-09-19 against a real call -- see schemas.ts
 * for the exact fields (top-level `series: [{date, supply}]` is the one
 * STEP 5 actually reads; the per-property-type breakdown is incidental).
 */
export async function fetchSupply(params: SupplyParams): Promise<SupplyResponse | null> {
  return fetchMarketproofDataset('supply', params, supplyResponseSchema);
}
