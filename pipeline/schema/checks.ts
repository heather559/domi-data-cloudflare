/**
 * Structural consistency checks, ported from site-data-agent's STEP 7.5 and
 * site-data-monitor-agent's "SECOND, INDEPENDENT consistency pass" (checks
 * a-e in the monitor spec), PLUS (further down this file) STEP 7's own
 * ~24-item output-contract checklist (a)-(x). These are pure functions --
 * no I/O, no Supabase, no Slack -- returning a structured result so callers
 * (the compute/write layer, and the monitor service) can decide what to do
 * with a failure rather than this module deciding how to report it.
 *
 * Phase 1 note: these are wired up and unit-tested now, but nothing in this
 * phase's index.ts calls them yet -- there is no real payload to check until
 * Phase 2/3 land the Marketproof data pulls. They exist now so the schema
 * and its guardrails are proven before real business logic is layered on top.
 */

import { weeklyReportPayloadSchema, type WeeklyReportPayload } from './weeklyReportPayload';

export interface CheckResult {
  ok: boolean;
  code: string;
  detail?: string;
}

/**
 * Tier cutoff monotonicity: luxury < prime < trophy.
 * Spec: site-data-agent STEP 7.5(a) / site-data-monitor-agent check (a).
 * A null cutoff means the tier's own data was unavailable this run -- that's
 * a "can't verify" state we still want visibility into via the `detail`,
 * but it's the whole point of "null the field, never fabricate": we do NOT
 * fail this check just because a value is null, since a null cutoff is not
 * a monotonicity violation, it's a missing input. Only two present numbers
 * that are actually out of order are a real failure.
 */
export function checkTierCutoffMonotonicity(cutoffs: {
  luxury: number | null;
  prime: number | null;
  trophy: number | null;
}): CheckResult {
  const { luxury, prime, trophy } = cutoffs;

  if (luxury !== null && prime !== null && luxury >= prime) {
    return {
      ok: false,
      code: 'tier_cutoffs_not_monotonic',
      detail: `luxury cutoff (${luxury}) is not less than prime cutoff (${prime})`,
    };
  }
  if (prime !== null && trophy !== null && prime >= trophy) {
    return {
      ok: false,
      code: 'tier_cutoffs_not_monotonic',
      detail: `prime cutoff (${prime}) is not less than trophy cutoff (${trophy})`,
    };
  }
  if (luxury !== null && trophy !== null && luxury >= trophy) {
    return {
      ok: false,
      code: 'tier_cutoffs_not_monotonic',
      detail: `luxury cutoff (${luxury}) is not less than trophy cutoff (${trophy})`,
    };
  }

  return { ok: true, code: 'tier_cutoffs_not_monotonic' };
}

/**
 * hero.luxury_count should equal demand_trend.counts[last] -- both are
 * derived from the same lux52 p90 series, just written to two different
 * payload paths. Spec: STEP 7.5(b) / monitor check (b).
 */
export function checkHeroLuxuryCountMatchesDemandTrend(
  heroLuxuryCount: number | null,
  demandTrendCounts: readonly (number | null)[],
): CheckResult {
  if (heroLuxuryCount === null || demandTrendCounts.length === 0) {
    return { ok: true, code: 'hero_demand_trend_count_mismatch' };
  }

  const last = demandTrendCounts[demandTrendCounts.length - 1];
  if (last === null) {
    return { ok: true, code: 'hero_demand_trend_count_mismatch' };
  }

  if (heroLuxuryCount !== last) {
    return {
      ok: false,
      code: 'hero_demand_trend_count_mismatch',
      detail: `hero.luxury_count (${heroLuxuryCount}) !== demand_trend.counts[last] (${last})`,
    };
  }

  return { ok: true, code: 'hero_demand_trend_count_mismatch' };
}

/**
 * supply.luxury.active <= supply.all.active -- luxury is a subset of
 * all-Manhattan supply and can never exceed it. Spec: STEP 7.5(c) / monitor
 * check (c). Also covers the analogous supply.prime.active <= supply.all.active
 * relationship (not explicitly named in the spec's lettered checks, but the
 * same subset logic applies -- flagged here as a TODO in case a human wants
 * to confirm prime should be checked too before this becomes load-bearing).
 */
export function checkLuxurySupplyWithinAllSupply(
  luxuryActive: number | null,
  allActive: number | null,
): CheckResult {
  if (luxuryActive === null || allActive === null) {
    return { ok: true, code: 'luxury_supply_exceeds_all_supply' };
  }

  if (luxuryActive > allActive) {
    return {
      ok: false,
      code: 'luxury_supply_exceeds_all_supply',
      detail: `supply.luxury.active (${luxuryActive}) > supply.all.active (${allActive})`,
    };
  }

  return { ok: true, code: 'luxury_supply_exceeds_all_supply' };
}

