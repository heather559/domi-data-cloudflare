// Server-only: builds the monthly Excel workbook (the new month plus every
// covered neighborhood). Never import from client components.
import * as XLSX from "xlsx";
import { NEIGHBORHOOD_SLUGS, buildBlocks, leaderOf, type Row } from "./sowhat-audit";
import { canonicalBedLabel, bedLabelAliasMap, bedSortIndex } from "./bedroom-labels";
import type { NeighborhoodReport } from "./neighborhood-report.functions";
import {
  FMT,
  autoFormats,
  type Cell,
  delta,
  n,
  parseMoneyDisplay,
  parsePctDisplay,
  pct,
  sheet,
  trailingAvg,
} from "./workbook-common.server";

interface MonthRow {
  month_start: string;
  month_end?: string | null;
  is_provisional?: boolean | null;
  payload: any;
}

async function loadMonthly(): Promise<MonthRow | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as any)
    .from("monthly_report")
    .select("month_start, month_end, is_provisional, payload")
    .order("month_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[monthly-workbook] monthly_report load failed:", error);
    return null;
  }
  return (data as MonthRow) ?? null;
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
      console.error("[monthly-workbook] neighborhood report failed", slug, e);
      rows.push({ slug, report: null });
    }
  }
  return rows;
}

function readMeSheet(month: MonthRow | null, generatedAt: string): Cell[][] {
  return [
    ["Domi Data monthly tracker"],
    [],
    ["Generated (UTC)", generatedAt],
    ["Month", month?.month_start ?? "no monthly_report row"],
    ["Provisional", month?.is_provisional ? "yes" : "no"],
    [],
    ["Worksheet", "What it holds"],
    [
      "Manhattan Monthly",
      "Headline luxury and market-wide figures for the month, with MoM, YoY and the gap to the trailing 3 and 12 month averages.",
    ],
    ["Tiers Monthly", "Luxury, Prime and Trophy cutoffs, counts, volume, price per square foot and days on market with MoM and YoY."],
    ["Monthly History", "One row per month in the trailing series, with MoM and deltas against the trailing 3 and 12 month averages."],
    ["Monthly Leaderboard", "Neighborhood ranking with month contracts, month volume and trailing 52 week figures."],
    ["Neighborhood Monthly", "One row per covered neighborhood: contracts, volume, luxury line, supply, days on market, with deltas against its own 3 and 12 month averages."],
    ["Neighborhood History", "One row per neighborhood per month for the trailing twelve months, with the rolling 3 month average and the gap to it."],
    ["Neighborhood Bedroom Mix", "Dollar and deal share by canonical bedroom segment for each neighborhood."],
    ["So What Audit", "Every generated sentence with its logic branch, inputs and contradiction flags."],
    ["Bedroom Label Map", "Alias to canonical bedroom label, with sort order."],
    [],
    ["Percentages are formatted as percentages. Blank means the source had no value."],
    ["Data powered by Marketproof."],
  ];
}

