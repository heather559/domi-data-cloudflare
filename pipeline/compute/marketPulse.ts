/**
 * STEP 2 + STEP 3: market_pulse (all + by_type), type_trends, and
 * bedroom_mix. STEP 2's own single weekly-contract-stats call feeds all of
 * market_pulse.all, the contracts/contracts_volume half of by_type, the
 * full type_trends.contracts_count/contracts_volume series, and
 * bedroom_mix. STEP 3's weekly-sales-stats call feeds the recorded-sale
 * half of by_type (recorded_sales/ppsf/discount_pct/dom) and
 * type_trends.sales_*.
 */

import type { ContractPeriodEntry, WeeklyContractStatsResponse, WeeklySalesStatsResponse } from '../fetch/schemas';
import type { BedroomMix, ByTypeEntry, MarketPulse, TypeTrends } from '../schema/weeklyReportPayload';
import { pct } from '../lib/pct';
import { addDaysIso, averageField, findByDateStartsWith, lastNAsOf } from './lib';
import type { PriorWeekValues } from './types';

/** Some endpoints name the per-period contract count `contractCount`, others `salesCount` -- read whichever is present, per the same ambiguity already flagged in fetch/schemas.ts for `readTierCount`. */
function readCount(entry: ContractPeriodEntry | null | undefined): number | null {
  if (!entry) return null;
  return entry.contractCount ?? entry.salesCount ?? null;
}

/** weekly-contract-stats/luxury-contract-stats name this `avgDaysOnMarket`; weekly-sales-stats' salesByWeek entries were CONFIRMED (live 2026-09-19 backfill run) to instead call it `avgDaysToContract` -- read whichever is present, same alternate-name pattern as readCount above. */
function readDom(entry: ContractPeriodEntry | null | undefined): number | null {
  if (!entry) return null;
  return entry.avgDaysOnMarket ?? entry.avgDaysToContract ?? null;
}

/** Nearest-date match within a chronological series -- used for the yoy lookup (~364 days back), which the spec allows to be a "nearest week-aligned match" rather than requiring an exact date. */
function findNearestByDate(entries: readonly ContractPeriodEntry[], targetIso: string): ContractPeriodEntry | null {
  if (entries.length === 0) return null;
  let best = entries[0];
  let bestDiff = Math.abs(Date.parse(entries[0].date) - Date.parse(targetIso));
  for (const e of entries) {
    const diff = Math.abs(Date.parse(e.date) - Date.parse(targetIso));
    if (diff < bestDiff) {
      best = e;
      bestDiff = diff;
    }
  }
  // Don't accept a "nearest" match more than ~10 days off -- that's not a real year-ago week, it's the series simply not reaching back far enough.
  return bestDiff <= 10 * 24 * 60 * 60 * 1000 ? best : null;
}

function computeWowYoy(arr: readonly (number | null)[]): { wow: number | null; yoy: number | null } {
  if (arr.length < 2) return { wow: null, yoy: null };
  const last = arr.at(-1) ?? null;
  const prev = arr.at(-2) ?? null;
  const first = arr[0] ?? null;
  return {
    wow: pct(last !== null && prev !== null ? last - prev : null, prev),
    yoy: pct(last !== null && first !== null ? last - first : null, first),
  };
}

const emptyByTypeEntry: ByTypeEntry = {
  contracts: null,
  contracts_wow_pct: null,
  contracts_yoy_pct: null,
  contracts_volume: null,
  contracts_volume_wow_pct: null,
  contracts_volume_yoy_pct: null,
  recorded_sales: null,
  recorded_sales_wow_pct: null,
  recorded_sales_yoy_pct: null,
  ppsf: null,
  ppsf_wow_pct: null,
  ppsf_yoy_pct: null,
  discount_pct: null,
  discount_pct_wow_pct: null,
  discount_pct_yoy_pct: null,
  dom: null,
  dom_wow_pct: null, // documented gap -- no weekly series exists to derive this from (STEP 3 note)
  dom_yoy_pct: null,
};

export interface MarketPulseResult {
  marketPulse: MarketPulse;
  typeTrends: TypeTrends;
  bedroomMix: BedroomMix;
}

const PROPERTY_TYPES = ['condo', 'coop', 'townhouse'] as const;
// Raw API bucket key naming (plural) vs. payload key naming (singular).
const RAW_BUCKET_KEY: Record<(typeof PROPERTY_TYPES)[number], 'condos' | 'coops' | 'townhouses'> = {
  condo: 'condos',
  coop: 'coops',
  townhouse: 'townhouses',
};

