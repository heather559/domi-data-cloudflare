import { fetchMarketproofDataset } from './marketproofClient';
import { weeklyContractStatsResponseSchema, type WeeklyContractStatsResponse } from './schemas';

/** Request params for weekly-contract-stats, per STEP 2/4(c)/4b/1.8(3) of the spec. */
export interface WeeklyContractStatsParams {
  q: string;
  /**
   * Anchors the returned series to end on this date instead of "now" --
   * needed for backfill (a historical week's own live run would never pass
   * this, since it always wants the series ending today). Not exercised
   * against a real response in this pass (no working MARKETPROOF_API_KEY
   * available) -- modeled defensively on the same `end_date` pattern
   * already CONFIRMED for luxury-contract-stats (STEP 1.6/1.7/4(d)), per
   * the task brief's own note that Marketproof's endpoints "support
   * historical date ranges/end_date params" generally. Confirm against a
   * real call before trusting this for backfill in production.
   */
  end_date?: string;
}

/**
 * weekly-contract-stats -- the borough/type/neighborhood weekly contract
 * series (market_pulse, type_trends, per-neighborhood wk_contracts/wk_volume,
 * and the price-banded tier_series median/ppsf/dom pulls). One retry on
 * failure, then `null`.
 */
export async function fetchWeeklyContractStats(
  params: WeeklyContractStatsParams,
): Promise<WeeklyContractStatsResponse | null> {
  return fetchMarketproofDataset('weekly-contract-stats', params, weeklyContractStatsResponseSchema);
}