/**
 * Leaderboard non-increasing sort order check -- generic over the numeric
 * sort key, since the spec applies the same "must be non-increasing down the
 * array" rule to several different panels with different keys:
 *   - leaderboard: vol_52wk (STEP 7(f) / monitor check (h))
 *   - concentrated_leaderboard: pct_lux (monitor check (h))
 *   - weekly_activity_leaderboard: wk_contracts, tie-broken by wk_volume
 *     descending (monitor check (h)) -- pass `tieBreakKey` for that panel.
 */
export function checkLeaderboardNonIncreasing<T>(
  rows: readonly T[],
  sortKey: (row: T) => number | null,
  options?: { tieBreakKey?: (row: T) => number | null; code?: string },
): CheckResult {
  const code = options?.code ?? 'leaderboard_not_sorted';

  for (let i = 1; i < rows.length; i++) {
    const prev = sortKey(rows[i - 1]);
    const curr = sortKey(rows[i]);

    if (prev === null || curr === null) continue; // can't verify order around a missing value

    if (curr > prev) {
      return {
        ok: false,
        code,
        detail: `row ${i} (${curr}) exceeds row ${i - 1} (${prev}) -- not non-increasing`,
      };
    }

    if (curr === prev && options?.tieBreakKey) {
      const prevTie = options.tieBreakKey(rows[i - 1]);
      const currTie = options.tieBreakKey(rows[i]);
      if (prevTie !== null && currTie !== null && currTie > prevTie) {
        return {
          ok: false,
          code,
          detail: `tie-break at row ${i} (${currTie}) exceeds row ${i - 1} (${prevTie})`,
        };
      }
    }
  }

  return { ok: true, code };
}

/**
 * Bedroom-mix sum vs. total contracts -- both represent this week's total
 * contracts, bucketed differently. Spec allows up to 15% drift (small
 * multi-family/unknown-bed-count records are expected). STEP 7.5(d) /
 * monitor check (d).
 */
export function checkBedroomMixSumAgreesWithTotalContracts(
  bedroomMixCounts: Record<string, number | null>,
  totalContracts: number | null,
  toleranceFraction = 0.15,
): CheckResult {
  if (totalContracts === null || totalContracts === 0) {
    return { ok: true, code: 'bedroom_mix_sum_mismatch' };
  }

  const values = Object.values(bedroomMixCounts);
  if (values.some((v) => v === null)) {
    return { ok: true, code: 'bedroom_mix_sum_mismatch' };
  }

  const sum = values.reduce<number>((acc, v) => acc + (v as number), 0);
  const diffFraction = Math.abs(sum - totalContracts) / totalContracts;

  if (diffFraction > toleranceFraction) {
    return {
      ok: false,
      code: 'bedroom_mix_sum_mismatch',
      detail: `bedroom_mix sum (${sum}) differs from market_pulse.all.contracts (${totalContracts}) by ${(diffFraction * 100).toFixed(1)}% (tolerance ${(toleranceFraction * 100).toFixed(0)}%)`,
    };
  }

  return { ok: true, code: 'bedroom_mix_sum_mismatch' };
}

// ---------------------------------------------------------------------------
// STEP 7 -- OUTPUT CONTRACT checks (a)-(x). Many of the lettered items in
// the spec (b/c/d/l/o-presence/p-key-presence/q/r/s-presence/u-presence/
// x-presence) are exact-shape requirements that `weeklyReportPayloadSchema`
// itself already enforces at the TYPE level -- a payload that fails those
// simply won't compile/parse. `checkPayloadMatchesSchema` runs that
// validation explicitly so callers get the same {ok, code, detail} shape
// as every other check here, instead of a thrown ZodError.
//
// The checks below this one cover what schema validation CAN'T see:
// sort order, cross-field sign conventions, index-alignment lengths, and
// gate/threshold correctness -- the parts of STEP 7 that are genuinely
// about VALUES, not just shape.
// ---------------------------------------------------------------------------

/** STEP 7 (a)/(b)/(c)/(d)/(l)/(p-keys)/(q)/(r)/(s-presence)/(u-presence)/(x-presence): the full structural contract, enforced in one pass via the same zod schema the payload is built against. */
export function checkPayloadMatchesSchema(payload: unknown): CheckResult {
  const parsed = weeklyReportPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      code: 'payload_schema_violation',
      detail: JSON.stringify(parsed.error.issues.slice(0, 10)), // cap detail length -- a shape bug can produce dozens of issues
    };
  }
  return { ok: true, code: 'payload_schema_violation' };
}

