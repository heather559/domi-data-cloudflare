/**
 * STEP 5 -- supply (all/luxury/prime active-listing figures, supply_series,
 * and dom_series). Three independent Marketproof `supply` calls (no
 * min_price / min_price=p90 cutoff / min_price=p95 cutoff) feed `active` +
 * `supply_series`; the wow/yoy pace-based fields reuse `lux52`,
 * `lux52PriorYr`, and market_pulse's own weekly-contract-stats series --
 * all "zero new calls" per the spec's own repeated notes.
 */

import type { ContractPeriodEntry, LuxuryContractStatsResponse, SupplyResponse, WeeklySalesStatsResponse } from '../fetch/schemas';
import type { Supply } from '../schema/weeklyReportPayload';
import { pct } from '../lib/pct';
import { averageField, findByDateStartsWith } from './lib';

function readCount(entry: ContractPeriodEntry | null | undefined): number | null {
  if (!entry) return null;
  return entry.contractCount ?? entry.salesCount ?? null;
}

/** absorption_pct = (1 / months_supply) * 100 -- null (never a divide-by-zero) when months_supply is null or 0. */
function absorptionPct(monthsSupply: number | null): number | null {
  if (monthsSupply === null || monthsSupply === 0) return null;
  return (1 / monthsSupply) * 100;
}

function monthsSupply(active: number | null, weeklyPace: number | null): number | null {
  if (active === null || weeklyPace === null || weeklyPace === 0) return null;
  return active / (weeklyPace * 4.33);
}

/** active_wow_pct / active_yoy_pct from a series' own last two / first-and-last points -- zero new calls. */
function seriesWowYoy(series: readonly number[]): { wow: number | null; yoy: number | null } {
  if (series.length < 2) return { wow: null, yoy: null };
  const last = series.at(-1)!;
  const prev = series.at(-2)!;
  const first = series[0];
  return {
    wow: pct(last - prev, prev),
    yoy: pct(last - first, first),
  };
}

export interface ComputeSupplyInputs {
  supplyAll: SupplyResponse | null;
  supplyLuxury: SupplyResponse | null;
  supplyPrime: SupplyResponse | null;
  lux52: LuxuryContractStatsResponse | null;
  lux52PriorYr: LuxuryContractStatsResponse | null;
  /** weeklyContractStats.all.contractsByWeek, STEP 2's own series -- reused here for ALL's pace-based wow/yoy, zero new calls. */
  marketPulseAllSeries: readonly ContractPeriodEntry[];
  /** market_pulse.all.contracts_avg52, already computed -- the "pace_all_now" denominator STEP 5 reuses for both supply.all.months_supply and its yoy approximation. */
  marketPulseAllContractsAvg52: number | null;
  /** STEP 1's last-26-week p90 avgDaysOnMarket slice (dom_series.luxury) -- zero new calls, computed in hero.ts. */
  domSeriesLuxury: readonly (number | null)[];
  /** STEP 1's last-26-week p95 avgDaysOnMarket slice (dom_series.luxury_p95) -- zero new calls, computed in hero.ts. */
  domSeriesLuxuryP95: readonly (number | null)[];
  /** demand_trend.labels -- the 26 dates dom_series.all must align to. */
  demandTrendLabels: readonly string[];
  weeklySalesStats: WeeklySalesStatsResponse | null;
}

function buildDomSeriesAll(labels: readonly string[], weeklySalesStats: WeeklySalesStatsResponse | null): (number | null)[] {
  return labels.map((date) => {
    const pooled = weeklySalesStats?.all?.salesByWeek ? findByDateStartsWith(weeklySalesStats.all.salesByWeek, date) : null;
    if (pooled?.avgDaysOnMarket != null) return pooled.avgDaysOnMarket;

    // No pooled "all" bucket -- attempt a salesCount-weighted average across condos/coops/townhouses for this week.
    const buckets = [weeklySalesStats?.condos, weeklySalesStats?.coops, weeklySalesStats?.townhouses];
    let weightedSum = 0;
    let totalWeight = 0;
    for (const bucket of buckets) {
      const entry = bucket?.salesByWeek ? findByDateStartsWith(bucket.salesByWeek, date) : null;
      const dom = entry?.avgDaysOnMarket;
      const weight = readCount(entry ?? null);
      if (dom != null && weight != null && weight > 0) {
        weightedSum += dom * weight;
        totalWeight += weight;
      }
    }
    return totalWeight > 0 ? weightedSum / totalWeight : null;
  });
}

