// Deterministic so-what generator for Domi Data neighborhood pages.
// Mirrors domi-data-neighborhood-sowhat-library.json v1.
// Pure functions. No LLM. Threshold lookups + fill-in templates only.

import { canonicalBedLabel, sameBedSegment } from "@/lib/bedroom-labels";



export type MomentumDir =
  | "strong_up"
  | "up"
  | "flat"
  | "down"
  | "strong_down";

const MOMENTUM_BANDS: { min: number | null; dir: MomentumDir }[] = [
  { min: 0.15, dir: "strong_up" },
  { min: 0.05, dir: "up" },
  { min: -0.05, dir: "flat" },
  { min: -0.15, dir: "down" },
  { min: null, dir: "strong_down" },
];

export function momentumDir(current: number, avg: number): MomentumDir {
  if (!avg) return "flat";
  const m = (current - avg) / avg;
  for (const b of MOMENTUM_BANDS) {
    if (b.min === null || m >= b.min) return b.dir;
  }
  return "flat";
}

export function collapseDir(d: MomentumDir): "up" | "flat" | "down" {
  if (d === "strong_up" || d === "up") return "up";
  if (d === "strong_down" || d === "down") return "down";
  return "flat";
}

// ── globals ────────────────────────────────────────────────────────
export const SMALL_SAMPLE_FLOOR = 5;
export const THIN_BASE_UNIT_FLOOR = 2;
export const THIN_BASE_AVG_FLOOR = 10;

export function momentumDirDampened(
  current: number,
  avg12mo: number,
): { dir: MomentumDir; capped: boolean } {
  const raw = momentumDir(current, avg12mo);
  const shouldCap =
    avg12mo < THIN_BASE_AVG_FLOOR &&
    Math.abs(current - avg12mo) <= THIN_BASE_UNIT_FLOOR;
  if (shouldCap && (raw === "strong_up" || raw === "strong_down")) {
    const collapsed = collapseDir(raw);
    return { dir: collapsed as MomentumDir, capped: true };
  }
  return { dir: raw, capped: shouldCap && raw !== "flat" };
}

// The month-pace clause is built from the actual comparisons rather than a
// fixed string, so the sentence never claims the month beat a pace it only
// matched. The trailing-pace (year-over-year) clause is a separate signal and
// is joined with a contrast word when it runs against the month direction.
const HERO_CONTRACTS_TONE: Record<MomentumDir, string> = {
  strong_up: "A strong month for {geo} luxury.",
  up: "A solid month for {geo} luxury.",
  flat: "A steady month for {geo} luxury.",
  down: "The 3-month trend is the steadier read here.",
  strong_down: "One soft month; the 3-month trend is the better read.",
};

function pacePhrase(
  dir: MomentumDir,
  current: number,
  avg3mo: number | null | undefined,
  strong: boolean,
): string {
  const side = dir.includes("up") ? "above" : dir.includes("down") ? "below" : "in sync with";
  const lead = strong ? `Running well ${side}` : side === "in sync with" ? "In sync with" : `Running ${side}`;
  if (avg3mo == null) {
    return side === "in sync with"
      ? "In sync with its 3-month and 12-month pace."
      : `${lead} its 12-month pace.`;
  }
  if (side === "in sync with") {
    return "In sync with its 3-month and 12-month pace.";
  }
  const sameSide = side === "above" ? current > avg3mo : current < avg3mo;
  if (sameSide) return `${lead} both its 3-month and 12-month pace.`;
  if (current === avg3mo) return `${lead} its 12-month pace and level with its 3-month pace.`;
  const other = side === "above" ? "below" : "above";
  return `${lead} its 12-month pace, though ${other} its 3-month pace.`;
}

