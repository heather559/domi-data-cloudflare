/**
 * STEP 1 + STEP 1.6 + STEP 1.8(A) of the ground-truth spec: hero, the three
 * tier cards (luxury/prime/trophy -- minus history_annual/history_quarterly,
 * which live in tiers.ts), and demand_trend/dom_series.luxury/luxury_p95.
 *
 * All of this comes from exactly two Marketproof calls (`lux52`, the
 * trailing-52w luxury-contract-stats response, and `lux52PriorYr`, the same
 * call anchored one year earlier via `end_date`) plus last week's stored
 * values -- zero additional calls, per the spec's own "zero new calls"
 * notes throughout STEP 1.8(A).
 */

import type { LuxuryContractStatsResponse, PercentileLine } from '../fetch/schemas';
import { readTierCount } from '../fetch/schemas';
import type { Hero, TierCard, DemandTrend } from '../schema/weeklyReportPayload';
import { pct } from '../lib/pct';
import { averageField, findByDateStartsWith, lastN, sumField, trailingRollingAverage } from './lib';
import type { PriorWeekValues } from './types';

export interface HistoryAnnual {
  years: number[];
  p90: number[];
  p95: number[];
  p99: number[];
}

export interface Step1Result {
  hero: Hero;
  tierCards: { luxury: TierCard; prime: TierCard; trophy: TierCard };
  demandTrend: DemandTrend;
  historyAnnual: HistoryAnnual;
  /** STEP 5's dom_series.luxury -- same last-26-week p90 slice as demand_trend, zero new calls. */
  domSeriesLuxury: (number | null)[];
  /** STEP 5's dom_series.luxury_p95 -- p95's own avgDaysOnMarket, date-matched to the same 26 weeks. */
  domSeriesLuxuryP95: (number | null)[];
}

const nullHero: Hero = {
  luxury_cutoff: null,
  luxury_count: null,
  luxury_count_wow_pct: null,
  luxury_count_yoy_pct: null,
  luxury_count_vs_lastweek_pct: null,
  luxury_count_avg52: null,
  luxury_volume: null,
  luxury_volume_wow_pct: null,
  luxury_volume_yoy_pct: null,
  luxury_volume_vs_lastweek_pct: null,
  luxury_volume_avg52: null,
  prime_cutoff: null,
  prime_count: null,
  prime_volume: null,
  trophy_cutoff: null,
  trophy_count: null,
  trophy_volume: null,
  median_price: null,
  median_ppsf: null,
  avg_dom: null,
};

const nullTierCard: TierCard = {
  cutoff: null,
  cutoff_wow_pct: null,
  cutoff_yoy_pct: null,
  ppsf_avg: null,
  ppsf_avg_wow_pct: null,
  ppsf_avg_yoy_pct: null,
  cleared_52wk: null,
  cleared_52wk_wow_pct: null,
  cleared_52wk_yoy_pct: null,
  volume_52wk: null,
  volume_52wk_wow_pct: null,
  volume_52wk_yoy_pct: null,
};

/** Per-tier sum of totalPrice across every entry in that tier's own contractsByPeriod window (STEP 1's volume_52wk / STEP 1.6's prior-year volume denominator). */
function tierVolume52wk(line: PercentileLine): number {
  return sumField(line.contractsByPeriod, (e) => e.totalPrice);
}

/** Per-tier average ppsf across that tier's own contractsByPeriod window. */
function tierPpsfAvg(line: PercentileLine): number | null {
  return averageField(line.contractsByPeriod, (e) => e.ppsf);
}

function buildTierCard(
  line: PercentileLine,
  priorYrLine: PercentileLine | null,
  prevCard: TierCard | null,
): TierCard {
  const cutoff = line.cutoff ?? null;
  const clearedNow = readTierCount(line);
  const volumeNow = tierVolume52wk(line);
  const ppsfNow = tierPpsfAvg(line);

  const priorYrCleared = priorYrLine ? readTierCount(priorYrLine) : null;
  const priorYrVolume = priorYrLine ? tierVolume52wk(priorYrLine) : null;
  const priorYrPpsf = priorYrLine ? tierPpsfAvg(priorYrLine) : null;
  const priorYrCutoff = priorYrLine?.cutoff ?? null;

  return {
    cutoff,
    cutoff_wow_pct: prevCard ? pct(cutoff !== null && prevCard.cutoff !== null ? cutoff - prevCard.cutoff : null, prevCard.cutoff) : null,
    cutoff_yoy_pct: pct(cutoff !== null && priorYrCutoff !== null ? cutoff - priorYrCutoff : null, priorYrCutoff),
    ppsf_avg: ppsfNow,
    ppsf_avg_wow_pct: prevCard
      ? pct(ppsfNow !== null && prevCard.ppsf_avg !== null ? ppsfNow - prevCard.ppsf_avg : null, prevCard.ppsf_avg)
      : null,
    ppsf_avg_yoy_pct: pct(ppsfNow !== null && priorYrPpsf !== null ? ppsfNow - priorYrPpsf : null, priorYrPpsf),
    cleared_52wk: clearedNow,
    cleared_52wk_wow_pct: prevCard
      ? pct(clearedNow !== null && prevCard.cleared_52wk !== null ? clearedNow - prevCard.cleared_52wk : null, prevCard.cleared_52wk)
      : null,
    cleared_52wk_yoy_pct: pct(clearedNow !== null && priorYrCleared !== null ? clearedNow - priorYrCleared : null, priorYrCleared),
    volume_52wk: volumeNow,
    volume_52wk_wow_pct: prevCard
      ? pct(volumeNow - (prevCard.volume_52wk ?? NaN), prevCard.volume_52wk)
      : null,
    volume_52wk_yoy_pct: pct(priorYrVolume !== null ? volumeNow - priorYrVolume : null, priorYrVolume),
  };
}

