import { createServerFn } from "@tanstack/react-start";
import {
  computeNeighborhoodRankSowhat,
  MIN_QUALIFIED_LUX_CONTRACTS,

  computeSupplyLeverageSowhat,
  computeDaysOnMarketSowhat,
  computeHeroContractsSowhat,
  computeHeroVolumeSowhat,
  computeCrossMetricSowhat,
  computeUnitMixSowhat,
  smallSampleString,
  PROVISIONAL_STRING,
  SMALL_SAMPLE_FLOOR,
} from "@/lib/sowhat";
import { normalizeBedSeries } from "@/lib/bedroom-labels";


export interface NeighborhoodReport {
  payload: NeighborhoodPayload;
  computed: {
    rankSowhat: string;
    supplySowhat: string;
    domSowhat: string;
    heroContractsNote: string;
    heroVolumeNote: string;
    crossMetricSowhat: string;
    unitMixSowhat: string;
    smallSampleNote: string | null; // for hero if count < floor
    provisionalString: string;
    smallSampleFloor: number;
  };
  period: string;
}

// Payload shape (mirrors seed row).
export interface NeighborhoodPayload {
  geo: string;
  periodLabel: string;
  provisionalDayCutoff: string;
  hero: {
    luxuryContractsCount: number;
    luxuryContracts3moAvg: number;
    luxuryContracts12moAvg: number;
    luxuryContracts12moAvgYearAgo: number;
    luxuryVolumeDisplay: string;
    luxuryVolume3moAvgDisplay: string;
    luxuryVolume12moAvgDisplay: string;
    luxuryVolume12moAvgYearAgoDisplay: string;
    volumeNote: string;
    crossMetricCallout: string;
  };
  weekStats: {
    clearedPrime: number;
    clearedPrimePriorMonth?: number;
    primeCutoffDisplay: string;
    clearedTrophy: number;
    clearedTrophyPriorMonth?: number;
    trophyCutoffDisplay: string;
    medianLuxuryDealDisplay: string;
    medianLuxuryDealPriorDisplay?: string;
    medianPsfDisplay: string;
    medianPsfPriorDisplay?: string;
    avgDaysOnMarket: number;
    avgDaysOnMarketPrior?: number;
  };
  demandChart: {
    labels: string[];
    counts: number[];
    rolling3: number[];
    lastIndex: number;
    maxV: number;
    luxuryThresholdDisplay: string;
  };
  tiers: {
    luxury: TierBlock;
    prime: TierBlock;
    trophy: TierBlock;
  };
  topDeals: {
    address: string;
    priceDisplay: string;
    building: string;
    beds: number;
    sqft: number;
    ppsfDisplay: string;
    dom: number | null;
    propertyType: string | null;
  }[];
  localLine: { priceDisplay: string; pctAboveDisplay: string };
  tierHistoryChart: {
    years: string[];
    series: { label: string; color: string; data: number[] }[];
  };
  pulse: {
    badge: { text: string; class: string };
    signedContracts: number;
    signedContractsDeltaDisplay: string;
    signedContractsDeltaClass: string;
    signedContractsAvg: string;
    dollarVolumeDisplay: string;
    dollarVolumeDeltaDisplay: string;
    dollarVolumeDeltaClass: string;
    dollarVolumeAvg: string;
    signedContractsMomDisplay?: string;
    signedContractsMomClass?: string;
    signedContractsYoyDisplay?: string;
    signedContractsYoyClass?: string;
    dollarVolumeMomDisplay?: string;
    dollarVolumeMomClass?: string;
    dollarVolumeYoyDisplay?: string;
    dollarVolumeYoyClass?: string;
    columns: Record<string, PulseColumn>;
  };
  bedroomMix: {
    totalDollarVolumeDisplay: string;
    totalContracts: number;
    volumeData: { label: string; value: number; fmt: string }[];
    countData: { label: string; value: number; fmt: string }[];
  };
  rank: {
    manhattanRank: number;
    rankChangeNote: string;
    rankChangeStrong: string;
    rankChangeClass: string;
    luxurySharePct: number;
    luxuryShareCountsDisplay: string;
    localLineDisplay: string;
    localLine: number;
    boroughCutDisplay: string;
    boroughCut: number;
    localLinePriorYear: number | null;
    boroughCutPriorYear?: number | null;
    boroughCutPriorYearDisplay?: string;
    boroughLuxuryMedian?: number;
    boroughLuxuryMedianDisplay?: string;

    nextNeighborhood: string | null;
    nextPct: number | null;

    // Injected at read time from the weekly luxury leaderboard.
    volumeRank?: number | null;
    volumeRankTotal?: number | null;
    volumeRankChangeStrong?: string | null;
    volumeRankChangeNote?: string | null;
    volumeRankChangeClass?: string | null;
  };
  supply: {
    luxury: SupplyBlock;
    all: SupplyBlock;
    boroughMonthsOfSupply: number;
  };
  absorptionChart: {
    labels: string[];
    data: number[];
    maxV: number;
    sublabel: string;
  };
  supplyChart: {
    data: number[];
    maxV: number;
    current: number;
    months: string[];
  };
  domChart: {
    labels: string[];
    data: (number | null)[];
    maxV: number;
    sublabel: string;
  };
  dom: { currentDays: number; avg12moDays: number };
  footer: {
    luxuryCutoffDisplay: string;
    primeCutoffDisplay: string;
    trophyCutoffDisplay: string;
    localLineDisplay: string;
    trailingContractsTotal: number;
  };
  exploreData?: {
    labels: string[];
    contracts_count: { condo: (number | null)[]; coop: (number | null)[]; townhouse: (number | null)[] };
    sales_count: { condo: (number | null)[]; coop: (number | null)[]; townhouse: (number | null)[] };
    sales_avgprice: { condo: (number | null)[]; coop: (number | null)[]; townhouse: (number | null)[] };
    sales_discount: { condo: (number | null)[]; coop: (number | null)[]; townhouse: (number | null)[] };
    sales_volume: { condo: (number | null)[]; coop: (number | null)[]; townhouse: (number | null)[] };
    sales_ppsf?: { condo: (number | null)[]; coop: (number | null)[]; townhouse: (number | null)[] };
  };

}