export function computeHeroContractsSowhat(input: {
  geo: string;
  current: number;
  avg12mo: number;
  avg3mo?: number | null;
  avg12moYearAgo?: number | null;
}): string {
  const { dir, capped } = momentumDirDampened(input.current, input.avg12mo);
  const strong = dir === "strong_up" || dir === "strong_down";
  let note = pacePhrase(dir, input.current, input.avg3mo, strong);
  if (capped) {
    const n = Math.abs(input.current - input.avg12mo);
    note = note.replace(/\.$/, `, a ${n}-deal swing on a small base.`);
  }
  note += ` ${HERO_CONTRACTS_TONE[dir].replace(/\{geo\}/g, input.geo)}`;

  if (input.avg12moYearAgo != null && input.avg12moYearAgo > 0) {
    const yoyDir = collapseDir(momentumDir(input.avg12mo, input.avg12moYearAgo));
    const yoyPct = Math.round(
      Math.abs((input.avg12mo - input.avg12moYearAgo) / input.avg12moYearAgo) * 100,
    );
    if (yoyDir === "flat" || yoyPct === 0) {
      note += " The underlying 12-month pace is roughly flat versus a year ago.";
    } else {
      const risen = yoyDir === "up";
      const agrees = dir.includes("up") ? risen : dir.includes("down") ? !risen : true;
      const joiner = agrees ? "has also" : "has still";
      note += ` The underlying 12-month pace ${joiner} ${risen ? "risen" : "cooled"} ${yoyPct}% versus a year ago.`;
    }
  }
  return enforceCompliance(note);
}


// ── heroVolume.template ─────────────────────────────────────────────
// Deterministic replacement for the old hand-typed hero.volumeNote copy.
// Same momentum bands as computeHeroContractsSowhat, "yearly pace" = current
// month vs. the trailing 12-month average (momentumDirDampened), banded text
// is copywriter-reviewed verbatim. Trophy clause only fires when direction is
// up/strong_up (a trophy deal "added lift" only makes sense on an up month)
// and uses the real weekStats.clearedTrophy count for that period — no new
// signal invented.
const HERO_VOLUME_NOTE: Record<MomentumDir, string> = {
  strong_up: "Well ahead of its yearly pace.",
  up: "Ahead of its yearly pace.",
  flat: "In sync with its yearly pace.",
  down: "Below its yearly pace.",
  strong_down: "Well below its yearly pace.",
};

export function computeHeroVolumeSowhat(input: {
  geo: string;
  current: number;
  avg12mo: number;
  trophyCount?: number | null;
}): string {
  const { dir } = momentumDirDampened(input.current, input.avg12mo);
  let note = HERO_VOLUME_NOTE[dir];
  if ((dir === "up" || dir === "strong_up") && input.trophyCount && input.trophyCount > 0) {
    const n = input.trophyCount;
    note += ` ${n} trophy contract${n > 1 ? "s" : ""} added lift.`;
  }
  return enforceCompliance(note);
}

// ── crossMetric.template ─────────────────────────────────────────────
// "Luxury (contracts)" = hero luxury-tier contracts, current vs. trailing
// 12-mo average (same momentumDirDampened/collapseDir logic already used for
// Hero Contracts). "Overall (volume)" = the neighborhood's ALL-residential-type
// (condo + co-op + townhouse combined, every price point, not just the luxury
// tier) dollar-volume month-over-month direction, read directly from
// payload.pulse.dollarVolumeMomClass — a real field already computed upstream
// from the same combined condo/co-op/townhouse pool that drives the Market
// Pulse section's own MoM badge. Not a proxy, not the luxury-tier volume
// reused twice, not a Manhattan-wide figure. All 9 sentences are fixed,
// copywriter-reviewed strings with no interpolation.
export function collapsePulseClass(cls: string | null | undefined): "up" | "flat" | "down" {
  const s = (cls ?? "").toLowerCase();
  if (s.includes("down") || s.includes("dn")) return "down";
  if (s.includes("up")) return "up";
  return "flat";
}

