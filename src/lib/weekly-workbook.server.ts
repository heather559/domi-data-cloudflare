// Server-only: builds the weekly Excel workbook that goes out Monday mornings.
// Never import from client components.
import * as XLSX from "xlsx";
import { NEIGHBORHOOD_SLUGS, buildBlocks, leaderOf, type Row } from "./sowhat-audit";
import { canonicalBedLabel, bedLabelAliasMap, bedSortIndex } from "./bedroom-labels";
import type { WeeklyReportRow } from "./weekly-report.functions";
import type { NeighborhoodReport } from "./neighborhood-report.functions";
import {
  autoFormats,
  type Cell,
  delta,
  frac,
  n,
  parseMoneyDisplay,
  pct,
  sheet,
  trailingAvg,
} from "./workbook-common.server";
import { reconcileWeeklyHero, withReconciledHero } from "./weekly-hero-reconcile";


async function loadWeekly(): Promise<WeeklyReportRow | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as any)
    .from("weekly_report")
    .select("week_start, week_end, generated_at, is_provisional, payload")
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[weekly-workbook] weekly_report load failed:", error);
    return null;
  }
  // Same hero reconciliation the site applies, so exports match the page.
  return data ? withReconciledHero(data as WeeklyReportRow) : null;
}

interface WeekRow {
  week_start: string;
  week_end: string;
  payload: any;
  source?: string;
}

/**
 * Every week we hold, oldest first: the hand-kept tracker from May 2024 first,
 * then the published feed, which wins wherever the two overlap.
 */
async function loadWeekHistory(): Promise<WeekRow[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { legacyWeeks, legacyAsWeekRow, LIVE_SOURCE } = await import("./legacy-tracker.server");
  const seen = new Map<string, WeekRow>();
  for (const w of legacyWeeks()) seen.set(w.week_start, legacyAsWeekRow(w));
  for (const table of ["weekly_report_archive", "weekly_report"]) {
    const { data, error } = await (supabaseAdmin as any)
      .from(table)
      .select("week_start, week_end, payload")
      .order("week_start", { ascending: true });
    if (error) {
      console.error(`[weekly-workbook] ${table} load failed:`, error);
      continue;
    }
    for (const row of (data ?? []) as WeekRow[]) {
      // Live-feed weeks get the same hero reconciliation as the site.
      const payload = reconcileWeeklyHero(row.payload).payload;
      seen.set(row.week_start, { ...row, payload, source: LIVE_SOURCE });
    }
  }
  return Array.from(seen.values()).sort((a, b) => a.week_start.localeCompare(b.week_start));
}

async function loadNeighborhoods(): Promise<Row[]> {
  const { getNeighborhoodReportBySlug } = await import("./neighborhood-report.functions");
  const rows: Row[] = [];
  for (const slug of NEIGHBORHOOD_SLUGS) {
    try {
      const report = (await getNeighborhoodReportBySlug({
        data: { slug },
      })) as NeighborhoodReport | null;
      rows.push({ slug, report });
    } catch (e) {
      console.error("[weekly-workbook] neighborhood report failed", slug, e);
      rows.push({ slug, report: null });
    }
  }
  return rows;
}

