import { fetchMarketproofDataset } from './marketproofClient';
import { neighborhoodRankResponseSchema, type NeighborhoodRankResponse } from './schemas';

/** Request params for neighborhood-rank, per STEP 4/4.5 of the spec. */
export interface NeighborhoodRankParams {
  borough: string;
  window: 'trailing-52w' | 'trailing-13w' | string;
  sort_by: number; // e.g. 90 -- spec confirms the API's native `rank` field is always
  // intensity-ordered by this percentile regardless of what's requested; callers
  // that need a different ranking basis re-sort the returned neighborhoods[]
  // themselves rather than trusting the native `rank` field (see STEP 4).
  limit: number;
  min_contracts: number;
  min_price?: number;
  end_date?: string;
  /**
   * NOT a body field -- per STEP 4(b)'s exact usage
   * ("neighborhood-rank?cache=refresh {borough:...}"), `cache=refresh` is a
   * URL query-string param sitting alongside the JSON body, not inside it.
   * Sent as `?cache=refresh` on the request URL when set.
   */
  cacheRefresh?: boolean;
}

/**
 * neighborhood-rank -- the borough-wide neighborhood leaderboard engine
 * (STEP 4/4b/4c/4.5). One retry on failure, then `null`.
 */
export async function fetchNeighborhoodRank(
  params: NeighborhoodRankParams,
): Promise<NeighborhoodRankResponse | null> {
  const { cacheRefresh, ...body } = params;
  return fetchMarketproofDataset(
    'neighborhood-rank',
    body,
    neighborhoodRankResponseSchema,
    cacheRefresh ? 'cache=refresh' : undefined,
  );
}
