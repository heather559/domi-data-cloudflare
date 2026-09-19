/**
 * STEP 6.5 -- THE SO-WHAT ENGINE. Every read here is plain arithmetic
 * against values already pulled elsewhere in the pipeline -- no LLM
 * involvement in this section, per explicit user instruction (this was
 * decided with the business owner ahead of this task).
 *
 * Design note: broken into one small pure function per numbered sub-metric
 * (1)-(10) from the spec, each independently unit-testable, then
 * `computeSowhat` ties them together, picks the lede, and applies the
 * fail-handling rule ("never let one failed call null the whole sowhat
 * section unless lux52 itself failed").
 */

import type { LuxuryContractStatsResponse, NeighborhoodRankResponse, WeeklySalesStatsResponse, ContractPeriodEntry } from '../fetch/schemas';
import { readTierCount } from '../fetch/schemas';
import type { MarketReadBadge, Sowhat, TopDeal } from '../schema/weeklyReportPayload';
import { averageField, lastN } from './lib';

// ---------------------------------------------------------------------------
// (1) monthsOfSupply -- the leverage read
// ---------------------------------------------------------------------------

export interface SupplyBand {
  label: string;
  clause: string;
}

export function supplyBandFor(months: number): SupplyBand {
  if (months < 4) return { label: "acute seller's market", clause: 'well-priced listings move in days; sellers hold all leverage' };
  if (months < 6) return { label: "seller's market", clause: 'good listings move quickly; sellers hold the leverage' };
  if (months < 8) return { label: 'balanced, tilting to sellers', clause: 'priced-right listings move; modest room to negotiate' };
  if (months < 9) return { label: 'balanced', clause: 'neither side has a structural edge' };
  if (months < 12) return { label: "buyer's market", clause: 'buyers can negotiate on price and terms' };
  return { label: 'deep buyer\'s market', clause: 'supply is well ahead of demand; buyers set the pace' };
}

export interface MonthsOfSupplyResult {
  months: number;
  band: SupplyBand;
  streakWeeks: number;
  supplyRead: string;
}

export function computeMonthsOfSupply(
  pace13w: number | null,
  supplyLuxuryActive: number | null,
  prevSupplyBandLabel: string | null,
  prevStreakWeeks: number | null,
): MonthsOfSupplyResult | null {
  if (pace13w === null || pace13w === 0 || supplyLuxuryActive === null) return null;

  const months = supplyLuxuryActive / (pace13w * 4.33);
  const band = supplyBandFor(months);
  const streakWeeks = band.label === prevSupplyBandLabel ? (prevStreakWeeks ?? 0) + 1 : 1;
  const rounded = Math.round(months);

  const streakClause = streakWeeks >= 3 ? ` It's held there ${streakWeeks} weeks running.` : '';
  const supplyRead =
    `At ~${rounded} months of luxury supply, this is a ${band.label} -- ${band.clause}.` +
    streakClause +
    ' This is the borough-wide picture -- individual buildings and neighborhoods can (and do) behave very differently, so treat this as context, not a rule for any one deal.';

  return { months, band, streakWeeks, supplyRead };
}

// ---------------------------------------------------------------------------
// (2) luxuryPace
// ---------------------------------------------------------------------------

export interface LuxuryPaceResult {
  pace52w: number;
  momentum: number;
  paceRead: string;
}

function isQ3(weekStart: string): boolean {
  const month = Number(weekStart.slice(5, 7));
  return month >= 7 && month <= 9;
}