function readMeSheet(weekly: WeeklyReportRow | null, generatedAt: string): Cell[][] {
  return [
    ["Domi Data weekly tracker"],
    [],
    ["Generated (UTC)", generatedAt],
    ["Week start", weekly?.week_start ?? "no weekly_report row"],
    ["Week end", weekly?.week_end ?? ""],
    ["Provisional", weekly?.is_provisional ? "yes" : "no"],
    [],
    ["Worksheet", "What it holds"],
    ["Manhattan Weekly", "Headline luxury and market-wide figures for the week, with WoW, YoY and the gap to the 52 week average."],
    ["Weekly History", "One row per week from 20 May 2024 to today: condo, co-op, townhouse and luxury figures with WoW, YoY and deltas against the trailing 4, 13 and 52 week averages. The Source column says whether the week came from the live feed or the hand-kept tracker."],
    ["Legacy Bedroom Mix", "Weekly contracts and dollar volume by bedroom count from the hand-kept tracker, May 2024 onward."],
    ["Legacy Price Bands", "Weekly contracts and dollar volume by price band (below $1M through $10M+) from the hand-kept tracker."],
    ["By Property Type", "Condo, co-op and townhouse contract, price and days-on-market detail."],
    ["Leaderboard", "Neighborhood ranking by trailing 52-week luxury dollar volume."],
    ["Neighborhood Monthly", "One row per covered neighborhood from the monthly report payload."],
    ["So What Audit", "Every generated sentence with its logic branch, inputs and contradiction flags."],
    ["Bedroom Label Map", "Alias to canonical bedroom label, with sort order."],
    [],
    ["Percentages are formatted as percentages. Blank means the source had no value."],
    ["History before the live feed comes from Manhattan Contract Data Tracker (beginning 5/20/24). Where both sources hold a week, the live feed is used."],
    ["Data powered by Marketproof."],
  ];
}

function manhattanSheet(weekly: WeeklyReportRow | null): Cell[][] {
  const rows: Cell[][] = [
    ["Metric", "Value", "WoW", "YoY", "52wk avg", "vs 52wk avg"],
  ];
  if (!weekly) return [...rows, ["No weekly_report row found", null, null, null, null, null]];
  const p = weekly.payload;
  const h = p.hero ?? ({} as any);
  const mp = p.market_pulse?.all ?? ({} as any);
  rows.push(["Luxury cutoff ($)", n(h.luxury_cutoff), null, null, null]);
  rows.push([
    "Luxury contracts",
    n(h.luxury_count),
    pct(h.luxury_count_wow_pct),
    pct(h.luxury_count_yoy_pct),
    n(h.luxury_count_avg52),
    delta(h.luxury_count, h.luxury_count_avg52),
  ]);
  rows.push([
    "Luxury dollar volume ($)",
    n(h.luxury_volume),
    pct(h.luxury_volume_wow_pct),
    pct(h.luxury_volume_yoy_pct),
    n(h.luxury_volume_avg52),
    delta(h.luxury_volume, h.luxury_volume_avg52),
  ]);
  rows.push(["Prime cutoff ($)", n(h.prime_cutoff), null, null, null]);
  rows.push(["Prime contracts", n(h.prime_count), null, null, null]);
  rows.push(["Trophy cutoff ($)", n(h.trophy_cutoff), null, null, null]);
  rows.push(["Trophy contracts", n(h.trophy_count), null, null, null]);
  rows.push(["Median price ($)", n(h.median_price), null, null, null]);
  rows.push(["Median price / sq ft ($)", n(h.median_ppsf), null, null, null]);
  rows.push(["Average days on market", n(h.avg_dom), null, null, null]);
  rows.push([]);
  rows.push([
    "All contracts",
    n(mp.contracts),
    pct(mp.contracts_wow_pct),
    pct(mp.contracts_yoy_pct),
    n(mp.contracts_avg52),
    delta(mp.contracts, mp.contracts_avg52),
  ]);
  rows.push([
    "All dollar volume ($)",
    n(mp.volume),
    pct(mp.volume_wow_pct),
    pct(mp.volume_yoy_pct),
    n(mp.volume_avg52),
    delta(mp.volume, mp.volume_avg52),
  ]);
  rows.push([]);
  rows.push(["Tier", "Cutoff ($)", "Avg $/sq ft", "52wk volume ($)", "52wk cleared"]);
  for (const key of ["luxury", "prime", "trophy"] as const) {
    const t = p.tiers?.[key];
    if (!t) continue;
    rows.push([
      key[0].toUpperCase() + key.slice(1),
      n(t.cutoff),
      n(t.ppsf_avg),
      n(t.volume_52wk),
      n(t.cleared_52wk),
    ]);
  }
  rows.push([]);
  rows.push(["Bedroom mix", "Dollar volume ($)", "Contracts"]);
  const mixVol = p.bedroom_mix?.volume ?? {};
  const mixCount = p.bedroom_mix?.count ?? {};
  const labels = Array.from(
    new Set([...Object.keys(mixVol ?? {}), ...Object.keys(mixCount ?? {})]),
  )
    .map((raw) => ({ raw, label: canonicalBedLabel(raw) }))
    .sort((a, b) => bedSortIndex(a.label) - bedSortIndex(b.label));
  for (const { raw, label } of labels) {
    rows.push([label, n((mixVol as any)?.[raw]), n((mixCount as any)?.[raw])]);
  }
  return rows;
}

