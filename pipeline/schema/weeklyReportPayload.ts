import { z } from 'zod';

/**
 * Zod schema for the full `weekly_report.payload` shape, ported field-for-field
 * from the OUTPUT CONTRACT at the top of docs/site-data-agent-FULL-PROMPT-2026-09-18.md
 * (pulled 2026-09-18, the ground-truth spec for the live Claude routine this
 * pipeline is rebuilding as real code).
 *
 * Nullability convention: the spec's standing rule is "if a Marketproof call
 * fails after one retry, null the field(s) it feeds -- for arrays, use []
 * (not null, not an object)... NEVER fabricate." So:
 *   - Every numeric leaf that the spec describes as attached to a specific
 *     upstream call (which can fail) is modeled as `number | null`, even
 *     where the sample JSON in the spec shows a placeholder `0` -- the
 *     sample is illustrative shape, not a claim that 0 is a fallback value.
 *   - Every `*_pct`/`*_wow_pct`/`*_yoy_pct`/`*_vs_lastweek_pct` field is
 *     `number | null` -- many are explicitly null in the sample payload
 *     (no prior week/year to compare against), and the spec repeatedly
 *     says "null if prev_* is null" for these.
 *   - Section-level arrays that the spec says become `[]` on failure
 *     (never `null`, never omitted) are modeled as plain arrays, not
 *     nullable arrays -- e.g. `top_deals: []`, `weekly_activity_leaderboard: []`.
 *   - A few fields are nullable at the ARRAY level itself because the spec
 *     explicitly says the whole section can be "absent/null" when its base
 *     data (lux52) failed -- e.g. `tier_series`, `hero.prime_volume`.
 *
 * Where the spec was ambiguous on a minor nested field, structure and
 * nullability were prioritized over exhaustiveness per the Phase 1 scope --
 * ambiguous spots are marked `// TODO: confirm field`.
 */

const nullableNumber = z.number().nullable();
const nullableNumberArray = z.array(nullableNumber);
const numberArray = z.array(z.number());

// ---------------------------------------------------------------------------
// hero
// ---------------------------------------------------------------------------

export const heroSchema = z.object({
  luxury_cutoff: nullableNumber,
  luxury_count: nullableNumber,
  luxury_count_wow_pct: nullableNumber,
  luxury_count_yoy_pct: nullableNumber,
  luxury_count_vs_lastweek_pct: nullableNumber,
  luxury_count_avg52: nullableNumber,
  luxury_volume: nullableNumber,
  luxury_volume_wow_pct: nullableNumber,
  luxury_volume_yoy_pct: nullableNumber,
  luxury_volume_vs_lastweek_pct: nullableNumber,
  luxury_volume_avg52: nullableNumber,
  prime_cutoff: nullableNumber,
  prime_count: nullableNumber,
  prime_volume: nullableNumber, // absent/null if lux52 failed (STEP 1.8)
  trophy_cutoff: nullableNumber,
  trophy_count: nullableNumber,
  trophy_volume: nullableNumber, // absent/null if lux52 failed (STEP 1.8)
  median_price: nullableNumber,
  median_ppsf: nullableNumber,
  avg_dom: nullableNumber,
});
export type Hero = z.infer<typeof heroSchema>;

// ---------------------------------------------------------------------------
// demand_trend
// ---------------------------------------------------------------------------

export const demandTrendSchema = z.object({
  counts: nullableNumberArray, // flat array, [] on failure
  rolling_avg: nullableNumberArray,
  labels: z.array(z.string()), // ISO dates, same length/alignment as counts
});
export type DemandTrend = z.infer<typeof demandTrendSchema>;

// ---------------------------------------------------------------------------
// tiers
// ---------------------------------------------------------------------------