/**
 * Last calendar day of a "YYYY-MM" period, formatted like "July 31, 2026".
 * Used wherever a report needs a genuine "as of" date rather than repeating
 * the period label — mirrors This Week's convention of using a real
 * formatted date (fmtDateLong(row.week_end)) instead of the period name.
 */
export function formatPeriodEndDate(period: string | null | undefined, fallback: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(period ?? "");
  if (!m) return fallback;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const d = new Date(Date.UTC(year, month, 0)); // day 0 of next month = last day of this month
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}




interface TierBlock {
  priceDisplay: string;
  pctLabel: string;
  avgPsfDisplay: string;
  sinceYrPct: string;
  // Neighborhood-local figures written by the monthly data agent.
  localAvgPsfDisplay?: string;
  localVolumeTTMDisplay?: string;
  localSampleCount?: number;
  localSmallSample?: boolean;
  cleared52w: number;
  momChangeDisplay?: string;
  momChangeClass?: string;
  yoyChangeDisplay?: string;
  yoyChangeClass?: string;
  avgPsfYoyDisplay?: string;
  avgPsfYoyClass?: string;
  avgPsfMomDisplay?: string;
  avgPsfMomClass?: string;
  volumeTTMDisplay?: string;
  volumeTTMYoyDisplay?: string;
  volumeTTMYoyClass?: string;
  volumeTTMMomDisplay?: string;
  volumeTTMMomClass?: string;
  clearedTTMYoyDisplay?: string;
  clearedTTMYoyClass?: string;
  clearedTTMMomDisplay?: string;
  clearedTTMMomClass?: string;
}

interface PulseColumn {
  title: string;
  smallSample: boolean;
  flag: string | null;
  rows: Record<
    string,
    {
      val?: string;
      momDisplay?: string;
      momClass?: string;
      yoyDisplay?: string;
      yoyClass?: string;
      suppressed?: boolean;
      empty?: string;
    }
  >;
}

interface SupplyBlock {
  activeListings: number;
  activeListingsContext?: string;
  activeListingsPrior?: number;
  activeListingsYoyDisplay?: string;
  activeListingsYoyClass?: string;
  monthsOfSupply: number;
  monthsOfSupplyPrior?: number;
  monthsOfSupplyYoyDisplay?: string;
  monthsOfSupplyYoyClass?: string;
  monthlyAbsorptionPct: number;
  monthlyAbsorptionPctPrior?: number;
  monthlyAbsorptionPctYoyDisplay?: string;
  monthlyAbsorptionPctYoyClass?: string;
}

// Production's neighborhood_monthly_report payloads have been observed missing
// the sales_avgprice / sales_discount sub-objects under exploreData (only
// contracts_count and sales_volume are always populated by the current
// neighborhood-pages pull). The ported component's inline chart script indexes
// all four unconditionally, so a missing sub-object throws inside the page's
// <script> and aborts the rest of that render pass. Default any missing
// sub-object to an empty per-type series so those charts render as empty
// rather than throwing.
function withSafeExploreData(payload: NeighborhoodPayload): NeighborhoodPayload {
  if (!payload.exploreData) return payload;
  const empty = { condo: [], coop: [], townhouse: [] };
  const normalizeTypes = (raw: unknown) => {
    const series = (raw ?? {}) as Record<string, (number | null)[] | undefined>;
    return {
      condo: series.condo ?? series.condos ?? [],
      coop: series.coop ?? series.coops ?? [],
      townhouse: series.townhouse ?? series.townhouses ?? [],
    };
  };
  return {
    ...payload,
    exploreData: {
      labels: payload.exploreData.labels ?? [],
      contracts_count: normalizeTypes(payload.exploreData.contracts_count ?? empty),
      sales_count: normalizeTypes(payload.exploreData.sales_count ?? empty),
      sales_avgprice: normalizeTypes(payload.exploreData.sales_avgprice ?? empty),
      sales_discount: normalizeTypes(payload.exploreData.sales_discount ?? empty),
      sales_volume: normalizeTypes(payload.exploreData.sales_volume ?? empty),
      sales_ppsf: normalizeTypes(payload.exploreData.sales_ppsf ?? empty),
    },

  };
}