function typeSheet(weekly: WeeklyReportRow | null): Cell[][] {
  const header: Cell[] = [
    "Property type",
    "Contracts",
    "Contracts WoW",
    "Contracts YoY",
    "Contract volume ($)",
    "Recorded sales",
    "$/sq ft",
    "$/sq ft YoY",
    "Discount %",
    "Days on market",
  ];
  const rows: Cell[][] = [header];
  const byType = weekly?.payload?.market_pulse?.by_type;
  if (!byType) return [...rows, ["No data", null, null, null, null, null, null, null, null, null]];
  const names: Record<string, string> = { condo: "Condo", coop: "Co-op", townhouse: "Townhouse" };
  for (const key of ["condo", "coop", "townhouse"] as const) {
    const t = byType[key];
    if (!t) continue;
    rows.push([
      names[key],
      n(t.contracts),
      pct(t.contracts_wow_pct),
      pct(t.contracts_yoy_pct),
      n(t.contracts_volume),
      n(t.recorded_sales),
      n(t.ppsf),
      pct(t.ppsf_yoy_pct),
      pct(t.discount_pct),
      n(t.dom),
    ]);
  }
  return rows;
}

function leaderboardSheet(weekly: WeeklyReportRow | null): Cell[][] {
  const rows: Cell[][] = [
    [
      "Rank",
      "Neighborhood",
      "52wk volume ($)",
      "52wk contracts",
      "Local median ($)",
      "Avg sale ($)",
      "Luxury share %",
      "Week contracts",
      "Week volume ($)",
      "Rank change",
    ],
  ];
  for (const r of weekly?.payload?.leaderboard ?? []) {
    rows.push([
      n(r.rank),
      r.name ?? "",
      n(r.vol_52wk),
      n(r.contracts_52wk),
      n(r.local_median),
      n(r.avg_sale),
      pct(r.pct_lux),
      n(r.wk_contracts),
      n(r.wk_volume),
      n(r.rank_delta),
    ]);
  }
  if (rows.length === 1) rows.push(["No leaderboard rows", null, null, null, null, null, null, null, null, null]);
  return rows;
}


/**
 * One row per published week, oldest first. Mirrors the manual tracker: raw
 * counts and volumes by property type, then week-over-week, year-over-year and
 * deltas against the trailing 4, 13 and 52 week averages.
 */