const tierCardSchema = z.object({
  cutoff: nullableNumber,
  cutoff_wow_pct: nullableNumber,
  cutoff_yoy_pct: nullableNumber,
  ppsf_avg: nullableNumber,
  ppsf_avg_wow_pct: nullableNumber,
  ppsf_avg_yoy_pct: nullableNumber,
  cleared_52wk: nullableNumber,
  cleared_52wk_wow_pct: nullableNumber,
  cleared_52wk_yoy_pct: nullableNumber,
  volume_52wk: nullableNumber,
  volume_52wk_wow_pct: nullableNumber,
  volume_52wk_yoy_pct: nullableNumber,
});
export type TierCard = z.infer<typeof tierCardSchema>;

const historyAnnualSchema = z.object({
  years: z.array(z.number()), // own separate flat array, parallel to p90/p95/p99
  p90: numberArray,
  p95: numberArray,
  p99: numberArray,
});

const historyQuarterlySchema = z.object({
  labels: z.array(z.string()), // last entry always exactly "Current"
  p90: numberArray,
  p95: numberArray,
  p99: numberArray,
});

export const tiersSchema = z.object({
  luxury: tierCardSchema,
  prime: tierCardSchema,
  trophy: tierCardSchema,
  history_annual: historyAnnualSchema,
  history_quarterly: historyQuarterlySchema,
});
export type Tiers = z.infer<typeof tiersSchema>;

// ---------------------------------------------------------------------------
// market_pulse
// ---------------------------------------------------------------------------

const marketPulseAllSchema = z.object({
  contracts: nullableNumber,
  contracts_wow_pct: nullableNumber, // naming quirk per spec: actually "vs 52wk avg", left as-is
  contracts_yoy_pct: nullableNumber,
  contracts_avg52: nullableNumber,
  contracts_vs_lastweek_pct: nullableNumber, // genuine week-over-week, distinct from contracts_wow_pct
  volume: nullableNumber,
  volume_wow_pct: nullableNumber,
  volume_yoy_pct: nullableNumber,
  volume_avg52: nullableNumber,
  volume_vs_lastweek_pct: nullableNumber,
});

const byTypeEntrySchema = z.object({
  contracts: nullableNumber,
  contracts_wow_pct: nullableNumber,
  contracts_yoy_pct: nullableNumber,
  contracts_volume: nullableNumber,
  contracts_volume_wow_pct: nullableNumber,
  contracts_volume_yoy_pct: nullableNumber,
  recorded_sales: nullableNumber,
  recorded_sales_wow_pct: nullableNumber,
  recorded_sales_yoy_pct: nullableNumber,
  ppsf: nullableNumber,
  ppsf_wow_pct: nullableNumber,
  ppsf_yoy_pct: nullableNumber,
  discount_pct: nullableNumber,
  discount_pct_wow_pct: nullableNumber,
  discount_pct_yoy_pct: nullableNumber,
  dom: nullableNumber,
  dom_wow_pct: nullableNumber, // expected null this cycle -- documented gap (STEP 3 note)
  dom_yoy_pct: nullableNumber, // expected null this cycle -- documented gap (STEP 3 note)
});
export type ByTypeEntry = z.infer<typeof byTypeEntrySchema>;

export const marketPulseSchema = z.object({
  all: marketPulseAllSchema,
  by_type: z.object({
    condo: byTypeEntrySchema,
    coop: byTypeEntrySchema,
    townhouse: byTypeEntrySchema,
  }),
});
export type MarketPulse = z.infer<typeof marketPulseSchema>;

// ---------------------------------------------------------------------------
// bedroom_mix (metric-first: exactly {volume, count}, never bucket-first)
// ---------------------------------------------------------------------------

const bedroomBucketsSchema = z.object({
  studio: nullableNumber,
  '1': nullableNumber,
  '2': nullableNumber,
  '3': nullableNumber,
  '4+': nullableNumber,
});

export const bedroomMixSchema = z.object({
  volume: bedroomBucketsSchema,
  count: bedroomBucketsSchema,
});
export type BedroomMix = z.infer<typeof bedroomMixSchema>;

// ---------------------------------------------------------------------------
// leaderboard / concentrated_leaderboard (identical row shape)
// ---------------------------------------------------------------------------