export function computeSupply(inputs: ComputeSupplyInputs): Supply {
  const allSeries = (inputs.supplyAll?.series ?? []).map((e) => e.supply ?? null).filter((v): v is number => v !== null);
  const luxurySeries = (inputs.supplyLuxury?.series ?? []).map((e) => e.supply ?? null).filter((v): v is number => v !== null);
  const primeSeries = (inputs.supplyPrime?.series ?? []).map((e) => e.supply ?? null).filter((v): v is number => v !== null);

  const activeAll = allSeries.at(-1) ?? null;
  const activeLuxury = luxurySeries.at(-1) ?? null;
  const activePrime = primeSeries.at(-1) ?? null;

  const p90 = inputs.lux52?.lines.p90.contractsByPeriod ?? [];
  const p95 = inputs.lux52?.lines.p95.contractsByPeriod ?? [];
  const paceLuxNow = averageField(p90, (e) => e.contractCount); // == hero.luxury_count_avg52
  const pacePrimeNow = averageField(p95, (e) => e.contractCount);
  const paceAllNow = inputs.marketPulseAllContractsAvg52;

  const monthsSupplyLuxury = monthsSupply(activeLuxury, paceLuxNow);
  const monthsSupplyPrime = monthsSupply(activePrime, pacePrimeNow);
  const monthsSupplyAll = monthsSupply(activeAll, paceAllNow);

  const absorptionLuxury = absorptionPct(monthsSupplyLuxury);
  const absorptionPrime = absorptionPct(monthsSupplyPrime);
  const absorptionAll = absorptionPct(monthsSupplyAll);

  const luxuryWowYoy = seriesWowYoy(luxurySeries);
  const allWowYoy = seriesWowYoy(allSeries);

  // --- LUXURY months_supply/absorption wow (pace one week earlier, from lux52 excluding its own last entry) ---
  let luxuryMonthsSupplyWowPct: number | null = null;
  let luxuryAbsorptionWowPct: number | null = null;
  if (p90.length >= 2 && luxurySeries.length >= 2) {
    const paceLuxWow = averageField(p90.slice(0, -1), (e) => e.contractCount);
    const monthsSupplyWow = monthsSupply(luxurySeries.at(-2) ?? null, paceLuxWow);
    if (monthsSupplyWow !== null) {
      luxuryMonthsSupplyWowPct = pct(monthsSupplyLuxury !== null ? monthsSupplyLuxury - monthsSupplyWow : null, monthsSupplyWow);
      const absorptionWow = absorptionPct(monthsSupplyWow);
      luxuryAbsorptionWowPct = pct(absorptionLuxury !== null && absorptionWow !== null ? absorptionLuxury - absorptionWow : null, absorptionWow);
    }
  }

  // --- LUXURY months_supply/absorption yoy (pace from lux52PriorYr's full series, vs. the oldest point in the current 52-week supply series) ---
  let luxuryMonthsSupplyYoyPct: number | null = null;
  let luxuryAbsorptionYoyPct: number | null = null;
  const priorYrP90 = inputs.lux52PriorYr?.lines.p90.contractsByPeriod ?? null;
  if (priorYrP90 && priorYrP90.length > 0 && luxurySeries.length >= 1) {
    const paceLuxYoy = averageField(priorYrP90, (e) => e.contractCount);
    const monthsSupplyYoy = monthsSupply(luxurySeries[0] ?? null, paceLuxYoy);
    if (monthsSupplyYoy !== null) {
      luxuryMonthsSupplyYoyPct = pct(monthsSupplyLuxury !== null ? monthsSupplyLuxury - monthsSupplyYoy : null, monthsSupplyYoy);
      const absorptionYoy = absorptionPct(monthsSupplyYoy);
      luxuryAbsorptionYoyPct = pct(absorptionLuxury !== null && absorptionYoy !== null ? absorptionLuxury - absorptionYoy : null, absorptionYoy);
    }
  }

  // --- ALL months_supply/absorption wow (pace_all_wow = mean(salesCount) over the 52 entries ending one week before the last) ---
  let allMonthsSupplyWowPct: number | null = null;
  let allAbsorptionWowPct: number | null = null;
  const mpAll = inputs.marketPulseAllSeries;
  if (mpAll.length >= 53 && allSeries.length >= 2) {
    const windowEntries = mpAll.slice(mpAll.length - 53, mpAll.length - 1); // 52 entries, ending one before last
    const paceAllWow = averageField(windowEntries, readCount);
    const monthsSupplyWow = monthsSupply(allSeries.at(-2) ?? null, paceAllWow);
    if (monthsSupplyWow !== null) {
      allMonthsSupplyWowPct = pct(monthsSupplyAll !== null ? monthsSupplyAll - monthsSupplyWow : null, monthsSupplyWow);
      const absorptionWow = absorptionPct(monthsSupplyWow);
      allAbsorptionWowPct = pct(absorptionAll !== null && absorptionWow !== null ? absorptionAll - absorptionWow : null, absorptionWow);
    }
  }

  // --- ALL months_supply/absorption yoy (disclosed approximation: hold today's pace constant, only the active-listing count changes) ---
  let allMonthsSupplyYoyPct: number | null = null;
  let allAbsorptionYoyPct: number | null = null;
  if (allSeries.length >= 1 && paceAllNow !== null) {
    const monthsSupplyYoy = monthsSupply(allSeries[0] ?? null, paceAllNow);
    if (monthsSupplyYoy !== null) {
      allMonthsSupplyYoyPct = pct(monthsSupplyAll !== null ? monthsSupplyAll - monthsSupplyYoy : null, monthsSupplyYoy);
      const absorptionYoy = absorptionPct(monthsSupplyYoy);
      allAbsorptionYoyPct = pct(absorptionAll !== null && absorptionYoy !== null ? absorptionAll - absorptionYoy : null, absorptionYoy);
    }
  }

  const domSeriesAll = buildDomSeriesAll(inputs.demandTrendLabels, inputs.weeklySalesStats);

  return {
    luxury: {
      active: activeLuxury,
      active_wow_pct: luxuryWowYoy.wow,
      active_yoy_pct: luxuryWowYoy.yoy,
      months_supply: monthsSupplyLuxury,
      months_supply_wow_pct: luxuryMonthsSupplyWowPct,
      months_supply_yoy_pct: luxuryMonthsSupplyYoyPct,
      absorption_pct: absorptionLuxury,
      absorption_pct_wow_pct: luxuryAbsorptionWowPct,
      absorption_pct_yoy_pct: luxuryAbsorptionYoyPct,
    },
    prime: {
      active: activePrime,
      months_supply: monthsSupplyPrime,
      absorption_pct: absorptionPrime,
      active_yoy_pct: seriesWowYoy(primeSeries).yoy,
    },
    all: {
      active: activeAll,
      active_wow_pct: allWowYoy.wow,
      active_yoy_pct: allWowYoy.yoy,
      months_supply: monthsSupplyAll,
      months_supply_wow_pct: allMonthsSupplyWowPct,
      months_supply_yoy_pct: allMonthsSupplyYoyPct,
      absorption_pct: absorptionAll,
      absorption_pct_wow_pct: allAbsorptionWowPct,
      absorption_pct_yoy_pct: allAbsorptionYoyPct,
    },
    supply_series: {
      luxury: luxurySeries,
      prime: primeSeries,
      all: allSeries,
    },
    dom_series: {
      luxury: [...inputs.domSeriesLuxury],
      luxury_p95: [...inputs.domSeriesLuxuryP95],
      all: domSeriesAll,
    },
  };
}
