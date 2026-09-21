import { fetchMarketproofDataset } from './marketproofClient';
import { weeklyContractStatsResponseSchema, type WeeklyContractStatsResponse } from './schemas';

/** Request params for weekly-contract-stats, per STEP 2/4(c)/4b/1.8(3) of the spec. */
export interface WeeklyContractStatsParams {
  q: string;
  /**
   * Anchors the returned series to end on this date instead of "now".
   * Always pinned for backfill (a historical week has no other way to
   * reconstruct itself). Deliberately OMITTED (left `undefined`) on the
   * live pipeline's "current week" calls as of 2026-09-21 -- live testing
   * found Marketproof snaps a supplied `end_date` on weekly-grain endpoints
   * back a full week from the date requested, and the owner's call is to
   * match the old site-data-agent's "as of right now, no end_date"
   * behavior exactly rather than pin a date. See the `AnchorMode` docs in
   * `backfill/fetchWeek.ts` for the full decision and which calls fall in
   * which bucket.
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