// Production's tierHistoryChart.series[] objects have been observed carrying
// only color + data, no label — the ported component's legend reads
// s.label directly off this raw payload array (not the derived version
// buildScript constructs internally, which already supplies its own label).
// Default the missing label to "<cutoff>+" per tier so the legend reads
// "Luxury ($4.98M+)" instead of "Luxury ()".
function withTierHistoryLabels(payload: NeighborhoodPayload): NeighborhoodPayload {
  const cutoffs = [
    payload.footer.luxuryCutoffDisplay,
    payload.footer.primeCutoffDisplay,
    payload.footer.trophyCutoffDisplay,
  ];
  return {
    ...payload,
    tierHistoryChart: {
      ...payload.tierHistoryChart,
      series: payload.tierHistoryChart.series.map((s, i) => ({
        ...s,
        label: s.label || (cutoffs[i] ? `${cutoffs[i]}+` : ""),
      })),
    },
  };
}

// Upstream neighborhood_monthly_report payloads label bedroomMix.volumeData as
// "1BR / 2BR / 4+BR" but bedroomMix.countData as "1-Bed / 2-Bed / 4+ Beds".
// Normalize both arrays through the canonical mapping in @/lib/bedroom-labels
// at read time so charts, copy, and sowhat leader matching share one vocabulary.
function withNormalizedBedroomLabels(payload: NeighborhoodPayload): NeighborhoodPayload {
  if (!payload.bedroomMix) return payload;
  return {
    ...payload,
    bedroomMix: {
      ...payload.bedroomMix,
      volumeData: normalizeBedSeries(payload.bedroomMix.volumeData),
      countData: normalizeBedSeries(payload.bedroomMix.countData),
    },
  };
}

// Applies all three pure, payload-only normalizers above in the same order
// the live report path always has. No live dependency (no DB/network calls) —
// safe to reuse for both the live report and any frozen archived snapshot.
// Production's bedroomMix.countData items have been observed carrying only
// { label, value } — no `fmt` string, unlike volumeData items which always
// have one (e.g. "$3.87M"). The donut chart's inline draw script and its
// screen-reader table both read d.fmt directly for the value shown under
// each slice, so a missing fmt renders the literal text "undefined" instead
// of the contract count. Default a missing fmt to the plain integer value.
function withBedroomCountFmt(payload: NeighborhoodPayload): NeighborhoodPayload {
  if (!payload.bedroomMix?.countData) return payload;
  return {
    ...payload,
    bedroomMix: {
      ...payload.bedroomMix,
      countData: payload.bedroomMix.countData.map((d) => ({
        ...d,
        fmt: d.fmt ?? String(d.value ?? 0),
      })),
    },
  };
}

// The July 2026 neighborhood pull writes a leaner payload than the June shape:
// supply blocks carry only activeListings / monthsOfSupply (no
// monthlyAbsorptionPct, which rendered as "undefined%"), and each pulse column
// carries flat metrics (signedContracts, ppsf, discount, avgDaysOnMarket, plus
// their *MoM deltas) instead of the nested `rows` map the card grid reads,
// which rendered every row as an em dash. Both are recoverable at read time:
// monthly absorption is by definition 1 / months-of-supply, and the flat
// metrics map one-to-one onto the row keys the cards already know.
function withDerivedAbsorption(payload: NeighborhoodPayload): NeighborhoodPayload {
  if (!payload.supply) return payload;
  const fix = (b: SupplyBlock): SupplyBlock => {
    if (b?.monthlyAbsorptionPct != null || !b?.monthsOfSupply) return b;
    const pct = Math.round((100 / b.monthsOfSupply) * 10) / 10;
    const prior =
      b.monthsOfSupplyPrior && b.monthsOfSupplyPrior > 0
        ? Math.round((100 / b.monthsOfSupplyPrior) * 10) / 10
        : b.monthlyAbsorptionPctPrior;
    return { ...b, monthlyAbsorptionPct: pct, monthlyAbsorptionPctPrior: prior };
  };
  return {
    ...payload,
    supply: { ...payload.supply, luxury: fix(payload.supply.luxury), all: fix(payload.supply.all) },
  };
}

type FlatPulseColumn = {
  title: string;
  smallSample?: boolean;
  signedContracts?: number | null;
  signedContractsMoM?: number | null;
  recordedSales?: number | null;
  recordedSalesMoM?: number | null;
  ppsf?: number | null;
  ppsfMoM?: number | null;
  discount?: number | null;
  discountMoMpp?: number | null;
  avgDaysOnMarket?: number | null;
  avgDaysOnMarketMoM?: number | null;
};