function weeklyHistorySheet(weeks: WeekRow[]): Cell[][] {
  const header: Cell[] = [
    "Week start",
    "Week end",
    "Condo contracts",
    "Condo volume ($)",
    "Co-op contracts",
    "Co-op volume ($)",
    "Townhouse contracts",
    "Townhouse volume ($)",
    "Total contracts",
    "Total volume ($)",
    "Luxury contracts",
    "Luxury volume ($)",
    "Luxury share of contracts",
    "Luxury cutoff ($)",
    "Median price ($)",
    "Median $/sq ft",
    "Avg days on market",
    "Luxury contracts WoW",
    "Luxury contracts YoY",
    "Luxury contracts vs 4wk avg",
    "Luxury contracts vs 13wk avg",
    "Luxury contracts vs 52wk avg",
    "Luxury volume WoW",
    "Luxury volume YoY",
    "Luxury volume vs 4wk avg",
    "Luxury volume vs 13wk avg",
    "Luxury volume vs 52wk avg",
    "Total contracts WoW",
    "Total contracts YoY",
    "Total contracts vs 13wk avg",
    "Total contracts vs 52wk avg",
    "Total volume WoW",
    "Total volume YoY",
    "Total volume vs 13wk avg",
    "Total volume vs 52wk avg",
    "Source",
  ];
  if (!weeks.length) {
    return [header, ["No published weeks found", ...new Array(header.length - 1).fill(null)] as Cell[]];
  }

  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const luxCount = weeks.map((w) => num(w.payload?.hero?.luxury_count));
  const luxVolume = weeks.map((w) => num(w.payload?.hero?.luxury_volume));
  const allCount = weeks.map((w) => num(w.payload?.market_pulse?.all?.contracts));
  const allVolume = weeks.map((w) => num(w.payload?.market_pulse?.all?.volume));

  // The legacy tracker stored levels, not change rates, so week-over-week and
  // year-over-year are derived from the series itself when the feed has none.
  const change = (series: (number | null)[], i: number, back: number): Cell => {
    const now = series[i];
    const then = series[i - back];
    if (typeof now !== "number" || typeof then !== "number" || !then) return null;
    return now / then - 1;
  };
  const wow = (series: (number | null)[], i: number) => change(series, i, 1);
  const yoy = (series: (number | null)[], i: number) => change(series, i, 52);

  const rows: Cell[][] = [header];
  weeks.forEach((w, i) => {
    const p = w.payload ?? {};
    const h = p.hero ?? {};
    const t = p.market_pulse?.by_type ?? {};
    const share =
      typeof luxCount[i] === "number" && typeof allCount[i] === "number" && allCount[i]
        ? (luxCount[i] as number) / (allCount[i] as number)
        : null;
    rows.push([
      w.week_start,
      w.week_end,
      n(t.condo?.contracts),
      n(t.condo?.contracts_volume),
      n(t.coop?.contracts),
      n(t.coop?.contracts_volume),
      n(t.townhouse?.contracts),
      n(t.townhouse?.contracts_volume),
      n(allCount[i]),
      n(allVolume[i]),
      n(luxCount[i]),
      n(luxVolume[i]),
      share,
      n(h.luxury_cutoff),
      n(h.median_price),
      n(h.median_ppsf),
      n(h.avg_dom),
      pct(h.luxury_count_wow_pct) ?? wow(luxCount, i),
      pct(h.luxury_count_yoy_pct) ?? yoy(luxCount, i),
      delta(luxCount[i], trailingAvg(luxCount, i, 4)),
      delta(luxCount[i], trailingAvg(luxCount, i, 13)),
      delta(luxCount[i], n(h.luxury_count_avg52) ?? trailingAvg(luxCount, i, 52)),
      pct(h.luxury_volume_wow_pct) ?? wow(luxVolume, i),
      pct(h.luxury_volume_yoy_pct) ?? yoy(luxVolume, i),
      delta(luxVolume[i], trailingAvg(luxVolume, i, 4)),
      delta(luxVolume[i], trailingAvg(luxVolume, i, 13)),
      delta(luxVolume[i], n(h.luxury_volume_avg52) ?? trailingAvg(luxVolume, i, 52)),
      pct(p.market_pulse?.all?.contracts_wow_pct) ?? wow(allCount, i),
      pct(p.market_pulse?.all?.contracts_yoy_pct) ?? yoy(allCount, i),
      delta(allCount[i], trailingAvg(allCount, i, 13)),
      delta(allCount[i], n(p.market_pulse?.all?.contracts_avg52) ?? trailingAvg(allCount, i, 52)),
      pct(p.market_pulse?.all?.volume_wow_pct) ?? wow(allVolume, i),
      pct(p.market_pulse?.all?.volume_yoy_pct) ?? yoy(allVolume, i),
      delta(allVolume[i], trailingAvg(allVolume, i, 13)),
      delta(allVolume[i], n(p.market_pulse?.all?.volume_avg52) ?? trailingAvg(allVolume, i, 52)),
      w.source ?? "",
    ]);
  });
  return rows;
}