function manhattanSheet(month: MonthRow | null): Cell[][] {
  const rows: Cell[][] = [
    ["Metric", "Value", "MoM", "YoY", "vs trailing 3mo", "3mo avg", "12mo avg", "vs 12mo avg"],
  ];
  if (!month) return [...rows, ["No monthly_report row found", ...new Array(7).fill(null)] as Cell[]];
  const p = month.payload ?? {};
  const g = p.glance ?? {};
  const mp = p.market_pulse?.all ?? {};
  const momentum: any[] = Array.isArray(p.momentum) ? p.momentum : [];
  const mom = (label: string) => momentum.find((m) => m?.label === label) ?? {};
  const lc = mom("Luxury Contracts");
  const lv = mom("Luxury Volume");

  rows.push([
    "Luxury contracts",
    n(g.luxury_count),
    pct(g.luxury_count_mom_pct),
    pct(g.luxury_count_yoy_pct),
    pct(g.luxury_count_vs_trailing3_pct) ?? delta(g.luxury_count, lc.avg3),
    n(lc.avg3),
    n(lc.avg12),
    delta(g.luxury_count, lc.avg12),
  ]);
  rows.push([
    "Luxury dollar volume ($)",
    n(g.luxury_volume),
    pct(g.luxury_volume_mom_pct),
    pct(g.luxury_volume_yoy_pct),
    pct(g.luxury_volume_vs_trailing3_pct) ?? delta(g.luxury_volume, lv.avg3),
    n(lv.avg3),
    n(lv.avg12),
    delta(g.luxury_volume, lv.avg12),
  ]);
  rows.push(["Median price ($)", n(g.median_price), null, null, null, null, null, null]);
  rows.push(["Median price / sq ft ($)", n(g.median_ppsf), null, null, null, null, null, null]);
  rows.push(["Average days on market", n(g.avg_dom), null, null, null, null, null, null]);
  rows.push(["Prime contracts cleared", n(g.cleared_prime_count), null, null, null, null, null, null]);
  rows.push(["Trophy contracts cleared", n(g.cleared_trophy_count), null, null, null, null, null, null]);
  rows.push([]);
  rows.push([
    "All contracts",
    n(mp.contracts),
    pct(mp.contracts_mom_pct),
    pct(mp.contracts_yoy_pct),
    null,
    null,
    n(mp.contracts_avg12),
    delta(mp.contracts, mp.contracts_avg12),
  ]);
  rows.push([
    "All dollar volume ($)",
    n(mp.volume),
    pct(mp.volume_mom_pct),
    pct(mp.volume_yoy_pct),
    null,
    null,
    n(mp.volume_avg12),
    delta(mp.volume, mp.volume_avg12),
  ]);

  const byType = p.market_pulse?.by_type ?? {};
  const names: Record<string, string> = { condo: "Condo", coop: "Co-op", townhouse: "Townhouse" };
  for (const key of ["condo", "coop", "townhouse"] as const) {
    const t = byType[key];
    if (!t) continue;
    rows.push([
      `${names[key]} contracts`,
      n(t.contracts),
      pct(t.contracts_mom_pct),
      pct(t.contracts_yoy_pct),
      null,
      null,
      n(t.contracts_avg12),
      delta(t.contracts, t.contracts_avg12),
    ]);
  }
  return rows;
}

function tiersSheet(month: MonthRow | null): Cell[][] {
  const rows: Cell[][] = [
    [
      "Tier",
      "Cutoff ($)",
      "Cutoff MoM",
      "Cutoff YoY",
      "Contracts",
      "Contracts MoM",
      "Contracts YoY",
      "Volume ($)",
      "Volume MoM",
      "Volume YoY",
      "Median price ($)",
      "Median YoY",
      "Avg $/sq ft",
      "$/sq ft MoM",
      "$/sq ft YoY",
      "Days on market",
      "Days YoY",
      "52wk volume ($)",
      "52wk cleared",
    ],
  ];
  const tiers = month?.payload?.tiers ?? {};
  for (const key of ["luxury", "prime", "trophy"] as const) {
    const t = tiers[key];
    if (!t) continue;
    rows.push([
      key[0].toUpperCase() + key.slice(1),
      n(t.cutoff),
      pct(t.cutoff_mom_pct),
      pct(t.cutoff_yoy_pct),
      n(t.count),
      pct(t.count_mom_pct),
      pct(t.count_yoy_pct),
      n(t.volume),
      pct(t.volume_mom_pct),
      pct(t.volume_yoy_pct),
      n(t.median_price),
      pct(t.median_price_yoy_pct),
      n(t.ppsf_avg),
      pct(t.ppsf_avg_mom_pct),
      pct(t.ppsf_avg_yoy_pct),
      n(t.dom),
      pct(t.dom_yoy_pct),
      n(t.volume_52wk),
      n(t.cleared_52wk),
    ]);
  }
  if (rows.length === 1) rows.push(["No tier data", ...new Array(18).fill(null)] as Cell[]);
  return rows;
}