const CROSS_METRIC_SENTENCES: Record<"up" | "flat" | "down", Record<"up" | "flat" | "down", string>> = {
  up: {
    up: "Demand is accelerating, with the top of the market leading.",
    flat: "The top of the market is surpassing the field.",
    down: "Demand at the top is holding while overall volume eases.",
  },
  flat: {
    up: "Activity is rising across price points, the luxury tier steady.",
    flat: "A steady month across the market.",
    down: "Overall volume is easing while luxury holds its ground.",
  },
  down: {
    up: "The broader market is active; the top tier is quieter this month.",
    flat: "Luxury is cooling while the wider market holds.",
    down: "A slower month across the board. Read the trend, not one month.",
  },
};

export function computeCrossMetricSowhat(input: {
  luxuryContractsCurrent: number;
  luxuryContracts12moAvg: number;
  overallVolumeMomClass: string | null | undefined;
}): string {
  const luxuryDir = collapseDir(
    momentumDirDampened(input.luxuryContractsCurrent, input.luxuryContracts12moAvg).dir,
  );
  const overallDir = collapsePulseClass(input.overallVolumeMomClass);
  return enforceCompliance(CROSS_METRIC_SENTENCES[luxuryDir][overallDir]);
}

// ── unitMix.template ─────────────────────────────────────────────────
// leadGroupLabel = the bedroomMix.volumeData bucket with the largest dollar
// volume share that month. Small-sample gate reuses the existing global
// SMALL_SAMPLE_FLOOR constant (already the standing threshold for "too few
// luxury contracts this month" elsewhere on this page) against
// bedroomMix.totalContracts (the actual population being broken down here),
// rather than inventing a new threshold.
export function computeUnitMixSowhat(input: {
  geo: string;
  totalContracts: number;
  volumeData: { label: string; value: number }[];
  countData?: { label: string; value: number }[];
}): string {
  if (input.totalContracts < SMALL_SAMPLE_FLOOR || input.volumeData.length === 0) {
    return enforceCompliance(
      "Too few luxury contracts this month to break down reliably by size. Refer to the 3-month view.",
    );
  }
  // Canonicalize both series up front so a new upstream spelling can never
  // split one segment into two or mismatch the two leaders.
  const volumeData = input.volumeData.map((d) => ({ ...d, label: canonicalBedLabel(d.label) }));
  const countData = (input.countData ?? []).map((d) => ({
    ...d,
    label: canonicalBedLabel(d.label),
  }));

  const lead = volumeData.reduce((best, cur) => (cur.value > best.value ? cur : best));
  const leadGroupLabel = lead.label;
  const volumeTotal = volumeData.reduce((sum, d) => sum + (d.value > 0 ? d.value : 0), 0);
  const leadSharePct = volumeTotal > 0 ? Math.round((lead.value / volumeTotal) * 100) : null;
  const leadCount =
    countData.find((d) => sameBedSegment(d.label, leadGroupLabel))?.value ?? null;

  const countLead = countData.length > 0
    ? countData.reduce((best, cur) => (cur.value > best.value ? cur : best))
    : null;
  const countLeadLabel = countLead ? countLead.label : null;
  const splitLeaders = !!countLeadLabel && !sameBedSegment(leadGroupLabel, countLeadLabel);

  // When one segment leads both dollars and contracts, say it once: share,
  // dollars and contract count in a single sentence rather than two passes
  // that each quote the same contract number.
  const leadDollars = lead.value > 0 ? formatCurrencyMillions(lead.value) : null;
  const combinedCount = countLead ? countLead.value : leadCount;

  const dollarClause = splitLeaders
    ? leadSharePct != null
      ? `${leadGroupLabel} residences accounted for ${leadSharePct}% of ${input.geo}'s luxury dollars this month` +
        (leadCount != null ? ` on ${leadCount} ${leadCount === 1 ? "contract" : "contracts"}. ` : ". ")
      : `${leadGroupLabel} residences carried the most luxury dollars in ${input.geo} this month. `
    : leadSharePct != null
      ? `${leadGroupLabel} residences accounted for ${leadSharePct}% of ${input.geo}'s luxury dollars and were the most active segment this month` +
        (leadDollars && combinedCount != null
          ? `, with ${leadDollars} moving across ${combinedCount} signed ${combinedCount === 1 ? "contract" : "contracts"}. `
          : ". ")
      : `${leadGroupLabel} residences carried both the most luxury dollars and the most contracts in ${input.geo} this month. `;

  const countClause =
    splitLeaders && countLead
      ? `${countLeadLabel} residences were the most frequent trade, with ${countLead.value} ${countLead.value === 1 ? "contract" : "contracts"}. `
      : "";


  const closing = splitLeaders
    ? `Sellers of ${leadGroupLabel} should price against the small set of comparable large-format sales rather than the neighborhood median. ` +
      `Buyers at ${countLeadLabel} are working in the deepest part of this market, so assume other offers on anything priced correctly.`
    : `Sellers of ${leadGroupLabel} are in the segment carrying both the dollars and the activity, so recent closed comparables are current rather than stale. ` +
      `Buyers at other sizes face a thinner field of competing bids and can negotiate on that basis.`;

  return enforceCompliance(dollarClause + countClause + closing);
}