function momCell(delta: number | null | undefined, fmt: (n: number) => string, min = 0.05) {
  if (delta == null || !isFinite(delta)) return {};
  if (Math.abs(delta) < min) {
    return { momDisplay: "flat", momClass: "flat" };
  }
  return {
    momDisplay: `${delta > 0 ? "▲" : "▼"} ${fmt(Math.abs(delta))}`,
    momClass: delta > 0 ? "up" : "down",
  };
}

function stripPeriodSuffix(value: string | undefined, suffix: "MoM" | "YoY"): string | undefined {
  return value?.replace(new RegExp(`\\s*${suffix}\\s*$`, "i"), "").trim();
}

function withCurrentMonthTierCounts(
  payload: NeighborhoodPayload,
  previous?: NeighborhoodPayload | null,
): NeighborhoodPayload {
  const latestTierCounts = payload.tierHistoryChart?.series?.map((series) => series.data?.at(-1));
  const prime = payload.weekStats?.clearedPrime ?? latestTierCounts?.[1];
  const trophy = payload.weekStats?.clearedTrophy ?? latestTierCounts?.[2];
  return {
    ...payload,
    weekStats: {
      ...payload.weekStats,
      clearedPrime: Number.isFinite(prime) ? Number(prime) : 0,
      clearedPrimePriorMonth: payload.weekStats?.clearedPrimePriorMonth ?? previous?.weekStats?.clearedPrime,
      clearedTrophy: Number.isFinite(trophy) ? Number(trophy) : 0,
      clearedTrophyPriorMonth: payload.weekStats?.clearedTrophyPriorMonth ?? previous?.weekStats?.clearedTrophy,
    },
    pulse: {
      ...payload.pulse,
      signedContractsMomDisplay: stripPeriodSuffix(payload.pulse?.signedContractsMomDisplay, "MoM"),
      signedContractsYoyDisplay: stripPeriodSuffix(payload.pulse?.signedContractsYoyDisplay, "YoY"),
      dollarVolumeMomDisplay: stripPeriodSuffix(payload.pulse?.dollarVolumeMomDisplay, "MoM"),
      dollarVolumeYoyDisplay: stripPeriodSuffix(payload.pulse?.dollarVolumeYoyDisplay, "YoY"),
    },
  };
}

function withSummaryBenchmarks(
  payload: NeighborhoodPayload,
  previous?: NeighborhoodPayload | null,
): NeighborhoodPayload {
  const demandCounts = payload.demandChart?.counts ?? [];
  const recentCounts = demandCounts.slice(-3);
  if (recentCounts.length > 0 && payload.hero?.luxuryContractsCount != null) {
    recentCounts[recentCounts.length - 1] = payload.hero.luxuryContractsCount;
  }
  const derivedContracts3mo =
    recentCounts.length === 3
      ? Math.round((recentCounts.reduce((sum, count) => sum + count, 0) / recentCounts.length) * 10) / 10
      : undefined;

  return {
    ...payload,
    hero: {
      ...payload.hero,
      luxuryContracts3moAvg:
        payload.hero?.luxuryContracts3moAvg ?? derivedContracts3mo ?? payload.hero.luxuryContractsCount,
      luxuryVolume3moAvgDisplay:
        payload.hero?.luxuryVolume3moAvgDisplay || previous?.hero?.luxuryVolume3moAvgDisplay || "",
      luxuryVolume12moAvgDisplay:
        payload.hero?.luxuryVolume12moAvgDisplay || previous?.hero?.luxuryVolume12moAvgDisplay || "",
    },
    pulse: {
      ...payload.pulse,
      signedContractsAvg: payload.pulse?.signedContractsAvg || previous?.pulse?.signedContractsAvg || "",
      dollarVolumeAvg: payload.pulse?.dollarVolumeAvg || previous?.pulse?.dollarVolumeAvg || "",
    },
  };
}


function withPulseColumnRows(payload: NeighborhoodPayload): NeighborhoodPayload {
  const cols = payload.pulse?.columns;
  if (!cols) return payload;
  const next: Record<string, PulseColumn> = {};
  for (const [key, raw] of Object.entries(cols)) {
    const c = raw as unknown as PulseColumn & FlatPulseColumn;
    if (c?.rows) {
      next[key] = c;
      continue;
    }
    const int = (n: number) => String(Math.round(n));
    const rows: PulseColumn["rows"] = {
      signed:
        c.signedContracts == null
          ? { empty: "—" }
          : {
              val: int(c.signedContracts),
              ...momCell(
                c.signedContractsMoM == null ? null : c.signedContractsMoM * 100,
                (n) => `${Math.round(n)}%`,
              ),
            },
      recorded:
        c.recordedSales == null
          ? { empty: "—" }
          : {
              val: int(c.recordedSales),
              ...momCell(
                c.recordedSalesMoM == null ? null : c.recordedSalesMoM * 100,
                (n) => `${Math.round(n)}%`,
              ),
            },
      psf:
        c.ppsf == null
          ? { empty: "—" }
          : {
              val: `$${Math.round(c.ppsf).toLocaleString("en-US")}`,
              ...momCell(
                c.ppsfMoM == null ? null : c.ppsfMoM * 100,
                (n) => `${n.toFixed(1)}%`,
              ),
            },
      discount:
        c.discount == null
          ? { empty: "—" }
          : {
              val: `${c.discount.toFixed(1)}%`,
              ...momCell(c.discountMoMpp, (n) => `${n.toFixed(1)}pp`),
            },
      dom:
        c.avgDaysOnMarket == null
          ? { empty: "—" }
          : {
              val: `${Math.round(c.avgDaysOnMarket)}d`,
              ...momCell(c.avgDaysOnMarketMoM, (n) => `${Math.round(n)}d`, 0.5),
            },

    };
    next[key] = { ...c, title: c.title, smallSample: c.smallSample ?? false, flag: null, rows };
  }
  return { ...payload, pulse: { ...payload.pulse, columns: next } };
}