function historySheet(month: MonthRow | null): Cell[][] {
  const header: Cell[] = [
    "Month",
    "Luxury contracts",
    "Luxury contracts MoM",
    "Luxury contracts vs 3mo avg",
    "Luxury contracts vs 12mo avg",
    "Luxury volume ($)",
    "Luxury volume MoM",
    "Luxury volume vs 3mo avg",
    "Luxury volume vs 12mo avg",
    "Condo contracts",
    "Co-op contracts",
    "Townhouse contracts",
    "Published 3mo avg (contracts)",
  ];
  const s = month?.payload?.series;
  const labels: string[] = Array.isArray(s?.labels) ? s.labels : [];
  if (!labels.length) return [header, ["No monthly series", ...new Array(header.length - 1).fill(null)] as Cell[]];
  const count: (number | null)[] = labels.map((_, i) => n(s.luxury_count?.[i]) as number | null);
  const volume: (number | null)[] = labels.map((_, i) => n(s.luxury_volume?.[i]) as number | null);
  const rows: Cell[][] = [header];
  labels.forEach((label, i) => {
    rows.push([
      label,
      n(count[i]),
      delta(count[i], count[i - 1]),
      delta(count[i], trailingAvg(count, i, 3)),
      delta(count[i], trailingAvg(count, i, 12)),
      n(volume[i]),
      delta(volume[i], volume[i - 1]),
      delta(volume[i], trailingAvg(volume, i, 3)),
      delta(volume[i], trailingAvg(volume, i, 12)),
      n(s.by_type?.condo?.[i]),
      n(s.by_type?.coop?.[i]),
      n(s.by_type?.townhouse?.[i]),
      n(s.luxury_count_avg3?.[i]),
    ]);
  });
  return rows;
}

function leaderboardSheet(month: MonthRow | null): Cell[][] {
  const rows: Cell[][] = [
    [
      "Rank",
      "Neighborhood",
      "Month contracts",
      "Month volume ($)",
      "52wk volume ($)",
      "52wk contracts",
      "Local median ($)",
      "Avg sale ($)",
      "Luxury share",
      "Rank change",
    ],
  ];
  for (const r of month?.payload?.leaderboard ?? []) {
    rows.push([
      n(r.rank),
      typeof r.name === "string" ? r.name.replace(/\b\w/g, (c: string) => c.toUpperCase()) : "",
      n(r.month_contracts),
      n(r.month_volume),
      n(r.vol_52wk),
      n(r.contracts_52wk),
      n(r.local_median),
      n(r.avg_sale),
      pct(r.pct_lux),
      n(r.rank_delta),
    ]);
  }
  if (rows.length === 1) rows.push(["No leaderboard rows", ...new Array(9).fill(null)] as Cell[]);
  return rows;
}

function stripArrow(v: unknown): Cell {
  if (typeof v !== "string" || !v.trim()) return null;
  return v.replace(/[▲▼]/g, "").replace(/\s+/g, " ").trim();
}