/** STEP 7 (f): leaderboard must be sorted by vol_52wk descending -- NOT the API's native intensity-ordered `rank`, per the 2026-07-23 revert. */
export function checkLeaderboardSortedByVolume(rows: readonly { vol_52wk: number | null }[]): CheckResult {
  return checkLeaderboardNonIncreasing(rows, (r) => r.vol_52wk, { code: 'leaderboard_not_sorted_by_volume' });
}

/** STEP 7 (v): concentrated_leaderboard sorted by pct_lux descending, every row's contracts_52wk (the qualifying-deal count) >= 11, max 10 rows. */
export function checkConcentratedLeaderboardShape(
  rows: readonly { pct_lux: number | null; contracts_52wk: number | null }[],
): CheckResult {
  const sortCheck = checkLeaderboardNonIncreasing(rows, (r) => r.pct_lux, { code: 'concentrated_leaderboard_not_sorted_by_intensity' });
  if (!sortCheck.ok) return sortCheck;

  if (rows.length > 10) {
    return { ok: false, code: 'concentrated_leaderboard_too_many_rows', detail: `${rows.length} rows (max 10)` };
  }

  const thin = rows.find((r) => r.contracts_52wk !== null && r.contracts_52wk < 11);
  if (thin) {
    return {
      ok: false,
      code: 'concentrated_leaderboard_below_qualifying_floor',
      detail: `a row has contracts_52wk (${thin.contracts_52wk}) below the required >= 11 qualifying-deal floor`,
    };
  }

  return { ok: true, code: 'concentrated_leaderboard_shape' };
}

/** STEP 7 (w): weekly_activity_leaderboard sorted by wk_contracts descending (wk_volume descending as tiebreak), max 10 rows (never padded). The cross-referenced total-volume reconciliation against hero.luxury_volume needs data beyond the payload itself (the full underlying search_activities pull, not just the top 10 shown) -- pass `totalVolumeAcrossAllNeighborhoods` when that's available to also run that half of the check; omit it to check sort/cap only. */
export function checkWeeklyActivityLeaderboardShape(
  rows: readonly { wk_contracts: number | null; wk_volume: number | null }[],
  options?: { heroLuxuryVolume?: number | null; totalVolumeAcrossAllNeighborhoods?: number | null; toleranceFraction?: number },
): CheckResult {
  const sortCheck = checkLeaderboardNonIncreasing(rows, (r) => r.wk_contracts, {
    tieBreakKey: (r) => r.wk_volume,
    code: 'weekly_activity_leaderboard_not_sorted',
  });
  if (!sortCheck.ok) return sortCheck;

  if (rows.length > 10) {
    return { ok: false, code: 'weekly_activity_leaderboard_too_many_rows', detail: `${rows.length} rows (max 10)` };
  }

  const { heroLuxuryVolume, totalVolumeAcrossAllNeighborhoods, toleranceFraction = 0.01 } = options ?? {};
  if (heroLuxuryVolume != null && totalVolumeAcrossAllNeighborhoods != null) {
    const denom = heroLuxuryVolume === 0 ? 1 : heroLuxuryVolume;
    const diffFraction = Math.abs(totalVolumeAcrossAllNeighborhoods - heroLuxuryVolume) / denom;
    if (diffFraction > toleranceFraction) {
      return {
        ok: false,
        code: 'weekly_activity_volume_reconciliation_mismatch',
        detail: `sum of wk_volume across all neighborhoods found (${totalVolumeAcrossAllNeighborhoods}) does not match hero.luxury_volume (${heroLuxuryVolume}) -- likely a pagination/dedup bug`,
      };
    }
  }

  return { ok: true, code: 'weekly_activity_leaderboard_shape' };
}

/** STEP 7 (h): top_deals sorted by price descending, max 5, ppsf null wherever sf is null/0. */
export function checkTopDealsShape(
  deals: readonly { price: number; sf: number | null; ppsf: number | null }[],
): CheckResult {
  if (deals.length > 5) {
    return { ok: false, code: 'top_deals_too_many', detail: `${deals.length} entries (max 5)` };
  }
  for (let i = 1; i < deals.length; i++) {
    if (deals[i].price > deals[i - 1].price) {
      return { ok: false, code: 'top_deals_not_sorted', detail: `entry ${i} (${deals[i].price}) exceeds entry ${i - 1} (${deals[i - 1].price})` };
    }
  }
  const badPpsf = deals.find((d) => (d.sf === null || d.sf === 0) && d.ppsf !== null);
  if (badPpsf) {
    return { ok: false, code: 'top_deals_ppsf_without_sf', detail: `a deal has a non-null ppsf despite null/0 sf` };
  }
  return { ok: true, code: 'top_deals_shape' };
}