function neighborhoodSheet(rows: Row[]): Cell[][] {
  const out: Cell[][] = [
    [
      "Neighborhood",
      "Slug",
      "Period",
      "Luxury contracts",
      "3mo avg",
      "12mo avg",
      "Luxury volume ($)",
      "Local luxury median ($)",
      "Manhattan rank (intensity)",
      "Luxury share %",
      "Months of supply",
      "Borough months of supply",
      "Days on market",
      "12mo avg days",
      "Total contracts (mix)",
      "Dollar leader",
      "Deal-count leader",
    ],
  ];
  for (const { slug, report } of rows) {
    if (!report) {
      out.push([slug, slug, "no payload row", ...new Array(14).fill(null)] as Cell[]);
      continue;
    }
    const p = report.payload as any;
    const volLead = leaderOf(p.bedroomMix?.volumeData);
    const countLead = leaderOf(p.bedroomMix?.countData);
    out.push([
      p.geo ?? slug,
      slug,
      p.periodLabel ?? report.period ?? "",
      n(p.hero?.luxuryContractsCount),
      n(p.hero?.luxuryContracts3moAvg),
      n(p.hero?.luxuryContracts12moAvg),
      parseMoneyDisplay(p.hero?.luxuryVolumeDisplay),
      parseMoneyDisplay(p.rank?.localLineDisplay),
      n(p.rank?.manhattanRank),
      pct(p.rank?.luxurySharePct),
      n(p.supply?.luxury?.monthsOfSupply),
      n(p.supply?.boroughMonthsOfSupply),
      n(p.dom?.currentDays),
      n(p.dom?.avg12moDays),
      n(p.bedroomMix?.totalContracts),
      volLead ? canonicalBedLabel(volLead.label) : "",
      countLead ? canonicalBedLabel(countLead.label) : "",
    ]);
  }
  return out;
}

function auditSheet(rows: Row[]): { aoa: Cell[][]; contradictions: number } {
  const out: Cell[][] = [
    [
      "Neighborhood",
      "Slug",
      "Period",
      "Block key",
      "Block",
      "Sentence",
      "Branch",
      "Flag",
      "Contradictions",
      "Inputs",
      "Dollar leader",
      "Deal-count leader",
      "Dollar leader (raw)",
      "Deal-count leader (raw)",
    ],
  ];
  let contradictions = 0;
  for (const { slug, report } of rows) {
    if (!report) {
      out.push([slug, slug, "", "", "", "no payload row", ...new Array(8).fill("")] as Cell[]);
      continue;
    }
    const p = report.payload as any;
    const volLead = leaderOf(p.bedroomMix?.volumeData);
    const countLead = leaderOf(p.bedroomMix?.countData);
    for (const b of buildBlocks(report)) {
      if (b.audit?.length) contradictions += 1;
      out.push([
        p.geo ?? slug,
        slug,
        p.periodLabel ?? report.period ?? "",
        b.key,
        b.label,
        b.sentence ?? "",
        b.branch,
        b.flag ?? "",
        (b.audit ?? []).join(" | "),
        b.inputs.map(([k, v]) => `${k}=${v || "n/a"}`).join("; "),
        volLead ? canonicalBedLabel(volLead.label) : "",
        countLead ? canonicalBedLabel(countLead.label) : "",
        volLead ? volLead.label : "",
        countLead ? countLead.label : "",
      ]);
    }
  }
  return { aoa: out, contradictions };
}

function labelMapSheet(): Cell[][] {
  const out: Cell[][] = [["Alias (normalized)", "Canonical label", "Sort index"]];
  for (const { alias, canonical } of bedLabelAliasMap()) {
    out.push([alias, canonical, bedSortIndex(canonical)]);
  }
  return out;
}

