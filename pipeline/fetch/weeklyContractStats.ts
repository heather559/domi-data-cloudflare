import { fetchMarketproofDataset } from './marketproofClient';
import { weeklyContractStatsResponseSchema, type WeeklyContractStatsResponse } from './schemas';

/** Request params for weekly-contract-stats, per STEP 2/4(c)/4b/1.8(3) of the spec. */
export interface WeeklyContractStatsParams {
  q: string;
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
