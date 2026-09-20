/**
 * Builds a `PriorWeekValues` object (the STEP 0 "last week" lookup) from a
 * real stored `weekly_report.payload` row -- or `EMPTY_PRIOR_WEEK` if none
 * exists (first-ever run, or a gap in stored weeks).
 *
 * Shared between `backfill/run.ts` (which threads in each historical week's
 * REAL stored payload as the next week's "prior", per its own comment on
 * why it avoids compounding drift) and the live `index.ts` entrypoint
 * (which threads in whatever `public.weekly_report` has for `week_start - 7d`,
 * which today is very likely nothing -- see `io/supabase.ts`'s
 * `getStoredWeeklyReportPayload`).
 */

import type { PriorWeekValues } from '../compute/types';
import { EMPTY_PRIOR_WEEK } from '../compute/types';
import type { WeeklyReportPayload, TierCard } from '../schema/weeklyReportPayload';

export function buildPriorWeekValues(prevPayload: WeeklyReportPayload | null): PriorWeekValues {
  if (!prevPayload) return EMPTY_PRIOR_WEEK;

  const pickTierCard = (t: TierCard): TierCard => t;

  return {
    prevSupplyBandLabel: prevPayload.sowhat.supply_band_label,
    prevStreakWeeks: prevPayload.sowhat.streak_weeks,
    prevLuxuryCount: prevPayload.hero.luxury_count,
    prevLuxuryVolume: prevPayload.hero.luxury_volume,
    prevQuarterlyHistory: prevPayload.tiers.history_quarterly,
    prevTiers: {
      luxury: pickTierCard(prevPayload.tiers.luxury),
      prime: pickTierCard(prevPayload.tiers.prime),
      trophy: pickTierCard(prevPayload.tiers.trophy),
    },
    prevPulseAll: {
      contracts: prevPayload.market_pulse.all.contracts,
      volume: prevPayload.market_pulse.all.volume,
    },
  };
}