// July 2026 demandChart payloads carry only labels/counts: rolling3, lastIndex
// and maxV are absent (the bar-and-line draw script reads rolling3.forEach and
// threw, leaving the chart blank), and labels arrive as ISO month starts rather
// than the short "Jul '26" form the axis expects. All three are derivable.
const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function withDemandChartDefaults(payload: NeighborhoodPayload): NeighborhoodPayload {
  const d = payload.demandChart;
  if (!d || !Array.isArray(d.counts)) return payload;
  const counts = d.counts;
  const rolling3 =
    Array.isArray(d.rolling3) && d.rolling3.length === counts.length
      ? d.rolling3
      : counts.map((_, i) => {
          const win = counts.slice(Math.max(0, i - 2), i + 1);
          return Math.round((win.reduce((s, n) => s + (n ?? 0), 0) / win.length) * 10) / 10;
        });
  const labels = (d.labels ?? []).map((l) => {
    const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(String(l));
    return m ? `${SHORT_MONTHS[Number(m[2]) - 1]} '${m[1].slice(2)}` : String(l);
  });
  const maxV = d.maxV ?? Math.max(1, ...counts, ...rolling3);
  return {
    ...payload,
    demandChart: { ...d, labels, rolling3, lastIndex: d.lastIndex ?? counts.length - 1, maxV },
  };
}

function monthEndLabel(period: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) return period;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const end = new Date(Date.UTC(year, month, 0));
  return end.toISOString().slice(0, 10);
}

// July omitted the three 12-month market-history objects. Preserve the prior
// eleven observations and append July's current metrics, all of which remain
// present elsewhere in the July payload. This keeps the rolling window current
// without presenting the June snapshot as if it were July data.
function withHistoricalChartFallback(
  payload: NeighborhoodPayload,
  period: string,
  previous?: NeighborhoodPayload | null,
): NeighborhoodPayload {
  if (!previous) return payload;
  const label = monthEndLabel(period);
  const roll = <T,>(values: T[] | undefined, current: T): T[] => [
    ...(Array.isArray(values) ? values.slice(-11) : []),
    current,
  ];
  const previousAbs = previous.absorptionChart;
  const previousSupply = previous.supplyChart;
  const previousDom = previous.domChart;
  const currentAbs = payload.supply?.luxury?.monthlyAbsorptionPct;
  const currentSupply = payload.supply?.luxury?.activeListings;
  const pulseDom = Object.values(payload.pulse?.columns ?? {}).reduce(
    (acc, raw) => {
      const column = raw as unknown as FlatPulseColumn;
      const count = column.signedContracts ?? 0;
      const days = column.avgDaysOnMarket;
      return days != null && Number.isFinite(days) && count > 0
        ? { weighted: acc.weighted + days * count, count: acc.count + count }
        : acc;
    },
    { weighted: 0, count: 0 },
  );
  const currentDom =
    payload.weekStats?.avgDaysOnMarket ??
    (pulseDom.count > 0 ? Math.round((pulseDom.weighted / pulseDom.count) * 10) / 10 : undefined);

  return {
    ...payload,
    absorptionChart:
      payload.absorptionChart ??
      (previousAbs && Number.isFinite(currentAbs)
        ? {
            ...previousAbs,
            labels: roll(previousAbs.labels, label),
            data: roll(previousAbs.data, currentAbs),
            maxV: Math.max(previousAbs.maxV ?? 0, currentAbs),
            sublabel: `Monthly absorption rate · ${payload.geo} luxury · trailing 12 months · current ${currentAbs.toFixed(1)}%`,
          }
        : payload.absorptionChart),
    supplyChart:
      payload.supplyChart ??
      (previousSupply && Number.isFinite(currentSupply)
        ? {
            ...previousSupply,
            months: roll(previousSupply.months, label),
            data: roll(previousSupply.data, currentSupply),
            current: currentSupply,
            maxV: Math.max(previousSupply.maxV ?? 0, currentSupply),
          }
        : payload.supplyChart),
    domChart:
      payload.domChart ??
      (previousDom && Number.isFinite(currentDom)
        ? {
            ...previousDom,
            labels: roll(previousDom.labels, label),
            data: roll(previousDom.data, currentDom),
            maxV: Math.max(previousDom.maxV ?? 0, currentDom),
            sublabel: `Monthly average days on market · ${payload.geo} luxury contracts · trailing 12 months · current ${Math.round(currentDom)} days`,
          }
        : payload.domChart),
    dom:
      payload.dom ??
      (Number.isFinite(currentDom)
        ? { currentDays: currentDom, avg12moDays: previous.dom?.avg12moDays ?? currentDom }
        : payload.dom),
  };
}