export function computeLuxuryPace(pace13w: number, pace52w: number, heroLuxuryCount: number | null, weekStart: string): LuxuryPaceResult {
  const momentum = pace52w !== 0 ? (pace13w - pace52w) / pace52w : 0;

  if (heroLuxuryCount !== null && heroLuxuryCount < 5) {
    return {
      pace52w,
      momentum,
      paceRead: `Only ${heroLuxuryCount} deals this week -- too thin to read. See the 52-week trend.`,
    };
  }

  let phrase: string;
  if (momentum >= 0.15) phrase = 'signing is accelerating -- well above its 52-week pace';
  else if (momentum >= 0.05) phrase = 'signing is picking up vs its 52-week pace';
  else if (momentum >= -0.05) phrase = 'signing is steady, in line with its 52-week pace';
  else if (momentum >= -0.15) phrase = 'signing is easing below its 52-week pace';
  else phrase = 'signing is slowing sharply vs its 52-week pace';

  const seasonalCaveat = isQ3(weekStart)
    ? " (Q3 is historically the slowest quarter of the year -- read this quarter's pace against that seasonal backdrop, not as a standalone signal.)"
    : '';

  const paceRead = `Luxury signing is running ~${Math.round(pace52w)} contracts/week on the 52-week trailing pace -- ${phrase}${seasonalCaveat} (This week: ${heroLuxuryCount ?? 'N/A'}, provisional -- may revise up.)`;

  return { pace52w, momentum, paceRead };
}

// ---------------------------------------------------------------------------
// (3) daysOnMarket
// ---------------------------------------------------------------------------

export interface DaysOnMarketResult {
  dom13w: number;
  dom52w: number;
  delta: number;
  domRead: string;
}

export function computeDaysOnMarket(dom13w: number, dom52w: number): DaysOnMarketResult {
  const delta = dom52w !== 0 ? (dom13w - dom52w) / dom52w : 0;
  let phrase: string;
  if (delta >= 0.15) phrase = 'sitting notably longer';
  else if (delta >= 0.05) phrase = 'taking somewhat longer to sell';
  else if (delta >= -0.05) phrase = 'selling times in line with the norm';
  else if (delta >= -0.15) phrase = 'selling somewhat faster';
  else phrase = 'selling notably faster';

  const domRead = `Luxury days-on-market are ${phrase} (${Math.round(dom13w)} days recently vs a ${Math.round(dom52w)}-day 52-week average).`;
  return { dom13w, dom52w, delta, domRead };
}

// ---------------------------------------------------------------------------
// (4) discount
// ---------------------------------------------------------------------------

export interface DiscountResult {
  discLast13: number;
  discPrior13: number;
  deltaPp: number;
  discountRead: string;
}

/** Pools condos/coops/townhouses salesByWeek entries into one salesCount-weighted average discount, restricted to a given slice of the (chronologically sorted, deduped-by-date) weekly series. */
function pooledWeightedDiscount(entries: readonly ContractPeriodEntry[]): number | null {
  let weightedSum = 0;
  let totalWeight = 0;
  for (const e of entries) {
    const weight = e.salesCount ?? e.contractCount ?? null;
    if (e.discount != null && weight != null && weight > 0) {
      weightedSum += e.discount * weight;
      totalWeight += weight;
    }
  }
  return totalWeight > 0 ? weightedSum / totalWeight : null;
}

/** Merges condos+coops+townhouses salesByWeek arrays into one date-sorted list (each entry kept distinct, per-type -- pooling happens via the weight sum, not by merging same-date rows into one). */
function poolSalesWkEntries(salesWk: WeeklySalesStatsResponse): ContractPeriodEntry[] {
  const all = [
    ...(salesWk.condos?.salesByWeek ?? []),
    ...(salesWk.coops?.salesByWeek ?? []),
    ...(salesWk.townhouses?.salesByWeek ?? []),
    ...(salesWk.all?.salesByWeek ?? []),
  ];
  return [...all].sort((a, b) => a.date.localeCompare(b.date));
}

export function computeDiscount(salesWk: WeeklySalesStatsResponse): DiscountResult | null {
  const pooled = poolSalesWkEntries(salesWk);
  const uniqueDates = [...new Set(pooled.map((e) => e.date))].sort();
  const last26Dates = lastN(uniqueDates, 26);
  if (last26Dates.length < 26) {
    // Not enough history to form both a last-13 and prior-13 window.
    if (last26Dates.length === 0) return null;
  }
  const last13Dates = new Set(lastN(last26Dates, 13));
  const prior13Dates = new Set(last26Dates.slice(0, Math.max(0, last26Dates.length - 13)));

  const last13Entries = pooled.filter((e) => last13Dates.has(e.date));
  const prior13Entries = pooled.filter((e) => prior13Dates.has(e.date));

  const discLast13 = pooledWeightedDiscount(last13Entries);
  const discPrior13 = pooledWeightedDiscount(prior13Entries);
  if (discLast13 === null || discPrior13 === null) return null;

  const deltaPp = Math.abs(discLast13) - Math.abs(discPrior13);
  let phrase: string;
  if (deltaPp >= 1.0) phrase = 'buyers are negotiating harder';
  else if (deltaPp >= -1.0) phrase = 'negotiating room is steady';
  else phrase = 'sellers are giving up less';

  const discountRead = `On closed luxury sales, ${phrase} (avg discount ${discLast13.toFixed(2)}%).`;
  return { discLast13, discPrior13, deltaPp, discountRead };
}