const rankedLeaderboardRowSchema = z.object({
  rank: z.number(),
  name: z.string(),
  vol_52wk: nullableNumber,
  contracts_52wk: nullableNumber,
  local_median: nullableNumber, // never fabricated -- null if not available for this neighborhood
  avg_sale: nullableNumber,
  pct_lux: nullableNumber, // percentage-scale (35.0, never 0.35)
  wk_contracts: nullableNumber,
  wk_volume: nullableNumber,
  rank_delta: z.number().nullable(), // historical_rank - current_rank; null if not found historically
});
export type RankedLeaderboardRow = z.infer<typeof rankedLeaderboardRowSchema>;

const weeklyActivityLeaderboardRowSchema = z.object({
  rank: z.number(),
  name: z.string(),
  wk_contracts: nullableNumber,
  wk_volume: nullableNumber,
  largest_rank: z.number().nullable(), // present as null or a number, never omitted
  concentrated_rank: z.number().nullable(),
});
export type WeeklyActivityLeaderboardRow = z.infer<typeof weeklyActivityLeaderboardRowSchema>;

// ---------------------------------------------------------------------------
// supply
// ---------------------------------------------------------------------------

const supplyLuxuryOrAllSchema = z.object({
  active: nullableNumber,
  active_wow_pct: nullableNumber,
  active_yoy_pct: nullableNumber,
  months_supply: nullableNumber,
  months_supply_wow_pct: nullableNumber,
  months_supply_yoy_pct: nullableNumber,
  absorption_pct: nullableNumber,
  absorption_pct_wow_pct: nullableNumber,
  absorption_pct_yoy_pct: nullableNumber,
});

// Sample payload shows prime with a smaller field set than luxury/all
// (no *_wow_pct/*_yoy_pct siblings listed) -- kept minimal to match the spec
// sample exactly. TODO: confirm field -- the spec never explicitly rules out
// prime eventually growing the same wow/yoy siblings as luxury/all; if a
// future spec revision adds them, extend this schema then.
const supplyPrimeSchema = z.object({
  active: nullableNumber,
  months_supply: nullableNumber,
  absorption_pct: nullableNumber,
  active_yoy_pct: nullableNumber,
});

export const supplySchema = z.object({
  luxury: supplyLuxuryOrAllSchema,
  prime: supplyPrimeSchema,
  all: supplyLuxuryOrAllSchema,
  supply_series: z.object({
    luxury: numberArray,
    prime: numberArray,
    all: numberArray,
  }),
  dom_series: z.object({
    luxury: nullableNumberArray, // last-26-week slice, same alignment as demand_trend
    luxury_p95: nullableNumberArray, // present even if lux52 lacked p95 data (array of nulls, never omitted)
    all: nullableNumberArray, // same length as luxury (26) -- never a raw 52-point dump
  }),
});
export type Supply = z.infer<typeof supplySchema>;

// ---------------------------------------------------------------------------
// type_trends
// ---------------------------------------------------------------------------

const typeTrendsByPropertyTypeSchema = z.object({
  condo: nullableNumberArray,
  coop: nullableNumberArray,
  townhouse: nullableNumberArray,
});

export const typeTrendsSchema = z.object({
  labels: z.array(z.string()), // shared cadence across every type_trends series
  contracts_count: typeTrendsByPropertyTypeSchema,
  contracts_volume: typeTrendsByPropertyTypeSchema,
  sales_avgprice: typeTrendsByPropertyTypeSchema,
  sales_discount: typeTrendsByPropertyTypeSchema,
  sales_ppsf: typeTrendsByPropertyTypeSchema,
  sales_count: typeTrendsByPropertyTypeSchema,
  sales_volume: typeTrendsByPropertyTypeSchema,
});
export type TypeTrends = z.infer<typeof typeTrendsSchema>;

// ---------------------------------------------------------------------------
// top_deals
// ---------------------------------------------------------------------------

export const propertyTypeSchema = z.enum(['condo', 'co-op', 'townhouse']).nullable();