export function normalizeNeighborhoodPayload(
  payload: NeighborhoodPayload,
  period = "",
  previous?: NeighborhoodPayload | null,
): NeighborhoodPayload {
  const normalized = withDemandChartDefaults(
    withPulseColumnRows(
      withDerivedAbsorption(
        withNormalizedBedroomLabels(withBedroomCountFmt(withTierHistoryLabels(withSafeExploreData(payload)))),
      ),
    ),
  );
  return withHistoricalChartFallback(
    withSummaryBenchmarks(withCurrentMonthTierCounts(normalized, previous), previous),
    period,
    previous,
  );
}




// Neighborhood names arrive with inconsistent casing/spacing across sources.
// Re-exported from the shared registry module so the report gate, the engine,
// and the internal registry page all key names the same way.
import { normalizeGeoName } from "@/lib/lux-registry";

export type LuxLeaderboard = {
  qualified: Set<string>;
  volume: Map<string, { rank: number; delta: number }>;
  intensity: Map<string, { rank: number; pct: number | null }>;
  // Qualifying neighborhoods ordered by luxury intensity, used to name the
  // neighborhood one place below on that measure.
  intensityOrder: Array<{ name: string; key: string; pct: number | null }>;
  total: number;
};

// Represents "no live leaderboard data available." Passing this into
// buildNeighborhoodReport reproduces exactly the same branches the live path
// takes when a neighborhood isn't found on the board (volumeRank/manhattanRank
// left absent, no rank-change note, no next-neighborhood comparison) — which
// is precisely the frozen-snapshot behavior archived pages need, since a
// locked snapshot must never carry a rank derived from today's live board.
export const EMPTY_LUX_LEADERBOARD: LuxLeaderboard = {
  qualified: new Set(),
  volume: new Map(),
  intensity: new Map(),
  intensityOrder: [],
  total: 0,
};

// Qualification and ranking both come from the merged luxury registry: the
// union of the weekly dollar-volume board and the luxury-intensity board, or
// the uncapped qualified_neighborhoods feed once the pipeline emits it.
async function loadLuxLeaderboard(): Promise<LuxLeaderboard> {
  const qualified = new Set<string>();
  const volume = new Map<string, { rank: number; delta: number }>();
  const intensity = new Map<string, { rank: number; pct: number | null }>();
  let intensityOrder: Array<{ name: string; key: string; pct: number | null }> = [];
  let total = 0;
  try {
    const { loadLuxRegistry } = await import("@/lib/lux-registry.server");
    const registry = await loadLuxRegistry();

    // Only neighborhoods clearing MIN_QUALIFIED_LUX_CONTRACTS are ranked. The
    // pipeline's own manhattanRank counts every neighborhood it sees, which is
    // why it produced positions like 16th or 19th out of a qualifying set of 14.
    const rows = registry.rows.filter((r) => r.qualified);
    for (const row of rows) qualified.add(normalizeGeoName(row.name));
    total = rows.length;

    const byVolume = rows
      .filter((r) => r.vol52wk !== null)
      .sort((a, b) => (b.vol52wk ?? 0) - (a.vol52wk ?? 0));
    byVolume.forEach((row, i) => {
      volume.set(normalizeGeoName(row.name), {
        rank: i + 1,
        delta: row.volumeRankDelta ?? 0,
      });
    });

    // Ties are resolved on the unrounded share, then on contract count, so two
    // neighborhoods never share a published position.
    const byIntensity = rows
      .filter((r) => r.pctLux !== null)
      .sort(
        (a, b) =>
          (b.pctLux ?? 0) - (a.pctLux ?? 0) || (b.contracts52wk ?? 0) - (a.contracts52wk ?? 0),
      );
    byIntensity.forEach((row, i) => {
      intensity.set(normalizeGeoName(row.name), { rank: i + 1, pct: row.pctLux });
    });
    intensityOrder = byIntensity.map((row) => ({
      name: row.name,
      key: normalizeGeoName(row.name),
      pct: row.pctLux,
    }));
  } catch (err) {
    console.error("[neighborhood_report] leaderboard load failed:", err);
  }
  return { qualified, volume, intensity, intensityOrder, total };
}