export function computeMarketPulseAndTypeTrends(
  weeklyContractStats: WeeklyContractStatsResponse | null,
  weeklySalesStats: WeeklySalesStatsResponse | null,
  prior: Pick<PriorWeekValues, 'prevPulseAll'>,
  weekStart: string,
): MarketPulseResult {
  if (!weeklyContractStats) {
    const emptyByType = { condo: { ...emptyByTypeEntry }, coop: { ...emptyByTypeEntry }, townhouse: { ...emptyByTypeEntry } };
    const emptyByTypeArrays = { condo: [], coop: [], townhouse: [] };
    return {
      marketPulse: {
        all: {
          contracts: null,
          contracts_wow_pct: null,
          contracts_yoy_pct: null,
          contracts_avg52: null,
          contracts_vs_lastweek_pct: null,
          volume: null,
          volume_wow_pct: null,
          volume_yoy_pct: null,
          volume_avg52: null,
          volume_vs_lastweek_pct: null,
        },
        by_type: emptyByType,
      },
      typeTrends: {
        labels: [],
        contracts_count: emptyByTypeArrays,
        contracts_volume: emptyByTypeArrays,
        sales_avgprice: emptyByTypeArrays,
        sales_discount: emptyByTypeArrays,
        sales_ppsf: emptyByTypeArrays,
        sales_count: emptyByTypeArrays,
        sales_volume: emptyByTypeArrays,
      },
      bedroomMix: {
        volume: { studio: null, '1': null, '2': null, '3': null, '4+': null },
        count: { studio: null, '1': null, '2': null, '3': null, '4+': null },
      },
    };
  }

  // --- market_pulse.all ---
  const allSeries = weeklyContractStats.all?.contractsByWeek ?? [];
  const weekAlignedAll = findByDateStartsWith(allSeries, weekStart);
  const contracts = readCount(weekAlignedAll);
  const volume = weekAlignedAll?.totalPrice ?? null;
  const contractsAvg52 = averageField(allSeries, readCount);
  const volumeAvg52 = averageField(allSeries, (e) => e.totalPrice);
  const contractsWowPct = pct(contracts !== null && contractsAvg52 !== null ? contracts - contractsAvg52 : null, contractsAvg52);
  const volumeWowPct = pct(volume !== null && volumeAvg52 !== null ? volume - volumeAvg52 : null, volumeAvg52);
  const contractsVsLastWeekPct = pct(
    contracts !== null && prior.prevPulseAll?.contracts != null ? contracts - prior.prevPulseAll.contracts : null,
    prior.prevPulseAll?.contracts ?? null,
  );
  const volumeVsLastWeekPct = pct(
    volume !== null && prior.prevPulseAll?.volume != null ? volume - prior.prevPulseAll.volume : null,
    prior.prevPulseAll?.volume ?? null,
  );
  const yearAgoDate = addDaysIso(weekStart, -364);
  const yearAgoEntry = findNearestByDate(allSeries, yearAgoDate);
  const contractsYoyPct = pct(
    contracts !== null && readCount(yearAgoEntry) !== null ? contracts - (readCount(yearAgoEntry) as number) : null,
    readCount(yearAgoEntry),
  );
  const volumeYoyPct = pct(
    volume !== null && yearAgoEntry?.totalPrice != null ? volume - yearAgoEntry.totalPrice : null,
    yearAgoEntry?.totalPrice ?? null,
  );

  // --- type_trends: labels from whichever bucket has the fullest series (prefer "all"). ---
  const labelSourceSeries = allSeries.length > 0 ? allSeries : (weeklyContractStats.condos?.contractsByWeek ?? []);
  // weekly-contract-stats was confirmed (live 2026-09 backfill run) to
  // ignore its own `end_date` param and always return its series through
  // "today" -- taking a blind `lastN` tail here would silently pull labels
  // from weeks AFTER this historical week during backfill (verified: it did,
  // by as much as ~10 weeks). `lastNAsOf` filters to <= weekStart first, so
  // this is a no-op in the live run (weekStart already IS the series' real
  // end there) and correct during backfill. Also truncate to plain
  // "YYYY-MM-DD" -- same live-API ISO-datetime quirk as hero.ts's
  // demand_trend.labels (see that comment for detail). The alignedSeries
  // lookup below still matches correctly against the untruncated source
  // series via findByDateStartsWith's prefix match.
  const labels = lastNAsOf(labelSourceSeries, 52, weekStart).map((e) => e.date.slice(0, 10));

  function alignedSeries(bucket: ContractPeriodEntry[] | undefined, field: (e: ContractPeriodEntry) => number | null | undefined): (number | null)[] {
    return labels.map((date) => {
      const entry = bucket ? findByDateStartsWith(bucket, date) : null;
      const v = entry ? field(entry) : null;
      return v === undefined ? null : v;
    });
  }

  const contractsCount = {
    condo: alignedSeries(weeklyContractStats.condos?.contractsByWeek, readCount),
    coop: alignedSeries(weeklyContractStats.coops?.contractsByWeek, readCount),
    townhouse: alignedSeries(weeklyContractStats.townhouses?.contractsByWeek, readCount),
  };
  const contractsVolume = {
    condo: alignedSeries(weeklyContractStats.condos?.contractsByWeek, (e) => e.totalPrice),
    coop: alignedSeries(weeklyContractStats.coops?.contractsByWeek, (e) => e.totalPrice),
    townhouse: alignedSeries(weeklyContractStats.townhouses?.contractsByWeek, (e) => e.totalPrice),
  };

  // weekly-sales-stats: type-split detection -- if none of condos/coops/townhouses carry a salesByWeek array, treat as "not type-split" and fill sales_* with nulls (never omit the keys).
  const isSalesTypeSplit =
    !!weeklySalesStats &&
    ((weeklySalesStats.condos?.salesByWeek?.length ?? 0) > 0 ||
      (weeklySalesStats.coops?.salesByWeek?.length ?? 0) > 0 ||
      (weeklySalesStats.townhouses?.salesByWeek?.length ?? 0) > 0);

  const nullSeries = () => labels.map(() => null);
  const salesAvgprice = isSalesTypeSplit
    ? {
        condo: alignedSeries(weeklySalesStats!.condos?.salesByWeek, (e) => e.averagePrice),
        coop: alignedSeries(weeklySalesStats!.coops?.salesByWeek, (e) => e.averagePrice),
        townhouse: alignedSeries(weeklySalesStats!.townhouses?.salesByWeek, (e) => e.averagePrice),
      }
    : { condo: nullSeries(), coop: nullSeries(), townhouse: nullSeries() };
  const salesDiscount = isSalesTypeSplit
    ? {
        condo: alignedSeries(weeklySalesStats!.condos?.salesByWeek, (e) => e.discount),
        coop: alignedSeries(weeklySalesStats!.coops?.salesByWeek, (e) => e.discount),
        townhouse: alignedSeries(weeklySalesStats!.townhouses?.salesByWeek, (e) => e.discount),
      }
    : { condo: nullSeries(), coop: nullSeries(), townhouse: nullSeries() };
  const salesPpsf = isSalesTypeSplit
    ? {
        condo: alignedSeries(weeklySalesStats!.condos?.salesByWeek, (e) => e.ppsf),
        coop: alignedSeries(weeklySalesStats!.coops?.salesByWeek, (e) => e.ppsf),
        townhouse: alignedSeries(weeklySalesStats!.townhouses?.salesByWeek, (e) => e.ppsf),
      }
    : { condo: nullSeries(), coop: nullSeries(), townhouse: nullSeries() };
  const salesCount = isSalesTypeSplit
    ? {
        condo: alignedSeries(weeklySalesStats!.condos?.salesByWeek, readCount),
        coop: alignedSeries(weeklySalesStats!.coops?.salesByWeek, readCount),
        townhouse: alignedSeries(weeklySalesStats!.townhouses?.salesByWeek, readCount),
      }
    : { condo: nullSeries(), coop: nullSeries(), townhouse: nullSeries() };
  const salesVolume = isSalesTypeSplit
    ? {
        condo: alignedSeries(weeklySalesStats!.condos?.salesByWeek, (e) => e.totalPrice),
        coop: alignedSeries(weeklySalesStats!.coops?.salesByWeek, (e) => e.totalPrice),
        townhouse: alignedSeries(weeklySalesStats!.townhouses?.salesByWeek, (e) => e.totalPrice),
      }
    : { condo: nullSeries(), coop: nullSeries(), townhouse: nullSeries() };

  const typeTrends: TypeTrends = {
    labels,
    contracts_count: contractsCount,
    contracts_volume: contractsVolume,
    sales_avgprice: salesAvgprice,
    sales_discount: salesDiscount,
    sales_ppsf: salesPpsf,
    sales_count: salesCount,
    sales_volume: salesVolume,
  };

  // --- by_type ---
  const byType = Object.fromEntries(
    PROPERTY_TYPES.map((type) => {
      const rawKey = RAW_BUCKET_KEY[type];
      const contractBucket = weeklyContractStats[rawKey]?.contractsByWeek;
      const weekAlignedContract = contractBucket ? findByDateStartsWith(contractBucket, weekStart) : null;
      const typeContracts = readCount(weekAlignedContract);
      const typeContractsVolume = weekAlignedContract?.totalPrice ?? null;

      const contractsDelta = computeWowYoy(contractsCount[type]);
      const contractsVolumeDelta = computeWowYoy(contractsVolume[type]);

      const salesBucket = isSalesTypeSplit ? weeklySalesStats![rawKey]?.salesByWeek : undefined;
      const weekAlignedSales = salesBucket ? findByDateStartsWith(salesBucket, weekStart) : null;
      const recordedSales = weekAlignedSales ? readCount(weekAlignedSales) : null;
      const ppsf = weekAlignedSales?.ppsf ?? null;
      const discountPct = weekAlignedSales?.discount ?? null;
      const dom = readDom(weekAlignedSales);

      const recordedSalesDelta = computeWowYoy(salesCount[type]);
      const ppsfDelta = computeWowYoy(salesPpsf[type]);
      const discountDelta = computeWowYoy(salesDiscount[type]);

      const entry: ByTypeEntry = {
        contracts: typeContracts,
        contracts_wow_pct: contractsDelta.wow,
        contracts_yoy_pct: contractsDelta.yoy,
        contracts_volume: typeContractsVolume,
        contracts_volume_wow_pct: contractsVolumeDelta.wow,
        contracts_volume_yoy_pct: contractsVolumeDelta.yoy,
        recorded_sales: recordedSales,
        recorded_sales_wow_pct: recordedSalesDelta.wow,
        recorded_sales_yoy_pct: recordedSalesDelta.yoy,
        ppsf,
        ppsf_wow_pct: ppsfDelta.wow,
        ppsf_yoy_pct: ppsfDelta.yoy,
        discount_pct: discountPct,
        discount_pct_wow_pct: discountDelta.wow,
        discount_pct_yoy_pct: discountDelta.yoy,
        dom,
        dom_wow_pct: null,
        dom_yoy_pct: null,
      };
      return [type, entry];
    }),
  ) as MarketPulse['by_type'];

  const marketPulse: MarketPulse = {
    all: {
      contracts,
      contracts_wow_pct: contractsWowPct,
      contracts_yoy_pct: contractsYoyPct,
      contracts_avg52: contractsAvg52,
      contracts_vs_lastweek_pct: contractsVsLastWeekPct,
      volume,
      volume_wow_pct: volumeWowPct,
      volume_yoy_pct: volumeYoyPct,
      volume_avg52: volumeAvg52,
      volume_vs_lastweek_pct: volumeVsLastWeekPct,
    },
    by_type: byType,
  };

  // --- bedroom_mix (metric-first: volume/count, each keyed by bucket) ---
  const bedsEntry = weeklyContractStats.contractsByBeds
    ? findByDateStartsWith(weeklyContractStats.contractsByBeds, weekStart)
    : null;
  const bedroomMix = buildBedroomMix(bedsEntry?.unitMix ?? null);

  return { marketPulse, typeTrends, bedroomMix };
}