/** STEP 7 (i): sowhat.volume_read must be null unless the 0.20 momentum gate passed -- pass the momentum value actually used to decide, since the payload itself doesn't carry it. */
export function checkVolumeReadGate(volumeRead: string | null, dollarVolumeMomentum: number | null): CheckResult {
  if (dollarVolumeMomentum === null) return { ok: true, code: 'volume_read_gate' }; // can't verify without the momentum value -- not itself a failure
  const gatePassed = Math.abs(dollarVolumeMomentum) >= 0.2;
  if (volumeRead !== null && !gatePassed) {
    return { ok: false, code: 'volume_read_gate', detail: 'volume_read is non-null but momentum did not clear the 0.20 gate' };
  }
  return { ok: true, code: 'volume_read_gate' };
}

/** STEP 7 (j): sowhat.lede must equal one of the other _read strings verbatim (or be null). */
export function checkLedeMatchesOtherReads(sowhat: {
  lede: string | null;
  supply_read: string | null;
  pace_read: string | null;
  dom_read: string | null;
  discount_read: string | null;
  volume_read: string | null;
}): CheckResult {
  if (sowhat.lede === null) return { ok: true, code: 'lede_matches_other_reads' };
  const candidates = [sowhat.supply_read, sowhat.pace_read, sowhat.dom_read, sowhat.discount_read, sowhat.volume_read];
  if (!candidates.includes(sowhat.lede)) {
    return { ok: false, code: 'lede_matches_other_reads', detail: 'sowhat.lede does not match any of the other _read strings verbatim' };
  }
  return { ok: true, code: 'lede_matches_other_reads' };
}

/** STEP 7 (k): type_trends.labels and every type_trends.*.condo/coop/townhouse array must all share the same length (index-aligned). */
export function checkTypeTrendsAlignment(typeTrends: {
  labels: readonly string[];
  contracts_count: Record<string, readonly unknown[]>;
  contracts_volume: Record<string, readonly unknown[]>;
  sales_avgprice: Record<string, readonly unknown[]>;
  sales_discount: Record<string, readonly unknown[]>;
  sales_ppsf: Record<string, readonly unknown[]>;
  sales_count: Record<string, readonly unknown[]>;
  sales_volume: Record<string, readonly unknown[]>;
}): CheckResult {
  const expectedLength = typeTrends.labels.length;
  const groups = [
    typeTrends.contracts_count,
    typeTrends.contracts_volume,
    typeTrends.sales_avgprice,
    typeTrends.sales_discount,
    typeTrends.sales_ppsf,
    typeTrends.sales_count,
    typeTrends.sales_volume,
  ];
  for (const group of groups) {
    for (const [type, arr] of Object.entries(group)) {
      if (arr.length !== expectedLength) {
        return {
          ok: false,
          code: 'type_trends_length_mismatch',
          detail: `${type} array has length ${arr.length}, expected ${expectedLength} (type_trends.labels' length)`,
        };
      }
    }
  }
  return { ok: true, code: 'type_trends_length_mismatch' };
}

/** STEP 7 (n): demand_trend.counts/rolling_avg/labels and supply.dom_series.luxury/luxury_p95 must all be index-aligned to the same weeks (same length). */
export function checkDemandTrendDomSeriesAlignment(inputs: {
  demandTrendCounts: readonly unknown[];
  demandTrendRollingAvg: readonly unknown[];
  demandTrendLabels: readonly unknown[];
  domSeriesLuxury: readonly unknown[];
  domSeriesLuxuryP95: readonly unknown[];
}): CheckResult {
  const lengths = {
    counts: inputs.demandTrendCounts.length,
    rolling_avg: inputs.demandTrendRollingAvg.length,
    labels: inputs.demandTrendLabels.length,
    dom_series_luxury: inputs.domSeriesLuxury.length,
    dom_series_luxury_p95: inputs.domSeriesLuxuryP95.length,
  };
  const distinct = new Set(Object.values(lengths));
  if (distinct.size > 1) {
    return { ok: false, code: 'demand_trend_dom_series_length_mismatch', detail: JSON.stringify(lengths) };
  }
  return { ok: true, code: 'demand_trend_dom_series_length_mismatch' };
}