// ---------------------------------------------------------------------------
// (5) dollarVolume
// ---------------------------------------------------------------------------

export interface DollarVolumeResult {
  momentum: number;
  volumeRead: string | null;
}

const DOLLAR_VOLUME_MOMENTUM_GATE = 0.2;
const DOLLAR_VOLUME_SKEW_THRESHOLD = 0.25;

export function computeDollarVolume(
  volPace13w: number,
  volPace52w: number,
  topDeals: readonly TopDeal[],
  heroLuxuryVolume: number | null,
): DollarVolumeResult {
  const momentum = volPace52w !== 0 ? (volPace13w - volPace52w) / volPace52w : 0;

  if (Math.abs(momentum) < DOLLAR_VOLUME_MOMENTUM_GATE) {
    return { momentum, volumeRead: null };
  }

  const topDealPrice = topDeals[0]?.price ?? null;
  const isSkewed = topDealPrice !== null && heroLuxuryVolume !== null && topDealPrice > DOLLAR_VOLUME_SKEW_THRESHOLD * heroLuxuryVolume;
  const skewClause = isSkewed ? ' -- lifted by one outsized deal.' : '.';
  const direction = momentum > 0 ? 'running above' : 'running below';

  return { momentum, volumeRead: `Luxury dollar volume is ${direction} its 52-week pace${skewClause}` };
}

// ---------------------------------------------------------------------------
// (6) tierTrophy
// ---------------------------------------------------------------------------

export function computeTierTrophy(currentTrophyCount: number | null): string | null {
  if (currentTrophyCount === null) return null;
  if (currentTrophyCount === 0) return 'No trophy ($18M+) contracts this week (typical ~2).';
  if (currentTrophyCount >= 4) return `Unusually active trophy week -- ${currentTrophyCount} vs ~2 typical.`;
  return null;
}

// ---------------------------------------------------------------------------
// (7) neighborhoodMover
// ---------------------------------------------------------------------------

const NEIGHBORHOOD_MOVER_MIN_TOTAL_CONTRACTS = 20;
const NEIGHBORHOOD_MOVER_MIN_QUALIFYING = 5;