function bedroomBucketKey(bedrooms: string | number | null | undefined): 'studio' | '1' | '2' | '3' | '4+' | null {
  if (bedrooms === null || bedrooms === undefined) return null;
  if (typeof bedrooms === 'number') {
    if (bedrooms === 0) return 'studio';
    if (bedrooms >= 4) return '4+';
    if (bedrooms >= 1 && bedrooms <= 3) return String(bedrooms) as '1' | '2' | '3';
    return null;
  }
  const normalized = bedrooms.trim().toLowerCase();
  if (normalized === 'studio' || normalized === '0') return 'studio';
  if (normalized === '4+' || normalized === '4') return '4+';
  if (normalized === '1' || normalized === '2' || normalized === '3') return normalized as '1' | '2' | '3';
  return null;
}

function buildBedroomMix(unitMix: { bedrooms?: string | number | null; salesCount?: number | null; dollarVolume?: number | null }[] | null): BedroomMix {
  const emptyBuckets = { studio: null, '1': null, '2': null, '3': null, '4+': null } as Record<string, number | null>;
  if (!unitMix) {
    return { volume: { ...emptyBuckets }, count: { ...emptyBuckets } } as BedroomMix;
  }

  const countBuckets: Record<string, number> = { studio: 0, '1': 0, '2': 0, '3': 0, '4+': 0 };
  const volumeBuckets: Record<string, number> = { studio: 0, '1': 0, '2': 0, '3': 0, '4+': 0 };

  for (const entry of unitMix) {
    const key = bedroomBucketKey(entry.bedrooms);
    if (!key) continue; // unrecognized bucket -- dropped, accounted for by the bedroom-mix sum-tolerance check (STEP 7.5(d))
    countBuckets[key] += entry.salesCount ?? 0;
    volumeBuckets[key] += entry.dollarVolume ?? 0;
  }

  return { volume: volumeBuckets, count: countBuckets } as BedroomMix;
}