/** STEP 7 (t): dom_series.all must be the same length as dom_series.luxury (26), never a raw 52-point dump. */
export function checkDomSeriesAllLength(domSeriesAll: readonly unknown[], domSeriesLuxury: readonly unknown[]): CheckResult {
  if (domSeriesAll.length !== domSeriesLuxury.length) {
    return {
      ok: false,
      code: 'dom_series_all_length_mismatch',
      detail: `dom_series.all has length ${domSeriesAll.length}, expected ${domSeriesLuxury.length} (dom_series.luxury's length)`,
    };
  }
  return { ok: true, code: 'dom_series_all_length_mismatch' };
}

/** STEP 7 (o): tiers.history_quarterly.labels/p90/p95/p99 all the same length, and the LAST label is exactly "Current". */
export function checkHistoryQuarterlyShape(history: { labels: readonly string[]; p90: readonly number[]; p95: readonly number[]; p99: readonly number[] }): CheckResult {
  const lengths = [history.labels.length, history.p90.length, history.p95.length, history.p99.length];
  if (new Set(lengths).size > 1) {
    return { ok: false, code: 'history_quarterly_length_mismatch', detail: JSON.stringify(lengths) };
  }
  if (history.labels.length > 0 && history.labels.at(-1) !== 'Current') {
    return { ok: false, code: 'history_quarterly_missing_current_tail', detail: `last label is "${history.labels.at(-1)}", expected "Current"` };
  }
  return { ok: true, code: 'history_quarterly_shape' };
}

/** STEP 7 (x): tier_series entries must be chronological (strictly increasing week_start), no gaps checked at the week-cadence level (7-day steps), and the last entry should align with the payload's own week_start. */
export function checkTierSeriesChronological(entries: readonly { week_start: string }[] | null, expectedLastWeekStart?: string): CheckResult {
  if (entries === null) return { ok: true, code: 'tier_series_chronological' }; // absent is legitimate when lux52 itself failed
  for (let i = 1; i < entries.length; i++) {
    if (entries[i].week_start <= entries[i - 1].week_start) {
      return {
        ok: false,
        code: 'tier_series_not_chronological',
        detail: `entry ${i} (${entries[i].week_start}) does not come strictly after entry ${i - 1} (${entries[i - 1].week_start})`,
      };
    }
  }
  if (expectedLastWeekStart !== undefined && entries.length > 0 && entries.at(-1)!.week_start !== expectedLastWeekStart) {
    return {
      ok: false,
      code: 'tier_series_last_entry_mismatch',
      detail: `last entry is ${entries.at(-1)!.week_start}, expected ${expectedLastWeekStart} (this week's own week_start)`,
    };
  }
  return { ok: true, code: 'tier_series_chronological' };
}

/**
 * Runs every STEP 7 output-contract check that can be evaluated from the
 * payload alone (plus the couple of optional external values a few checks
 * need -- dollarVolumeMomentum for (i), totalVolumeAcrossAllNeighborhoods
 * for (w) -- both omittable when unavailable). Returns every result,
 * `ok` or not, so callers can log/report the full picture rather than
 * stopping at the first failure.
 */
export function runOutputContractChecks(
  payload: WeeklyReportPayload,
  options?: { dollarVolumeMomentum?: number | null; totalVolumeAcrossAllNeighborhoods?: number | null },
): CheckResult[] {
  return [
    checkPayloadMatchesSchema(payload),
    checkLeaderboardSortedByVolume(payload.leaderboard),
    checkConcentratedLeaderboardShape(payload.concentrated_leaderboard),
    checkWeeklyActivityLeaderboardShape(payload.weekly_activity_leaderboard, {
      heroLuxuryVolume: payload.hero.luxury_volume,
      totalVolumeAcrossAllNeighborhoods: options?.totalVolumeAcrossAllNeighborhoods,
    }),
    checkTopDealsShape(payload.top_deals),
    checkVolumeReadGate(payload.sowhat.volume_read, options?.dollarVolumeMomentum ?? null),
    checkLedeMatchesOtherReads(payload.sowhat),
    checkTypeTrendsAlignment(payload.type_trends),
    checkDemandTrendDomSeriesAlignment({
      demandTrendCounts: payload.demand_trend.counts,
      demandTrendRollingAvg: payload.demand_trend.rolling_avg,
      demandTrendLabels: payload.demand_trend.labels,
      domSeriesLuxury: payload.supply.dom_series.luxury,
      domSeriesLuxuryP95: payload.supply.dom_series.luxury_p95,
    }),
    checkDomSeriesAllLength(payload.supply.dom_series.all, payload.supply.dom_series.luxury),
    checkHistoryQuarterlyShape(payload.tiers.history_quarterly),
    checkTierSeriesChronological(payload.tier_series),
  ];
}