/** Weekly bedroom counts and volumes as recorded in the hand-kept tracker. */
function legacyBedroomSheet(
  weeks: import("./legacy-tracker.server").LegacyWeek[],
  keys: readonly string[],
): Cell[][] {
  const header: Cell[] = ["Week start", "Total contracts"];
  for (const k of keys) {
    const label = canonicalBedLabel(k);
    header.push(`${label} contracts`, `${label} share`, `${label} volume ($)`, `${label} volume share`);
  }
  const rows: Cell[][] = [header];
  for (const w of weeks) {
    const mix = w.bedroom?.mix;
    if (!mix) continue;
    const total = w.bedroom?.total_sales ?? null;
    const volTotal = keys.reduce((sum, k) => sum + (mix[k]?.volume ?? 0), 0);
    const row: Cell[] = [w.week_start, n(total)];
    for (const k of keys) {
      const seg = mix[k];
      row.push(
        n(seg?.contracts),
        total && seg?.contracts != null ? seg.contracts / total : null,
        n(seg?.volume),
        volTotal && seg?.volume != null ? seg.volume / volTotal : null,
      );
    }
    rows.push(row);
  }
  if (rows.length === 1) rows.push(["No legacy bedroom rows", ...new Array(header.length - 1).fill(null)] as Cell[]);
  return rows;
}

/** Weekly contract counts and dollar volume by price band from the tracker. */
function legacyPriceBandSheet(
  weeks: import("./legacy-tracker.server").LegacyWeek[],
  bands: readonly string[],
): Cell[][] {
  const header: Cell[] = ["Week start"];
  for (const b of bands) header.push(`${b} contracts`, `${b} volume ($)`, `${b} share of volume`);
  const rows: Cell[][] = [header];
  for (const w of weeks) {
    const pp = w.price_points;
    if (!pp) continue;
    const volTotal = bands.reduce((sum, b) => sum + (pp[b]?.volume ?? 0), 0);
    const row: Cell[] = [w.week_start];
    for (const b of bands) {
      const seg = pp[b];
      row.push(
        n(seg?.contracts),
        n(seg?.volume),
        volTotal && seg?.volume != null ? seg.volume / volTotal : null,
      );
    }
    rows.push(row);
  }
  if (rows.length === 1) rows.push(["No legacy price band rows", ...new Array(header.length - 1).fill(null)] as Cell[]);
  return rows;
}

/** Weekly contract and new-listing detail per tracked area from the tracker. */
function legacyNeighborhoodSheet(
  rows: import("./legacy-tracker.server").LegacyNeighborhoodWeek[],
): Cell[][] {
  const header: Cell[] = [
    "Week start",
    "Area",
    "Contracts signed",
    "Contracts WoW %",
    "Contract volume ($)",
    "Contract volume WoW %",
    "Avg contract price ($)",
    "Avg contract PPSF ($)",
    "Days on market",
    "New listings",
    "New listings WoW %",
    "New listing volume ($)",
    "New listing volume WoW %",
    "New listing avg price ($)",
    "New listing avg PPSF ($)",
  ];
  const aoa: Cell[][] = [header];
  for (const r of rows) {
    aoa.push([
      r.week_start,
      r.area,
      n(r.contracts),
      frac(r.contracts_wow),
      n(r.volume),
      frac(r.volume_wow),
      n(r.avg_price),
      n(r.avg_ppsf),
      n(r.dom),
      n(r.new_listings),
      frac(r.new_listings_wow),
      n(r.nl_volume),
      frac(r.nl_volume_wow),
      n(r.nl_avg_price),
      n(r.nl_avg_ppsf),
    ]);
  }
  if (aoa.length === 1)
    aoa.push(["No legacy neighborhood rows", ...new Array(header.length - 1).fill(null)] as Cell[]);
  return aoa;
}



export interface WeeklyWorkbook {
  base64: string;
  filename: string;
  weekStart: string | null;
  weekEnd: string | null;
  isProvisional: boolean;
  neighborhoodsWithData: number;
  neighborhoodsTotal: number;
  contradictions: number;
  generatedAt: string;
}