function titleCase(name: string): string {
  return name.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function computeNeighborhoodMover(
  hoodRank13: NeighborhoodRankResponse | null,
  hoodRank52full: NeighborhoodRankResponse | null,
): string | null {
  if (!hoodRank13 || !hoodRank52full) return null;

  const rank52ByName = new Map(hoodRank52full.neighborhoods.map((n) => [n.neighborhood, n]));

  const candidates = hoodRank13.neighborhoods
    .map((n13) => {
      const n52 = rank52ByName.get(n13.neighborhood);
      if (!n52 || n13.tiers.p90.pct == null || n52.tiers.p90.pct == null) return null;
      const delta = n13.tiers.p90.pct - n52.tiers.p90.pct;
      return { name: n13.neighborhood, delta, n13 };
    })
    .filter((c): c is { name: string; delta: number; n13: (typeof hoodRank13.neighborhoods)[number] } => c !== null)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  for (const candidate of candidates) {
    const totalContracts = candidate.n13.totalContracts ?? 0;
    const qualifyingCount = candidate.n13.tiers.p90.count ?? candidate.n13.tiers.p90.totalCount ?? 0;
    if (totalContracts >= NEIGHBORHOOD_MOVER_MIN_TOTAL_CONTRACTS && qualifyingCount >= NEIGHBORHOOD_MOVER_MIN_QUALIFYING) {
      const direction = candidate.delta > 0 ? 'up' : 'down';
      const pctDisplay = ((candidate.n13.tiers.p90.pct ?? 0) * 100).toFixed(1);
      return `${titleCase(candidate.name)} is the week's real mover -- luxury intensity ${direction} to ${pctDisplay}% of its contracts (based on ${qualifyingCount} qualifying contracts of ${totalContracts} total).`;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// (9) market_read badge (driven by luxuryPace's momentum, not monthsOfSupply)
// ---------------------------------------------------------------------------

function isHolidayWeek(weekStart: string): boolean {
  const month = Number(weekStart.slice(5, 7));
  const day = Number(weekStart.slice(8, 10));
  if (month === 11 && day >= 22 && day <= 28) return true; // Thanksgiving week (approx -- always contains the 4th Thursday)
  if (month === 12 && day >= 25) return true; // late Dec
  if (month === 1 && day <= 7) return true; // early Jan
  if (month === 8 && day >= 24) return true; // late Aug
  return false;
}

export function computeMarketReadBadge(luxuryPaceMomentum: number, weekStart: string): MarketReadBadge {
  let badge: string;
  let cls: string;
  if (luxuryPaceMomentum >= 0.15) {
    badge = 'BUSY';
    cls = 'read--busy';
  } else if (luxuryPaceMomentum >= 0.05) {
    badge = 'ABOVE PACE';
    cls = 'read--above';
  } else if (luxuryPaceMomentum >= -0.05) {
    badge = 'NORMAL';
    cls = 'read--normal';
  } else if (luxuryPaceMomentum >= -0.15) {
    badge = 'SLOW';
    cls = 'read--slow';
  } else {
    badge = 'QUIET';
    cls = 'read--quiet';
  }

  if (isHolidayWeek(weekStart)) badge = `${badge} -- SEASONAL`;
  return { badge, class: cls };
}

// ---------------------------------------------------------------------------
// (10) footnotes -- fixed, verbatim from the spec/config.
// ---------------------------------------------------------------------------

export const SOWHAT_FOOTNOTES = {
  asking_not_achieved: 'Contract figures use last asking price; closed-sale figures are recorded prices. The two are shown separately.',
  count_reconciliation:
    'The headline luxury count reflects the top 10% of Manhattan contracts; neighborhood-level figures are computed against that same borough-wide threshold independently, so totals may differ slightly by design.',
  provisional: 'The most recent week or two is incomplete due to recording lag and may revise upward.',
};

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export interface ComputeSowhatInputs {
  lux52: LuxuryContractStatsResponse | null;
  lux13: LuxuryContractStatsResponse | null;
  salesWk: WeeklySalesStatsResponse | null;
  hoodRank13: NeighborhoodRankResponse | null;
  hoodRank52full: NeighborhoodRankResponse | null;
  supplyLuxuryActive: number | null;
  heroLuxuryCount: number | null;
  heroLuxuryVolume: number | null;
  topDeals: readonly TopDeal[];
  prevSupplyBandLabel: string | null;
  prevStreakWeeks: number | null;
  weekStart: string;
}

const nullSowhat: Sowhat = {
  lede: null,
  market_read: { badge: 'NORMAL', class: 'read--normal' }, // inert placeholder -- only reached when lux52 itself failed, an extreme near-total-outage case
  supply_read: null,
  supply_band_label: null,
  pace_read: null,
  dom_read: null,
  discount_read: null,
  volume_read: null,
  trophy_read: null,
  neighborhood_mover_read: null,
  footnotes: SOWHAT_FOOTNOTES,
  streak_weeks: null,
};

export function computeSowhat(inputs: ComputeSowhatInputs): Sowhat {
  if (!inputs.lux52) {
    return { ...nullSowhat };
  }

  const pace13w = inputs.lux13 ? (readTierCount(inputs.lux13.lines.p90) ?? 0) / 13 : null;
  const pace52w = (readTierCount(inputs.lux52.lines.p90) ?? 0) / 52;

  // (1) monthsOfSupply -- attempted whenever ITS OWN inputs (pace13w, supply) succeeded, independent of the rest.
  const monthsResult = computeMonthsOfSupply(pace13w, inputs.supplyLuxuryActive, inputs.prevSupplyBandLabel, inputs.prevStreakWeeks);

  // (7) neighborhoodMover -- attempted whenever ITS OWN inputs succeeded.
  const neighborhoodMoverRead = computeNeighborhoodMover(inputs.hoodRank13, inputs.hoodRank52full);

  // Metrics 2/3/5/6 all need lux13 -- skip (null) if it failed, per spec.
  let luxuryPaceResult: LuxuryPaceResult | null = null;
  let domResult: DaysOnMarketResult | null = null;
  let volumeResult: DollarVolumeResult | null = null;
  let trophyRead: string | null = null;

  if (inputs.lux13 && pace13w !== null) {
    luxuryPaceResult = computeLuxuryPace(pace13w, pace52w, inputs.heroLuxuryCount, inputs.weekStart);

    const dom13w = averageField(lastN(inputs.lux13.lines.p90.contractsByPeriod, 13), (e) => e.avgDaysOnMarket);
    const dom52w = averageField(inputs.lux52.lines.p90.contractsByPeriod, (e) => e.avgDaysOnMarket);
    if (dom13w !== null && dom52w !== null) {
      domResult = computeDaysOnMarket(dom13w, dom52w);
    }

    const volPace13w = averageField(lastN(inputs.lux13.lines.p90.contractsByPeriod, 13), (e) => e.totalPrice);
    const volPace52w = averageField(inputs.lux52.lines.p90.contractsByPeriod, (e) => e.totalPrice);
    if (volPace13w !== null && volPace52w !== null) {
      volumeResult = computeDollarVolume(volPace13w, volPace52w, inputs.topDeals, inputs.heroLuxuryVolume);
    }

    const currentTrophyCount = inputs.lux13.lines.p99.contractsByPeriod.at(-1)?.contractCount ?? null;
    trophyRead = computeTierTrophy(currentTrophyCount);
  }

  const discountResult = inputs.salesWk ? computeDiscount(inputs.salesWk) : null;

  // (9) market_read -- from luxuryPace's momentum; falls back to a neutral badge if lux13 failed (momentum unavailable).
  const marketRead = luxuryPaceResult
    ? computeMarketReadBadge(luxuryPaceResult.momentum, inputs.weekStart)
    : { badge: 'NORMAL', class: 'read--normal' };

  // (8) THE LEDE -- highest strength among metrics 1-5 only, tie-break order monthsOfSupply > luxuryPace > daysOnMarket > discount > dollarVolume.
  const candidates: Array<{ strength: number; read: string }> = [];
  if (monthsResult) candidates.push({ strength: Math.abs(monthsResult.months - 8.5) / 8.5, read: monthsResult.supplyRead });
  if (luxuryPaceResult) candidates.push({ strength: Math.abs(luxuryPaceResult.momentum), read: luxuryPaceResult.paceRead });
  if (domResult) candidates.push({ strength: Math.abs(domResult.delta), read: domResult.domRead });
  if (discountResult) candidates.push({ strength: Math.abs(discountResult.deltaPp) / 5, read: discountResult.discountRead });
  if (volumeResult && volumeResult.volumeRead !== null) candidates.push({ strength: Math.abs(volumeResult.momentum), read: volumeResult.volumeRead });

  let lede: string | null = null;
  if (candidates.length > 0) {
    lede = candidates.reduce((best, c) => (c.strength > best.strength ? c : best)).read;
  }

  return {
    lede,
    market_read: marketRead,
    supply_read: monthsResult?.supplyRead ?? null,
    supply_band_label: monthsResult?.band.label ?? null,
    pace_read: luxuryPaceResult?.paceRead ?? null,
    dom_read: domResult?.domRead ?? null,
    discount_read: discountResult?.discountRead ?? null,
    volume_read: volumeResult?.volumeRead ?? null,
    trophy_read: trophyRead,
    neighborhood_mover_read: neighborhoodMoverRead,
    footnotes: SOWHAT_FOOTNOTES,
    streak_weeks: monthsResult?.streakWeeks ?? null,
  };
}