/**
 * Computes hero, the three tier cards, demand_trend, and the two
 * lux52-derived dom_series arrays. Returns the STEP 1 "all null/0" failure
 * shape (per the spec's own fail-handling note) if `lux52` itself is null.
 */
export function computeStep1(
  lux52: LuxuryContractStatsResponse | null,
  lux52PriorYr: LuxuryContractStatsResponse | null,
  prior: Pick<PriorWeekValues, 'prevTiers' | 'prevLuxuryCount' | 'prevLuxuryVolume'>,
  weekStart: string,
): Step1Result {
  if (!lux52) {
    return {
      hero: { ...nullHero },
      tierCards: { luxury: { ...nullTierCard }, prime: { ...nullTierCard }, trophy: { ...nullTierCard } },
      demandTrend: { counts: [], rolling_avg: [], labels: [] },
      historyAnnual: { years: [], p90: [], p95: [], p99: [] },
      domSeriesLuxury: [],
      domSeriesLuxuryP95: [],
    };
  }

  const { p90, p95, p99 } = lux52.lines;
  const priorYrLines = lux52PriorYr?.lines ?? null;

  // --- hero, this week's aligned entry (startsWith match, per STEP 1) ---
  const p90Entry = findByDateStartsWith(p90.contractsByPeriod, weekStart);
  const p95Entry = findByDateStartsWith(p95.contractsByPeriod, weekStart);
  const p99Entry = findByDateStartsWith(p99.contractsByPeriod, weekStart);

  const luxuryCount = p90Entry?.contractCount ?? null;
  const luxuryVolume = p90Entry?.totalPrice ?? null;
  const avgDom = p90Entry?.avgDaysOnMarket ?? null;
  const medianPrice = p90Entry?.medianPrice ?? null;
  const medianPpsf = p90Entry?.ppsf ?? null;
  const primeCount = p95Entry?.contractCount ?? null;
  const trophyCount = p99Entry?.contractCount ?? null;

  // avg52 = mean(contractCount) across the FULL p90 series (not just last 26).
  const avg52Count = averageField(p90.contractsByPeriod, (e) => e.contractCount);
  const avg52Volume = averageField(p90.contractsByPeriod, (e) => e.totalPrice);

  const luxuryCountWowPct = pct(luxuryCount !== null && avg52Count !== null ? luxuryCount - avg52Count : null, avg52Count);
  const luxuryVolumeWowPct = pct(
    luxuryVolume !== null && avg52Volume !== null ? luxuryVolume - avg52Volume : null,
    avg52Volume,
  );

  // STEP 1.6 yoy: lux52PriorYr's own LAST contractsByPeriod entry (its
  // window is anchored via end_date, so its last entry IS the
  // same-week-last-year bucket) -- not a date lookup.
  const priorYrP90Last = priorYrLines ? priorYrLines.p90.contractsByPeriod.at(-1) ?? null : null;
  const luxuryCountYoyPct = pct(
    luxuryCount !== null && priorYrP90Last?.contractCount != null ? luxuryCount - priorYrP90Last.contractCount : null,
    priorYrP90Last?.contractCount ?? null,
  );
  const luxuryVolumeYoyPct = pct(
    luxuryVolume !== null && priorYrP90Last?.totalPrice != null ? luxuryVolume - priorYrP90Last.totalPrice : null,
    priorYrP90Last?.totalPrice ?? null,
  );

  const luxuryCountVsLastWeekPct = pct(
    luxuryCount !== null && prior.prevLuxuryCount !== null ? luxuryCount - prior.prevLuxuryCount : null,
    prior.prevLuxuryCount,
  );
  const luxuryVolumeVsLastWeekPct = pct(
    luxuryVolume !== null && prior.prevLuxuryVolume !== null ? luxuryVolume - prior.prevLuxuryVolume : null,
    prior.prevLuxuryVolume,
  );

  // STEP 1.8(A): prime/trophy volume, date-matched (not "last element").
  const primeVolume = p95Entry?.totalPrice ?? null;
  const trophyVolume = p99Entry?.totalPrice ?? null;

  const hero: Hero = {
    luxury_cutoff: p90.cutoff ?? null,
    luxury_count: luxuryCount,
    luxury_count_wow_pct: luxuryCountWowPct,
    luxury_count_yoy_pct: luxuryCountYoyPct,
    luxury_count_vs_lastweek_pct: luxuryCountVsLastWeekPct,
    luxury_count_avg52: avg52Count,
    luxury_volume: luxuryVolume,
    luxury_volume_wow_pct: luxuryVolumeWowPct,
    luxury_volume_yoy_pct: luxuryVolumeYoyPct,
    luxury_volume_vs_lastweek_pct: luxuryVolumeVsLastWeekPct,
    luxury_volume_avg52: avg52Volume,
    prime_cutoff: p95.cutoff ?? null,
    prime_count: primeCount,
    prime_volume: primeVolume,
    trophy_cutoff: p99.cutoff ?? null,
    trophy_count: trophyCount,
    trophy_volume: trophyVolume,
    median_price: medianPrice,
    median_ppsf: medianPpsf,
    avg_dom: avgDom,
  };

  const tierCards = {
    luxury: buildTierCard(p90, priorYrLines?.p90 ?? null, prior.prevTiers?.luxury ?? null),
    prime: buildTierCard(p95, priorYrLines?.p95 ?? null, prior.prevTiers?.prime ?? null),
    trophy: buildTierCard(p99, priorYrLines?.p99 ?? null, prior.prevTiers?.trophy ?? null),
  };

  // demand_trend + dom_series.luxury/luxury_p95: last 26 p90 periods,
  // chronological, all sharing the SAME date alignment (STEP 1's own note).
  const last26 = lastN(p90.contractsByPeriod, 26);
  // The spec (and the schema's own comment) call for plain "YYYY-MM-DD"
  // labels, but the live Marketproof API returns full ISO datetimes
  // ("2026-03-09T00:00:00Z") for this field -- confirmed via the
  // 2026-09 backfill run against real data. Truncate rather than trust
  // the upstream format; findByDateStartsWith below still matches fine
  // since it does a prefix match against the (untruncated) source series.
  const labels = last26.map((e) => e.date.slice(0, 10));
  const counts = last26.map((e) => e.contractCount ?? null);
  const rollingAvg = trailingRollingAverage(counts, 4);
  const domSeriesLuxury = last26.map((e) => e.avgDaysOnMarket ?? null);
  const domSeriesLuxuryP95 = labels.map((date) => {
    const match = findByDateStartsWith(p95.contractsByPeriod, date);
    return match?.avgDaysOnMarket ?? null;
  });

  // history_annual: years 2021+, index-aligned by year (defensive lookup
  // rather than assuming p90/p95/p99 history arrays share identical length).
  const history = lux52.history;
  const yearsSet = new Set<number>();
  for (const line of [history?.p90, history?.p95, history?.p99]) {
    for (const entry of line ?? []) {
      if (entry.year >= 2021) yearsSet.add(entry.year);
    }
  }
  const years = [...yearsSet].sort((a, b) => a - b);
  const byYear = (line: typeof history extends undefined ? never : NonNullable<typeof history>['p90'] | undefined) => {
    const map = new Map((line ?? []).map((e) => [e.year, e.cutoff ?? null]));
    return years.map((y) => map.get(y) ?? null);
  };
  // The zod schema models history_annual.p90/p95/p99 as non-nullable number
  // arrays (matching every real stored payload seen -- every year 2021+ has
  // a real cutoff on all three lines). A missing cutoff for some year would
  // be a genuine upstream data gap the spec never anticipates; falling back
  // to 0 here (rather than throwing) keeps the array shape intact for a
  // case that in practice has never been observed.
  const historyAnnual: HistoryAnnual = {
    years,
    p90: (byYear(history?.p90) as (number | null)[]).map((v) => v ?? 0),
    p95: (byYear(history?.p95) as (number | null)[]).map((v) => v ?? 0),
    p99: (byYear(history?.p99) as (number | null)[]).map((v) => v ?? 0),
  };

  return {
    hero,
    tierCards,
    demandTrend: { counts, rolling_avg: rollingAvg, labels },
    historyAnnual,
    domSeriesLuxury,
    domSeriesLuxuryP95,
  };
}