export async function buildWeeklyWorkbook(): Promise<WeeklyWorkbook> {
  const generatedAt = new Date().toISOString();
  const [weekly, history, nbhd] = await Promise.all([
    loadWeekly(),
    loadWeekHistory(),
    loadNeighborhoods(),
  ]);
  const audit = auditSheet(nbhd);

  const wb = XLSX.utils.book_new();
  sheet(wb, "Read Me", readMeSheet(weekly, generatedAt), [28, 70]);
  {
    // Vertical sheet: units come from each metric's own label, not the column.
    const aoa = manhattanSheet(weekly);
    sheet(
      wb,
      "Manhattan Weekly",
      aoa,
      [30, 18, 12, 12, 16, 14],
      autoFormats(aoa[0]),
      { labelCol: 0, valueCols: [1, 4] },
    );
  }
  {
    const aoa = weeklyHistorySheet(history);
    const widths = [12, 12, ...new Array(aoa[0].length - 2).fill(16)];
    sheet(wb, "Weekly History", aoa, widths, autoFormats(aoa[0]));
  }
  {
    const { legacyWeeks, legacyNeighborhoodWeeks, LEGACY_BED_KEYS, LEGACY_PRICE_BANDS } =
      await import("./legacy-tracker.server");
    const legacy = legacyWeeks();
    {
      const aoa = legacyNeighborhoodSheet(legacyNeighborhoodWeeks());
      sheet(wb, "Legacy Neighborhoods", aoa, [12, 18, ...new Array(aoa[0].length - 2).fill(16)], autoFormats(aoa[0]));
    }
    {
      const aoa = legacyBedroomSheet(legacy, LEGACY_BED_KEYS);
      sheet(wb, "Legacy Bedroom Mix", aoa, [12, 14, ...new Array(aoa[0].length - 2).fill(15)], autoFormats(aoa[0]));
    }
    {
      const aoa = legacyPriceBandSheet(legacy, LEGACY_PRICE_BANDS);
      sheet(wb, "Legacy Price Bands", aoa, [12, ...new Array(aoa[0].length - 1).fill(16)], autoFormats(aoa[0]));
    }
  }
  {
    const aoa = typeSheet(weekly);
    sheet(wb, "By Property Type", aoa, [16, 12, 14, 14, 20, 14, 12, 12, 12, 16], autoFormats(aoa[0]));
  }
  {
    const aoa = leaderboardSheet(weekly);
    sheet(wb, "Leaderboard", aoa, [8, 26, 18, 16, 18, 16, 14, 14, 18, 12], autoFormats(aoa[0]));
  }
  {
    const aoa = neighborhoodSheet(nbhd);
    sheet(
      wb,
      "Neighborhood Monthly",
      aoa,
      [22, 20, 16, 16, 12, 12, 16, 20, 22, 14, 16, 22, 14, 14, 18, 16, 18],
      autoFormats(aoa[0]),
    );
  }
  sheet(wb, "So What Audit", audit.aoa, [20, 18, 16, 16, 30, 80, 30, 26, 40, 60, 16, 16, 16, 16]);
  sheet(wb, "Bedroom Label Map", labelMapSheet(), [26, 18, 12]);

  const base64 = XLSX.write(wb, { bookType: "xlsx", type: "base64", cellStyles: true }) as string;
  const stamp = (weekly?.week_start ?? generatedAt.slice(0, 10)).slice(0, 10);

  return {
    base64,
    filename: `domi-data-weekly-tracker-${stamp}.xlsx`,
    weekStart: weekly?.week_start ?? null,
    weekEnd: weekly?.week_end ?? null,
    isProvisional: !!weekly?.is_provisional,
    neighborhoodsWithData: nbhd.filter((r) => r.report).length,
    neighborhoodsTotal: nbhd.length,
    contradictions: audit.contradictions,
    generatedAt,
  };
}