export const topDealSchema = z.object({
  address: z.string(), // real, title-cased street address + unit, no anonymization
  price: z.number(),
  neighborhood: z.string(),
  sf: nullableNumber, // null if missing -- never guessed
  ppsf: nullableNumber, // null wherever sf is null/0
  dom: nullableNumber,
  property_type: propertyTypeSchema,
});
export type TopDeal = z.infer<typeof topDealSchema>;

// ---------------------------------------------------------------------------
// sowhat (the "So-What" Rule Engine)
// ---------------------------------------------------------------------------

export const marketReadBadgeSchema = z.object({
  badge: z.string(), // one of BUSY/ABOVE PACE/NORMAL/SLOW/QUIET, optionally + " -- SEASONAL"
  class: z.string(), // one of read--busy/read--above/read--normal/read--slow/read--quiet
});
export type MarketReadBadge = z.infer<typeof marketReadBadgeSchema>;

export const sowhatFootnotesSchema = z.object({
  asking_not_achieved: z.string(),
  count_reconciliation: z.string(),
  provisional: z.string(),
});

export const sowhatSchema = z.object({
  lede: z.string().nullable(), // one of the other _read strings verbatim -- TODO: confirm field (never null in spec examples, but STEP 6.5 skip conditions on lux52 failure suggest it could be)
  market_read: marketReadBadgeSchema,
  supply_read: z.string().nullable(),
  supply_band_label: z.string().nullable(), // raw band string alone, feeds next week's streak calc
  pace_read: z.string().nullable(),
  dom_read: z.string().nullable(),
  discount_read: z.string().nullable(),
  volume_read: z.string().nullable(), // frequently null -- 0.20 momentum gate, this is normal
  trophy_read: z.string().nullable(),
  neighborhood_mover_read: z.string().nullable(),
  footnotes: sowhatFootnotesSchema,
  streak_weeks: z.number().nullable(),
});
export type Sowhat = z.infer<typeof sowhatSchema>;

// ---------------------------------------------------------------------------
// tier_series (52-point weekly trailing history, all 3 tiers x 5 metrics)
// ---------------------------------------------------------------------------

const tierSeriesTierMetricsSchema = z.object({
  count: nullableNumber, // 0 is a real, valid zero-contract week -- never null for that reason alone
  volume: nullableNumber, // millions
  median: nullableNumber, // millions; null whole trio when contractCount == 0
  ppsf: nullableNumber,
  dom: nullableNumber, // null only when avgDaysOnMarket key is missing, not on a zero-contract week
});

export const tierSeriesEntrySchema = z.object({
  week_start: z.string(),
  luxury: tierSeriesTierMetricsSchema,
  prime: tierSeriesTierMetricsSchema,
  trophy: tierSeriesTierMetricsSchema,
});
export type TierSeriesEntry = z.infer<typeof tierSeriesEntrySchema>;

// ---------------------------------------------------------------------------
// full payload
// ---------------------------------------------------------------------------

export const weeklyReportPayloadSchema = z.object({
  hero: heroSchema,
  demand_trend: demandTrendSchema,
  tiers: tiersSchema,
  market_pulse: marketPulseSchema,
  bedroom_mix: bedroomMixSchema,
  leaderboard: z.array(rankedLeaderboardRowSchema), // [] if none qualify, never null
  concentrated_leaderboard: z.array(rankedLeaderboardRowSchema), // [] is a FAIL per monitor check (f) -- validated at the check layer, not here
  weekly_activity_leaderboard: z.array(weeklyActivityLeaderboardRowSchema), // [] is legitimate here
  supply: supplySchema,
  type_trends: typeTrendsSchema,
  top_deals: z.array(topDealSchema), // [] not null if none qualify
  sowhat: sowhatSchema,
  // Both nullable at the section level: absent/null if lux52 (the base data
  // for STEP 1.8) itself failed -- see STEP 1.8's own fail-handling note.
  tier_series: z.array(tierSeriesEntrySchema).nullable(),
  tier_series_methodology_note: z.string().nullable(),
});
export type WeeklyReportPayload = z.infer<typeof weeklyReportPayloadSchema>;