export const smallSampleString = (n: number) =>
  // library reads "— too thin to read." Compliance forbids em dashes; swap.
  `Only ${n} deals this month. Too thin to read. Refer to the 3-month trend.`;
export const PROVISIONAL_STRING =
  "Provisional — there can be some recording lag, so the current month may revise upward.".replace(
    /—/g,
    "-",
  );

// ── formatters ─────────────────────────────────────────────────────
function formatCurrencyMillions(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    // one decimal if < 10, else whole
    return m < 10 ? `$${m.toFixed(2)}M` : `$${m.toFixed(2)}M`;
  }
  return `$${Math.round(n).toLocaleString()}`;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function stripEmDashes(s: string): string {
  return s.replace(/—/g, "-").replace(/–/g, "-");
}

// Compliance sweep (library "compliance").
const BANNED = [
  /family-sized/gi,
  /off-market/gi,
  /\bapartment(s)?\b/gi,
];
export function enforceCompliance(s: string): string {
  let out = stripEmDashes(s);
  for (const rx of BANNED) out = out.replace(rx, (m) =>
    /apartment/i.test(m) ? "residence" : "",
  );
  return out.replace(/\s{2,}/g, " ").trim();
}

// ── seller/buyer action clauses ────────────────────────────────────
const ACTIONS = {
  seller_market: {
    seller:
      "price to current activity, and a well-prepared listing still moves quickly",
    buyer:
      "bring financing ready and expect competition on anything priced right. Look closely within your submarket. Building-by-building comps carry the clearest signal",
  },
  balanced: {
    seller: "price to the data and lead with a clean listing",
    buyer:
      "you have room to make a strategic offer. Look closely within your submarket. Building-by-building comps carry the clearest signal",
  },
  buyer_market: {
    seller: "price to current market activity",
    buyer:
      "there is room to negotiate on price and terms, and look closely within your submarket. Building-by-building comps carry the clearest signal",
  },
} as const;

// ── supplyLeverage bands ───────────────────────────────────────────
type LeverageState = "seller_market" | "balanced" | "buyer_market";
const SUPPLY_BANDS: {
  max: number | null;
  label: string;
  state: LeverageState;
  lead: string;
}[] = [
  { max: 4, label: "an acute seller's market", state: "seller_market", lead: "well-priced listings move in days; sellers hold all the leverage" },
  { max: 6, label: "a seller's market", state: "seller_market", lead: "good listings move quickly; sellers hold the leverage" },
  { max: 8, label: "balanced, tilting to sellers", state: "balanced", lead: "priced-right listings still move; modest room to negotiate" },
  { max: 9, label: "balanced", state: "balanced", lead: "neither side has a structural edge" },
  { max: 12, label: "a buyer's market", state: "buyer_market", lead: "buyers hold the leverage" },
  { max: null, label: "a deep buyer's market", state: "buyer_market", lead: "supply is well ahead of demand; buyers control the pace" },
];

