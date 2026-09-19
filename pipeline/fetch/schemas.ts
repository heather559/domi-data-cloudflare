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
// weekly-contract-stats: "all" + optional per-type buckets, each a week series.
// ---------------------------------------------------------------------------

const weekBucketSchema = z
  .object({
    contractsByWeek: z.array(contractPeriodEntrySchema).default([]),
    contractsByBeds: z.record(z.string(), z.number().nullish()).optional(),
  })
  .passthrough();

export const weeklyContractStatsResponseSchema = z
  .object({
    all: weekBucketSchema.optional(),
    condos: weekBucketSchema.optional(),
    coops: weekBucketSchema.optional(),
    townhouses: weekBucketSchema.optional(),
  })
  .passthrough();
export type WeeklyContractStatsResponse = z.infer<typeof weeklyContractStatsResponseSchema>;

// ---------------------------------------------------------------------------
// contract-stats (the base, non-time-bucketed dataset -- structural sibling
// of weekly-contract-stats/monthly-contract-stats per Marketproof's own
// dataset-name pattern of {base, weekly-, monthly-} variants). This one has
// no usage example anywhere in the ground-truth spec text (the spec never
// calls plain "contract-stats" directly) -- shape below is inferred from
// that naming pattern alone: an aggregate (non-time-series) summary per
// bucket, same field vocabulary as a single contractsByWeek/contractsByPeriod
// entry. NOT yet confirmed against a real response inside this codebase;
// confirm via contractStats.test.ts before anything downstream depends on
// specific field names beyond what's asserted there.
// ---------------------------------------------------------------------------

const aggregateBucketSchema = z
  .object({
    contractCount: z.number().nullish(),
    salesCount: z.number().nullish(),
    totalPrice: z.number().nullish(),
    medianPrice: z.number().nullish(),
    averagePrice: z.number().nullish(),
    ppsf: z.number().nullish(),
    avgDaysOnMarket: z.number().nullish(),
    discount: z.number().nullish(),
  })
  .passthrough();

export const contractStatsResponseSchema = z
  .object({
    all: aggregateBucketSchema.optional(),
    condos: aggregateBucketSchema.optional(),
    coops: aggregateBucketSchema.optional(),
    townhouses: aggregateBucketSchema.optional(),
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
    name: z.string(),
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
// supply -- LEAST confirmed of the five: the spec only ever describes what's
// DONE with this endpoint's output ("last value" -> *.active, "full 52-week
// series" -> supply_series.*), never quotes an actual response field name the
// way it does for the other four endpoints. Left maximally permissive
// (passthrough on everything) rather than asserting field names invented
// with no textual basis -- do not tighten this beyond what a live test
// confirms.
// ---------------------------------------------------------------------------

export const supplyResponseSchema = z.record(z.string(), z.unknown());
export type SupplyResponse = z.infer<typeof supplyResponseSchema>;
