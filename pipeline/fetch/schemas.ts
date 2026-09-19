import { z } from 'zod';

/**
 * Shared Zod building blocks for Marketproof `hdomi` REST responses.
 *
 * IMPORTANT PROVENANCE NOTE: these shapes are derived from the *usage*
 * examples embedded in docs/site-data-agent-FULL-PROMPT-2026-09-18.md (the
 * live routine's own field-mapping instructions, e.g. "lines.p90.cutoff",
 * "lines.p90.contractsByPeriod[].contractCount/totalPrice/avgDaysOnMarket"),
 * NOT from Marketproof's own REST API reference docs (two PDFs the project
 * owner has, this agent does not). The spec text itself flags at least one
 * field name as ambiguous ("lines.p90/p95/p99.count (or totalCount)").
 *
 * Every schema below is deliberately permissive (`.passthrough()`, optional/
 * nullish on anything not verbatim-quoted in the spec) rather than a tight
 * exact-shape assertion -- the accompanying integration tests
 * (contractStats.test.ts, neighborhoodRank.test.ts) are what actually prove
 * these shapes against live data. Where a live test run revealed the real
 * shape differed from this initial guess, that's called out in the pipeline
 * README and the task's final report, not silently patched over.
 *
 * UPDATE 2026-09-19: `luxuryContractStatsResponseSchema` and
 * `weeklyContractStatsResponseSchema` were confirmed correct (with minor
 * additions) against real, live responses. `neighborhoodEntrySchema`,
 * `contractStatsResponseSchema`, and `supplyResponseSchema` were WRONG in
 * their first pass and have been corrected below to match real payloads
 * captured this date -- see each section's own comment for what changed and
 * why. This is exactly the "ask/verify, don't guess" loop this file's
 * original comment promised: the schemas below are no longer inferred, they
 * are confirmed shapes.
 */

// ---------------------------------------------------------------------------
// luxury-contract-stats / weekly-contract-stats / monthly-contract-stats
// share a "lines"-by-percentile or "all"/by-type-bucket structure, each
// bucket holding a time series of period entries.
// ---------------------------------------------------------------------------

export const contractPeriodEntrySchema = z
  .object({
    date: z.string(),
    contractCount: z.number().nullish(),
    salesCount: z.number().nullish(), // alternate name seen on sales-oriented endpoints
    totalPrice: z.number().nullish(),
    medianPrice: z.number().nullish(),
    averagePrice: z.number().nullish(),
    ppsf: z.number().nullish(),
    avgDaysOnMarket: z.number().nullish(),
    discount: z.number().nullish(),
  })
  .passthrough();
export type ContractPeriodEntry = z.infer<typeof contractPeriodEntrySchema>;

/** One percentile "line" (p90/p95/p99) from luxury-contract-stats. */
export const percentileLineSchema = z
  .object({
    cutoff: z.number().nullish(),
    // Spec text itself flags this as ambiguous: "lines.p90/p95/p99.count (or
    // totalCount)" -- accept either name, callers should read whichever is
    // actually present via `readTierCount()` below.
    count: z.number().nullish(),
    totalCount: z.number().nullish(),
    contractsByPeriod: z.array(contractPeriodEntrySchema).default([]),
  })
  .passthrough();
export type PercentileLine = z.infer<typeof percentileLineSchema>;

/** Reads a percentile line's contract count under whichever field name the API actually used. */
export function readTierCount(line: PercentileLine): number | null {
  return line.count ?? line.totalCount ?? null;
}

const historyEntrySchema = z
  .object({
    year: z.number(),
    cutoff: z.number().nullish(),
  })
  .passthrough();