function supplyBandFor(months: number) {
  for (const b of SUPPLY_BANDS) {
    if (b.max === null || months <= b.max) return b;
  }
  return SUPPLY_BANDS[SUPPLY_BANDS.length - 1];
}

// ── neighborhoodRank.template ──────────────────────────────────────
export interface RankInputs {
  geo: string;
  // Position on luxury intensity among QUALIFYING neighborhoods only. Null when
  // this neighborhood does not itself clear the floor, in which case no rank is
  // published at all.
  rankOrdinal: number | null;
  nextNeighborhood?: string | null;
  nextPct?: number | null; // luxury share % of the next neighborhood down the list
  ownPct?: number | null; // this neighborhood's own luxury share %
  // True only when the neighbor itself clears the qualification bar we publish
  // against (at least MIN_QUALIFIED_LUX_CONTRACTS luxury contracts over the
  // trailing 52 weeks). Thin submarkets can post a high share off a handful of
  // deals, so they are never cited as a comparison.
  nextQualified?: boolean;
  // Rank by trailing-12-month luxury dollar volume among qualifying neighborhoods.
  volumeRank?: number | null;
  // Count of neighborhoods clearing the qualification floor, the denominator
  // for both ranks.
  volumeRankTotal?: number | null;

  localLine: number; // median of neighborhood contracts above Manhattan P90
  manhattanLuxuryMedian: number; // median of Manhattan contracts above P90
  luxuryContractsCount: number;
  trailingContractsTotal: number;
  localLineDisplay?: string;
  manhattanLuxuryMedianDisplay?: string;
}

// A neighborhood needs at least this many luxury contracts over the trailing
// 52 weeks before its share is stable enough to quote.
export const MIN_QUALIFIED_LUX_CONTRACTS = 11;

export function computeNeighborhoodRankSowhat(r: RankInputs): string {
  // Deliberately no count here. The reader only ever sees a top ten board, so
  // quoting a qualifying set of 14 raises a question the page does not answer.
  // The qualification rule is stated in plain words instead.
  const scope = " among Manhattan neighborhoods with steady luxury activity";


  // When the neighbor's share rounds to the same number, "just ahead of X at 11%"
  // reads as a contradiction. Say tied and cite the shared share once.
  const tiedWithNeighbor =
    r.nextPct != null && r.ownPct != null && Math.round(r.nextPct) === Math.round(r.ownPct);
  const citeNeighbor = r.nextQualified !== false && !!r.nextNeighborhood;
  const rankContext =
    r.rankOrdinal === 1
      ? " and leads the borough on that measure"
      : citeNeighbor && tiedWithNeighbor
        ? `, effectively tied with ${r.nextNeighborhood} at ${Math.round(r.ownPct as number)}% each and separated only by rounding`
        : citeNeighbor && r.nextPct != null && r.ownPct != null && r.nextPct > r.ownPct
          ? `, just behind ${r.nextNeighborhood} at ${r.nextPct}%`
          : citeNeighbor && r.nextPct != null
            ? `, just ahead of ${r.nextNeighborhood} at ${r.nextPct}%`
            : "";


  const pctDelta = Math.round(((r.localLine - r.manhattanLuxuryMedian) / r.manhattanLuxuryMedian) * 100);
  const comparison = pctDelta === 0
    ? "in line with"
    : `${Math.abs(pctDelta)}% ${pctDelta > 0 ? "above" : "below"}`;

  const localLine = r.localLineDisplay ?? formatCurrencyMillions(r.localLine);
  const manhattanLuxuryMedian =
    r.manhattanLuxuryMedianDisplay ?? formatCurrencyMillions(r.manhattanLuxuryMedian);

  const sharePct =
    r.ownPct != null
      ? Math.round(r.ownPct)
      : r.trailingContractsTotal > 0
        ? Math.round((r.luxuryContractsCount / r.trailingContractsTotal) * 100)
        : 0;

  // Two different rankings, so name each one plainly and keep them apart. Both
  // are positions among qualifying neighborhoods only.
  const volumeSentence =
    r.volumeRank != null
      ? `${r.geo} ranks ${ordinal(r.volumeRank)} for luxury dollar volume over the trailing 12 months${scope}, a measure of how much money moves through the neighborhood. `
      : "";

  // Share sentence stands on its own when the neighborhood does not clear the
  // qualification floor, rather than quoting a rank the registry cannot support.
  const intensitySentence =
    r.rankOrdinal != null
      ? `${volumeSentence ? "It ranks" : `${r.geo} ranks`} ${ordinal(r.rankOrdinal)} for luxury intensity, the share of its contracts clearing the Manhattan Luxury (Top 10%) price line${rankContext}: ` +
        `${r.luxuryContractsCount} of ${r.trailingContractsTotal} trailing contracts, or ${sharePct}%. ` +
        `Size and concentration are different things, so a neighborhood can move large dollar volume without a high share of its deals clearing the luxury line. `
      : `${r.luxuryContractsCount} of ${r.trailingContractsTotal} trailing ${r.geo} contracts cleared the Manhattan Luxury (Top 10%) price line, or ${sharePct}%. ` +
        `That is too few luxury contracts to rank the neighborhood against the active luxury neighborhoods, so no position is quoted. `;


  const sentence =
    volumeSentence +
    intensitySentence +
    `The median of those ${r.geo} deals is ${localLine}, ${comparison} the ${manhattanLuxuryMedian} median for all Manhattan Luxury (Top 10%) deals. ` +
    `Sellers: measure against qualified ${r.geo} luxury deals and the Manhattan Luxury (Top 10%) median. ` +
    `Buyers: compare like with like, using deals above the same Manhattan Luxury (Top 10%) price line.`;



  return enforceCompliance(sentence);
}


