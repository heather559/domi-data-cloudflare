/**
 * Structural consistency checks, ported from site-data-agent's STEP 7.5 and
 * site-data-monitor-agent's "SECOND, INDEPENDENT consistency pass" (checks
 * a-e in the monitor spec). These are pure functions -- no I/O, no Supabase,
 * no Slack -- returning a structured result so callers (the future
 * compute/write layer, and the monitor service) can decide what to do with a
 * failure rather than this module deciding how to report it.
 *
 * Phase 1 note: these are wired up and unit-tested now, but nothing in this
 * phase's index.ts calls them yet -- there is no real payload to check until
 * Phase 2/3 land the Marketproof data pulls. They exist now so the schema
 * and its guardrails are proven before real business logic is layered on top.
 */

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
