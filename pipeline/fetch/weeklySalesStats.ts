import { fetchMarketproofDataset } from './marketproofClient';
import { weeklySalesStatsResponseSchema, type WeeklySalesStatsResponse } from './schemas';

/** Request params for weekly-sales-stats, per STEP 3/3.5 of the spec. */
export interface WeeklySalesStatsParams {
  q: string;
  /** Backfill-only historical anchor -- see the identical note on WeeklyContractStatsParams.end_date. */
  end_date?: string;
}

/**
 * weekly-sales-stats -- recorded-sale figures (ppsf/discount/dom/count) per
 * property type, and (STEP 3.5) a price-filtered pooled discount series for
 * the So-What engine's discount metric. One retry on failure, then `null`.
 *
 * UNCONFIRMED against live data -- see the provenance comment on
 * `weeklySalesStatsResponseSchema` in schemas.ts. Built this pass without a
 * working MARKETPROOF_API_KEY; confirm the schema against a real call
 * before trusting it in production.
 */
export async function fetchWeeklySalesStats(params: WeeklySalesStatsParams): Promise<WeeklySalesStatsResponse | null> {
  return fetchMarketproofDataset('weekly-sales-stats', params, weeklySalesStatsResponseSchema);
}