// ── supplyLeverage.template ────────────────────────────────────────
export interface SupplyInputs {
  geo: string;
  luxuryMonthsOfSupply: number;
  boroughMonthsOfSupply: number;
}

export function computeSupplyLeverageSowhat(s: SupplyInputs): string {
  const band = supplyBandFor(s.luxuryMonthsOfSupply);
  const monthsRounded = Math.round(s.luxuryMonthsOfSupply);
  const tighterOrLooser =
    s.luxuryMonthsOfSupply < s.boroughMonthsOfSupply - 0.25
      ? "tighter"
      : s.luxuryMonthsOfSupply > s.boroughMonthsOfSupply + 0.25
        ? "looser"
        : "in line with";
  const actions = ACTIONS[band.state];

  const compare =
    tighterOrLooser === "in line with"
      ? "in line with the borough"
      : `${tighterOrLooser} than the borough`;

  const leadCapitalized = band.lead.charAt(0).toUpperCase() + band.lead.slice(1);
  const sentence =
    `At ~${monthsRounded} months of luxury supply, ${s.geo} is ${band.label} and sits ${compare}. ` +
    `${leadCapitalized}. ` +
    `Sellers: ${actions.seller}. ` +
    `Buyers: ${actions.buyer}.`;

  return enforceCompliance(sentence);
}

// ── daysOnMarket.template (bonus; deterministic) ───────────────────
const DOM_PHRASE: Record<MomentumDir, string> = {
  strong_up: "sitting notably longer than the past year",
  up: "taking somewhat longer to sell than the past year",
  flat: "in sync with the past year",
  down: "moving somewhat faster than the past year",
  strong_down: "moving notably faster than the past year",
};

export function computeDaysOnMarketSowhat(d: {
  geo: string;
  currentDays: number;
  avg12moDays: number;
}): string {
  const dir = momentumDir(d.currentDays, d.avg12moDays);
  const phrase = DOM_PHRASE[dir];
  const sentence =
    `${d.geo} luxury contracts are taking approximately ${d.currentDays} days from listing to signing, ${phrase}. ` +
    `Well-priced residences still move; the overpriced ones sit. ` +
    `Sellers: time on market is the market responding to your price. ` +
    `Buyers: a longer-sitting listing is where your negotiating room lives.`;
  return enforceCompliance(sentence);
}