function neighborhoodSheet(rows: Row[]): Cell[][] {
  const out: Cell[][] = [
    [
      "Neighborhood",
      "Slug",
      "Period",
      "Luxury contracts",
      "3mo avg",
      "vs 3mo avg",
      "12mo avg",
      "vs 12mo avg",
      "Luxury volume ($)",
      "Volume MoM",
      "Volume YoY",
      "Volume vs avg",
      "Signed contracts (all)",
      "Contracts MoM",
      "Contracts YoY",
      "Local luxury median ($)",
      "Manhattan rank (intensity)",
      "Luxury share",
      "Months of supply (luxury)",
      "Months of supply (all)",
      "Borough months of supply",
      "Active listings (luxury)",
      "Absorption (luxury)",
      "Days on market",
      "12mo avg days",
      "Days vs 12mo avg",
      "Total contracts (mix)",
      "Dollar leader",
      "Deal-count leader",
    ],
  ];
  for (const { slug, report } of rows) {
    if (!report) {
      out.push([slug, slug, "no payload row", ...new Array(26).fill(null)] as Cell[]);
      continue;
    }
    const p = report.payload as any;
    const volLead = leaderOf(p.bedroomMix?.volumeData);
    const countLead = leaderOf(p.bedroomMix?.countData);
    const count = p.hero?.luxuryContractsCount;
    out.push([
      p.geo ?? slug,
      slug,
      p.periodLabel ?? report.period ?? "",
      n(count),
      n(p.hero?.luxuryContracts3moAvg),
      delta(count, p.hero?.luxuryContracts3moAvg),
      n(p.hero?.luxuryContracts12moAvg),
      delta(count, p.hero?.luxuryContracts12moAvg),
      parseMoneyDisplay(p.hero?.luxuryVolumeDisplay),
      parsePctDisplay(stripArrow(p.pulse?.dollarVolumeMomDisplay)),
      parsePctDisplay(stripArrow(p.pulse?.dollarVolumeYoyDisplay)),
      parsePctDisplay(stripArrow(p.pulse?.dollarVolumeDeltaDisplay)),
      n(p.pulse?.signedContracts),
      parsePctDisplay(stripArrow(p.pulse?.signedContractsMomDisplay)),
      parsePctDisplay(stripArrow(p.pulse?.signedContractsYoyDisplay)),
      parseMoneyDisplay(p.rank?.localLineDisplay),
      n(p.rank?.manhattanRank),
      pct(p.rank?.luxurySharePct),
      n(p.supply?.luxury?.monthsOfSupply),
      n(p.supply?.all?.monthsOfSupply),
      n(p.supply?.boroughMonthsOfSupply),
      n(p.supply?.luxury?.activeListings),
      pct(p.supply?.luxury?.monthlyAbsorptionPct),
      n(p.dom?.currentDays),
      n(p.dom?.avg12moDays),
      delta(p.dom?.currentDays, p.dom?.avg12moDays),
      n(p.bedroomMix?.totalContracts),
      volLead ? canonicalBedLabel(volLead.label) : "",
      countLead ? canonicalBedLabel(countLead.label) : "",
    ]);
  }
  return out;
}

function neighborhoodHistorySheet(rows: Row[]): Cell[][] {
  const out: Cell[][] = [
    [
      "Neighborhood",
      "Slug",
      "Month",
      "Luxury contracts",
      "MoM",
      "Rolling 3mo avg",
      "vs rolling 3mo avg",
      "vs 12mo avg",
    ],
  ];
  for (const { slug, report } of rows) {
    if (!report) continue;
    const p = report.payload as any;
    const chart = p.demandChart ?? {};
    const labels: string[] = Array.isArray(chart.labels) ? chart.labels : [];
    const counts: (number | null)[] = labels.map((_, i) => n(chart.counts?.[i]) as number | null);
    const valid = counts.filter((v): v is number => typeof v === "number");
    const avg12 = valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
    labels.forEach((label, i) => {
      out.push([
        p.geo ?? slug,
        slug,
        label,
        n(counts[i]),
        delta(counts[i], counts[i - 1]),
        n(chart.rolling3?.[i]),
        delta(counts[i], chart.rolling3?.[i]),
        delta(counts[i], avg12),
      ]);
    });
  }
  if (out.length === 1) out.push(["No neighborhood history", ...new Array(7).fill(null)] as Cell[]);
  return out;
}