export const luxuryContractStatsResponseSchema = z
  .object({
    lines: z.object({
      p90: percentileLineSchema,
      p95: percentileLineSchema,
      p99: percentileLineSchema,
    }),
    history: z
      .object({
        p90: z.array(historyEntrySchema).default([]),
        p95: z.array(historyEntrySchema).default([]),
        p99: z.array(historyEntrySchema).default([]),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();
export type LuxuryContractStatsResponse = z.infer<typeof luxuryContractStatsResponseSchema>;

// ---------------------------------------------------------------------------
// weekly-contract-stats: "all" + per-type buckets, each a week series.
// CONFIRMED against a real response 2026-09-19 (q: "borough:manhattan"):
// top-level keys are totalCount, all/condos/coops/townhouses (each
// {total, contractsByWeek: [...]}), a TOP-LEVEL contractsByBeds (array of
// {date, totalSales, unitMix}, NOT nested inside each bucket as first
// guessed), rolling90Day/previousRolling90Day, fromCache/from_cache.
// ---------------------------------------------------------------------------

const weekBucketSchema = z
  .object({
    total: z.number().nullish(),
    contractsByWeek: z.array(contractPeriodEntrySchema).default([]),
  })
  .passthrough();

// Confirmed live 2026-09-19: bedrooms is 0/1/2/3 (number), "4+" (string), or
// null (an "unknown bed count" bucket) -- this pipeline's own bedroom_mix
// schema (schema/weeklyReportPayload.ts) models the exact same
// studio/1/2/3/4+ bucket set, for reference.
const unitMixEntrySchema = z
  .object({
    bedrooms: z.union([z.string(), z.number()]).nullish(),
    salesCount: z.number().nullish(),
    dollarVolume: z.number().nullish(),
  })
  .passthrough();

const contractsByBedsEntrySchema = z
  .object({
    date: z.string(),
    totalSales: z.number().nullish(),
    unitMix: z.array(unitMixEntrySchema).default([]),
  })
  .passthrough();

export const weeklyContractStatsResponseSchema = z
  .object({
    all: weekBucketSchema.optional(),
    condos: weekBucketSchema.optional(),
    coops: weekBucketSchema.optional(),
    townhouses: weekBucketSchema.optional(),
    contractsByBeds: z.array(contractsByBedsEntrySchema).optional(),
  })
  .passthrough();
export type WeeklyContractStatsResponse = z.infer<typeof weeklyContractStatsResponseSchema>;

// ---------------------------------------------------------------------------
// weekly-sales-stats (STEP 3/3.5). UNCONFIRMED against live data -- this
// pipeline was built without a working MARKETPROOF_API_KEY in the session
// that wrote this file (see the task's final report), so unlike the schemas
// above, this one has NOT been validated against a real response. Modeled
// defensively on the spec's own explicit description: STEP 3 says
// "if type-split, week-aligned recorded sales count/ppsf/discount/dom per
// type"; STEP 3.5 says the response "splits into
// condos/coops/townhouses.*.salesByWeek[] (no pooled 'all' bucket)".
// `.passthrough()` + optional everywhere, same defensive posture as the
// original (pre-live-test) guesses for the other datasets in this file --
// treat this one the same way: confirm against a real call before trusting
// it, and correct here (with a comment, like the others) if it's wrong.
// ---------------------------------------------------------------------------

const salesWeekBucketSchema = z
  .object({
    total: z.number().nullish(),
    salesByWeek: z.array(contractPeriodEntrySchema).default([]),
  })
  .passthrough();

export const weeklySalesStatsResponseSchema = z
  .object({
    // STEP 3.5 says there's no pooled "all" bucket on THIS dataset, but
    // STEP 3 talks about detecting whether the response "is type-split" at
    // all -- implying a pooled variant may exist for some query shapes.
    // Modeled as optional so callers can check for its presence directly.
    all: salesWeekBucketSchema.optional(),
    condos: salesWeekBucketSchema.optional(),
    coops: salesWeekBucketSchema.optional(),
    townhouses: salesWeekBucketSchema.optional(),
  })
  .passthrough();
export type WeeklySalesStatsResponse = z.infer<typeof weeklySalesStatsResponseSchema>;

// ---------------------------------------------------------------------------
// contract-stats (the base, non-time-bucketed dataset). CORRECTED 2026-09-19
// against a real response (q: "borough:manhattan") -- the original guess
// (an "all"/type-bucket structure mirroring a single week/period entry) was
// WRONG. The real shape is QUARTERLY-bucketed, not a flat aggregate, and has
// no "all" bucket at all (unlike weekly-contract-stats, which does):
//
//   { totalCount, condos: {total, contractsByQuarter: [...]},
//     coops: {...}, townhouses: {...}, contractsByBeds: [...],
//     rolling90Day: {totalCount, condos: {total, totalPrice, avgDaysOnMarket}, ...},
//     previousRolling90Day: {...same shape as rolling90Day...},
//     fromCache, from_cache }
// ---------------------------------------------------------------------------

const quarterBucketSchema = z
  .object({
    total: z.number().nullish(),
    contractsByQuarter: z.array(contractPeriodEntrySchema).default([]),
  })
  .passthrough();

const rolling90DayTypeBucketSchema = z
  .object({
    total: z.number().nullish(),
    totalPrice: z.number().nullish(),
    avgDaysOnMarket: z.number().nullish(),
  })
  .passthrough();

const rolling90DayContractsByBedsSchema = z
  .object({
    totalSales: z.number().nullish(),
    unitMix: z.array(unitMixEntrySchema).default([]),
  })
  .passthrough();

const rolling90DaySchema = z
  .object({
    totalCount: z.number().nullish(),
    condos: rolling90DayTypeBucketSchema.optional(),
    coops: rolling90DayTypeBucketSchema.optional(),
    townhouses: rolling90DayTypeBucketSchema.optional(),
    contractsByBeds: rolling90DayContractsByBedsSchema.optional(),
  })
  .passthrough();

export const contractStatsResponseSchema = z
  .object({
    totalCount: z.number().nullish(),
    condos: quarterBucketSchema.optional(),
    coops: quarterBucketSchema.optional(),
    townhouses: quarterBucketSchema.optional(),
    contractsByBeds: z.array(contractsByBedsEntrySchema).optional(),
    rolling90Day: rolling90DaySchema.optional(),
    previousRolling90Day: rolling90DaySchema.optional(),
  })
  .passthrough();
export type ContractStatsResponse = z.infer<typeof contractStatsResponseSchema>;

// ---------------------------------------------------------------------------
// neighborhood-rank
// ---------------------------------------------------------------------------

const neighborhoodTierSchema = z
  .object({
    cutoff: z.number().nullish(),
    count: z.number().nullish(),
    totalCount: z.number().nullish(),
    totalPrice: z.number().nullish(),
    averagePrice: z.number().nullish(),
    medianPrice: z.number().nullish(),
    // 0-1 fraction per the spec's own UNITS RULE note ("neighborhood-rank's
    // tiers.p90.pct is a 0-1 fraction -- multiply by 100 before writing to
    // leaderboard[].pct_lux").
    pct: z.number().nullish(),
  })
  .passthrough();

export const neighborhoodEntrySchema = z
  .object({
    // CORRECTED 2026-09-19: the real field is `neighborhood`, not `name` --
    // confirmed against a real response, which failed validation on the
    // original `name` guess (every entry came back with `name: undefined`).
    // The spec's own "match by name" phrasing (STEP 4b/4d) refers to
    // matching on this field's value, not a literal JSON key called "name".
    neighborhood: z.string(),
    rank: z.number().nullish(),
    totalContracts: z.number().nullish(),
    tiers: z
      .object({
        p90: neighborhoodTierSchema,
        p95: neighborhoodTierSchema.optional(),
        p99: neighborhoodTierSchema.optional(),
      })
      .passthrough(),
  })
  .passthrough();
export type NeighborhoodEntry = z.infer<typeof neighborhoodEntrySchema>;

export const neighborhoodRankResponseSchema = z
  .object({
    neighborhoods: z.array(neighborhoodEntrySchema),
  })
  .passthrough();
export type NeighborhoodRankResponse = z.infer<typeof neighborhoodRankResponseSchema>;

// ---------------------------------------------------------------------------
// supply -- CONFIRMED 2026-09-19 against a real response
// ({granularity:"weekly", borough:"Manhattan"}, no min_price):
//
//   { series: [{date, supply}, ...] (52 entries -- the series for THIS
//       call's own filter, i.e. whichever min_price was or wasn't passed),
//     all: {series: [...]}, condos: {series: [...]}, coops: {series: [...]},
//     townhouses: {series: [...]}, fromCache, from_cache }
//
// STEP 5 makes three SEPARATE calls (no min_price / min_price=p90 cutoff /
// min_price=p95 cutoff) to get all-Manhattan/luxury/prime respectively --
// the condos/coops/townhouses breakdown inside a single response is a
// property-type split of THAT call's own filtered result, not a second axis
// callers need for STEP 5's own luxury/prime/all figures (those come from
// the top-level `series` of three separate calls). "Last value of each"
// (the spec's STEP 5 instruction) means the last entry's `supply` field.
// ---------------------------------------------------------------------------

const supplySeriesEntrySchema = z
  .object({
    date: z.string(),
    supply: z.number().nullish(),
  })
  .passthrough();

const supplyBucketSchema = z
  .object({
    series: z.array(supplySeriesEntrySchema).default([]),
  })
  .passthrough();

export const supplyResponseSchema = z
  .object({
    series: z.array(supplySeriesEntrySchema).default([]),
    all: supplyBucketSchema.optional(),
    condos: supplyBucketSchema.optional(),
    coops: supplyBucketSchema.optional(),
    townhouses: supplyBucketSchema.optional(),
  })
  .passthrough();
export type SupplyResponse = z.infer<typeof supplyResponseSchema>;