// Builds the full NeighborhoodReport (payload mutations for rank fields +
// computed so-what strings) from an already-normalized payload, a period
// label, and a leaderboard. Pass the real live board (loadLuxLeaderboard())
// for the live report path, or EMPTY_LUX_LEADERBOARD for a frozen archived
// snapshot that must never carry today's live rank data. Extracted out of
// getNeighborhoodReportBySlug's handler so both the live route and the
// archive route share one implementation rather than two copies.
export function buildNeighborhoodReport(
  payload: NeighborhoodPayload,
  period: string,
  board: LuxLeaderboard,
): NeighborhoodReport {
  const geoKey = normalizeGeoName(payload.geo);

  // Live path: the board wins. Archive path (EMPTY_LUX_LEADERBOARD): fall back
  // to the ranks already frozen into the stored payload, so a locked snapshot
  // reproduces the positions that were published that month.
  const vol =
    board.volume.get(geoKey) ??
    (typeof payload.rank.volumeRank === "number" ? { rank: payload.rank.volumeRank, delta: 0 } : null);
  if (vol) {
    payload.rank.volumeRank = vol.rank;
    payload.rank.volumeRankTotal = board.total || payload.rank.volumeRankTotal || null;
  }

  // Luxury intensity rank comes from the registry, over qualifying
  // neighborhoods only. The pipeline's manhattanRank ranks every neighborhood
  // it sees, qualifying or not, so it is not published.
  const intensity =
    board.intensity.get(geoKey) ??
    (typeof payload.rank.manhattanRank === "number"
      ? { rank: payload.rank.manhattanRank, pct: payload.rank.luxurySharePct ?? null }
      : null);
  if (intensity) payload.rank.manhattanRank = intensity.rank;


  // Both rank movement lines are suppressed on neighborhood pages. These are
  // monthly reports, but the underlying boards are weekly, so any "last week"
  // movement note reads as a contradiction against a monthly period label.
  // Intensity movement is additionally measured against the unqualified
  // ranking, a different denominator from the published qualified position.
  // Movement returns when a monthly qualified board exists to compare against.
  payload.rank.volumeRankChangeStrong = "";
  payload.rank.volumeRankChangeNote = "";
  payload.rank.volumeRankChangeClass = "";
  payload.rank.rankChangeStrong = "";
  payload.rank.rankChangeNote = "";
  payload.rank.rankChangeClass = "";



  // The comparison neighbor is the qualifying neighborhood one place below on
  // intensity, not whatever the feed happened to name. The feed names the next
  // neighborhood on its own unqualified board, which can be a market below the
  // contract floor (Fulton Seaport, for example), so a fallback name is only
  // accepted when the registry confirms it qualifies. On the archive path the
  // board is empty, so no unverified fallback name is cited at all.
  const orderIdx = board.intensityOrder.findIndex((r) => r.key === geoKey);
  const neighbor = orderIdx >= 0 ? board.intensityOrder[orderIdx + 1] ?? null : null;
  const feedNext = payload.rank.nextNeighborhood ?? null;
  const feedNextQualifies =
    !!feedNext && board.qualified.has(normalizeGeoName(feedNext));
  const nextName = neighbor?.name ?? (feedNextQualifies ? feedNext : null);
  const nextPct = neighbor?.pct ?? (feedNextQualifies ? payload.rank.nextPct ?? null : null);
  const nextQualified = !!nextName;
  payload.rank.nextNeighborhood = nextName;
  payload.rank.nextPct = nextPct;

  const rankSowhat = computeNeighborhoodRankSowhat({
    geo: payload.geo,
    rankOrdinal: intensity?.rank ?? null,
    nextNeighborhood: nextName,
    nextPct: nextPct != null ? Math.round(nextPct * 10) / 10 : null,
    ownPct: payload.rank.luxurySharePct,
    nextQualified,
    volumeRank: vol?.rank ?? null,
    volumeRankTotal: board.total || payload.rank.volumeRankTotal || null,


    localLine: payload.rank.localLine,
    manhattanLuxuryMedian: payload.rank.boroughLuxuryMedian ?? parseFloat(payload.footer.primeCutoffDisplay.replace(/[$,M]/g, "")) * 1_000_000,
    luxuryContractsCount: Number(payload.rank.luxuryShareCountsDisplay.match(/^\d+/)?.[0] ?? 0),
    trailingContractsTotal: payload.footer.trailingContractsTotal,
    localLineDisplay: payload.rank.localLineDisplay,
    manhattanLuxuryMedianDisplay: payload.rank.boroughLuxuryMedianDisplay ?? payload.footer.primeCutoffDisplay,
  });



  const supplySowhat = computeSupplyLeverageSowhat({
    geo: payload.geo,
    luxuryMonthsOfSupply: payload.supply.luxury.monthsOfSupply,
    boroughMonthsOfSupply: payload.supply.boroughMonthsOfSupply,
  });

  const domSowhat = payload.dom
    ? computeDaysOnMarketSowhat({
        geo: payload.geo,
        currentDays: payload.dom.currentDays,
        avg12moDays: payload.dom.avg12moDays,
      })
    : "";

  const heroContractsNote = computeHeroContractsSowhat({
    geo: payload.geo,
    current: payload.hero.luxuryContractsCount,
    avg12mo: payload.hero.luxuryContracts12moAvg,
    avg3mo: payload.hero.luxuryContracts3moAvg,
    avg12moYearAgo: payload.hero.luxuryContracts12moAvgYearAgo,
  });


  // parse "$187M" / "$1.2B" / "$450K" → number (mirrors component helper)
  const parseCurrencyStr = (s: string | number | undefined | null): number => {
    if (typeof s === "number") return s;
    if (!s) return 0;
    const str = String(s).trim().replace(/[$,\s]/g, "");
    const m = str.match(/^(-?[\d.]+)([KMB]?)$/i);
    if (!m) return Number(str) || 0;
    const n = parseFloat(m[1]);
    const mult =
      m[2].toUpperCase() === "B" ? 1e9 :
      m[2].toUpperCase() === "M" ? 1e6 :
      m[2].toUpperCase() === "K" ? 1e3 : 1;
    return n * mult;
  };

  const heroVolumeNote = computeHeroVolumeSowhat({
    geo: payload.geo,
    current: parseCurrencyStr(payload.hero.luxuryVolumeDisplay),
    avg12mo: parseCurrencyStr(payload.hero.luxuryVolume12moAvgDisplay),
    trophyCount: payload.weekStats.clearedTrophy,
  });

  const crossMetricSowhat = computeCrossMetricSowhat({
    luxuryContractsCurrent: payload.hero.luxuryContractsCount,
    luxuryContracts12moAvg: payload.hero.luxuryContracts12moAvg,
    overallVolumeMomClass: payload.pulse.dollarVolumeMomClass,
  });

  const unitMixSowhat = computeUnitMixSowhat({
    geo: payload.geo,
    totalContracts: payload.bedroomMix.totalContracts,
    volumeData: payload.bedroomMix.volumeData,
    countData: payload.bedroomMix.countData,
  });

  const smallSampleNote =
    payload.hero.luxuryContractsCount < SMALL_SAMPLE_FLOOR
      ? smallSampleString(payload.hero.luxuryContractsCount)
      : null;

  return {
    payload,
    period,
    computed: {
      rankSowhat,
      supplySowhat,
      domSowhat,
      heroContractsNote,
      heroVolumeNote,
      crossMetricSowhat,
      unitMixSowhat,
      smallSampleNote,
      provisionalString: PROVISIONAL_STRING,
      smallSampleFloor: SMALL_SAMPLE_FLOOR,
    },
  };
}