function bedroomMixSheet(rows: Row[]): Cell[][] {
  const out: Cell[][] = [
    [
      "Neighborhood",
      "Slug",
      "Period",
      "Bedroom segment",
      "Dollar share",
      "Dollar display",
      "Deal share",
      "Deal count display",
    ],
  ];
  for (const { slug, report } of rows) {
    if (!report) continue;
    const p = report.payload as any;
    const vol: any[] = Array.isArray(p.bedroomMix?.volumeData) ? p.bedroomMix.volumeData : [];
    const cnt: any[] = Array.isArray(p.bedroomMix?.countData) ? p.bedroomMix.countData : [];
    const labels = Array.from(
      new Set([...vol, ...cnt].map((e) => canonicalBedLabel(e?.label))),
    ).sort((a, b) => bedSortIndex(a) - bedSortIndex(b));
    for (const label of labels) {
      const v = vol.find((e) => canonicalBedLabel(e?.label) === label);
      const c = cnt.find((e) => canonicalBedLabel(e?.label) === label);
      out.push([
        p.geo ?? slug,
        slug,
        p.periodLabel ?? report.period ?? "",
        label,
        pct(v?.value),
        v?.fmt ?? "",
        pct(c?.value),
        c?.fmt ?? "",
      ]);
    }
  }
  if (out.length === 1) out.push(["No bedroom mix", ...new Array(7).fill(null)] as Cell[]);
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
    ],
  ];
  let contradictions = 0;
  for (const { slug, report } of rows) {
    if (!report) {
      out.push([slug, slug, "", "", "", "no payload row", "", "", "", ""]);
      continue;
    }
    const p = report.payload as any;
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

export interface MonthlyWorkbook {
  base64: string;
  filename: string;
  monthStart: string | null;
  periodLabel: string | null;
  isProvisional: boolean;
  neighborhoodsWithData: number;
  neighborhoodsTotal: number;
  contradictions: number;
  generatedAt: string;
}

export async function buildMonthlyWorkbook(): Promise<MonthlyWorkbook> {
  const generatedAt = new Date().toISOString();
  const [month, nbhd] = await Promise.all([loadMonthly(), loadNeighborhoods()]);
  const audit = auditSheet(nbhd);

  const wb = XLSX.utils.book_new();
  sheet(wb, "Read Me", readMeSheet(month, generatedAt), [30, 90]);
  {
    // Vertical sheet: units come from each metric's own label, not the column.
    const aoa = manhattanSheet(month);
    sheet(
      wb,
      "Manhattan Monthly",
      aoa,
      [28, 18, 12, 12, 16, 16, 16, 14],
      autoFormats(aoa[0]),
      { labelCol: 0, valueCols: [1, 5, 6] },
    );
  }
  {
    const aoa = tiersSheet(month);
    sheet(
      wb,
      "Tiers Monthly",
      aoa,
      [12, 16, 12, 12, 12, 14, 14, 18, 12, 12, 16, 12, 12, 12, 12, 14, 12, 18, 14],
      autoFormats(aoa[0], { 12: FMT.money, 17: FMT.money }),
    );
  }
  {
    const aoa = historySheet(month);
    sheet(wb, "Monthly History", aoa, [12, 16, 16, 18, 18, 18, 16, 18, 18, 14, 14, 16, 20], autoFormats(aoa[0]));
  }
  {
    const aoa = leaderboardSheet(month);
    sheet(wb, "Monthly Leaderboard", aoa, [8, 26, 16, 18, 18, 14, 18, 16, 12, 12], autoFormats(aoa[0]));
  }
  {
    const aoa = neighborhoodSheet(nbhd);
    sheet(
      wb,
      "Neighborhood Monthly",
      aoa,
      [
        20, 18, 14, 14, 12, 14, 12, 14, 16, 14, 14, 14, 18, 14, 14, 18, 20, 12, 20, 18, 20, 18, 16,
        14, 14, 16, 16, 16, 16,
      ],
      autoFormats(aoa[0]),
    );
  }
  {
    const aoa = neighborhoodHistorySheet(nbhd);
    sheet(wb, "Neighborhood History", aoa, [20, 18, 14, 16, 12, 16, 18, 16], autoFormats(aoa[0]));
  }
  {
    const aoa = bedroomMixSheet(nbhd);
    sheet(wb, "Neighborhood Bedroom Mix", aoa, [20, 18, 14, 16, 14, 16, 14, 16], autoFormats(aoa[0]));
  }
  sheet(wb, "So What Audit", audit.aoa, [20, 18, 16, 16, 30, 80, 30, 26, 40, 60]);
  sheet(wb, "Bedroom Label Map", labelMapSheet(), [26, 18, 12]);

  const base64 = XLSX.write(wb, { bookType: "xlsx", type: "base64", cellStyles: true }) as string;
  const stamp = (month?.month_start ?? generatedAt.slice(0, 10)).slice(0, 7);
  const first = nbhd.find((r) => r.report)?.report?.payload as any;

  return {
    base64,
    filename: `domi-data-monthly-tracker-${stamp}.xlsx`,
    monthStart: month?.month_start ?? null,
    periodLabel: first?.periodLabel ?? null,
    isProvisional: !!month?.is_provisional,
    neighborhoodsWithData: nbhd.filter((r) => r.report).length,
    neighborhoodsTotal: nbhd.length,
    contradictions: audit.contradictions,
    generatedAt,
  };
}