export const getNeighborhoodReportBySlug = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => {
    if (!/^[a-z0-9-]+$/.test(input.slug)) throw new Error("Invalid slug");
    return input;
  })
  .handler(async ({ data: input }): Promise<NeighborhoodReport | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const client = supabaseAdmin as unknown as {
      from: (t: string) => {
        select: (cols: string) => {
          eq: (col: string, val: string) => {
            order: (col: string, o: { ascending: boolean }) => {
              limit: (n: number) => Promise<{
                data: Array<{ period: string; payload: NeighborhoodPayload }> | null;
                error: unknown;
              }>;
            };
          };
        };
      };
    };

    const { data, error } = await client
      .from("neighborhood_monthly_report")
      .select("period, payload")
      .eq("neighborhood_slug", input.slug)
      .order("period", { ascending: false })
      .limit(2);

    if (error) {
      console.error(`[neighborhood_monthly_report] ${input.slug} load failed:`, error);
      return null;
    }
    const current = data?.[0];
    if (!current) return null;

    const previous = data?.[1]?.payload ?? null;
    const payload = normalizeNeighborhoodPayload(current.payload as unknown as NeighborhoodPayload, current.period, previous);
    const board = await loadLuxLeaderboard();
    return buildNeighborhoodReport(payload, current.period, board);
  },
);

export const getNeighborhoodRanks = createServerFn({ method: "GET" }).handler(
  async (): Promise<Record<string, number>> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const client = supabaseAdmin as unknown as {
      from: (t: string) => {
        select: (cols: string) => {
          order: (col: string, o: { ascending: boolean }) => Promise<{
            data: Array<{ neighborhood_slug: string; period: string; payload: { rank?: { manhattanRank?: number } } }> | null;
            error: unknown;
          }>;
        };
      };
    };
    const { data, error } = await client
      .from("neighborhood_monthly_report")
      .select("neighborhood_slug, period, payload")
      .order("period", { ascending: false });
    if (error || !data) {
      if (error) console.error("[neighborhood_monthly_report] ranks load failed:", error);
      return {};
    }
    const out: Record<string, number> = {};
    for (const row of data) {
      if (out[row.neighborhood_slug] != null) continue;
      const r = row.payload?.rank?.manhattanRank;
      if (typeof r === "number") out[row.neighborhood_slug] = r;
    }
    return out;
  },
);
