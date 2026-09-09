import type { NeighborhoodReport } from "./neighborhood-report.functions";
import {
  momentumDirDampened,
  collapseDir,
  collapsePulseClass,
  SMALL_SAMPLE_FLOOR,
} from "./sowhat";
import { canonicalBedLabel, sameBedSegment, bedLabelAliasMap, bedSortIndex } from "./bedroom-labels";

export const NEIGHBORHOOD_SLUGS = [
  "tribeca",
  "upper-east-side",
  "west-village",
  "upper-west-side",
  "lenox-hill",
  "midtown",
  "lincoln-square",
  "greenwich-village",
  "west-chelsea",
  "soho",
];

export type Row = { slug: string; report: NeighborhoodReport | null };

export function parseCurrencyStr(s: string | number | undefined | null): number {
  if (typeof s === "number") return s;
  if (!s) return 0;
  const str = String(s).trim().replace(/[$,\s]/g, "");
  const m = str.match(/^(-?[\d.]+)([KMB]?)$/i);
  if (!m) return Number(str) || 0;
  const n = parseFloat(m[1]);
  const u = m[2].toUpperCase();
  return n * (u === "B" ? 1e9 : u === "M" ? 1e6 : u === "K" ? 1e3 : 1);
}

export function leaderOf(data: { label: string; value: number }[] | undefined) {
  if (!data || data.length === 0) return null;
  return data.reduce((best, cur) => (cur.value > best.value ? cur : best));
}

export type Block = {
  key: string;
  label: string;
  sentence: string | null;
  inputs: [string, string][];
  branch: string;
  flag?: string;
  audit?: string[];
};

type Ctx = {
  p: NeighborhoodReport["payload"];
  heroDir: string;
  volDir: string;
  volLead: { label: string; value: number } | null;
  countLead: { label: string; value: number } | null;
  mixSplit: boolean;
  thinMix: boolean;
};

// Contradiction checks: compare the rendered wording against the numbers that
// produced it. Anything returned here is a sentence that says something the
// inputs do not support.
function detectContradictions(b: Block, ctx: Ctx): string[] {
  const s = (b.sentence ?? "").toLowerCase();
  if (!s) return [];
  const out: string[] = [];
  const { p, volLead, countLead, mixSplit } = ctx;
  const has = (...words: string[]) => words.some((w) => s.includes(w));

  if (b.key === "unitMix" && volLead && countLead && !ctx.thinMix) {
    // Compare on canonical labels so upstream wording ("3BR" vs "3-Bed")
    // never decides whether a claim matches the data.
    const dollarLabel = canonicalBedLabel(volLead.label).toLowerCase();
    const countLabel = canonicalBedLabel(countLead.label).toLowerCase();
    // "less competition" advice aimed at the size that actually has the most deals
    if (has("less competition", "thinner field", "fewer competing")) {
      if (mixSplit) {
        out.push(
          `Advises less competition while ${canonicalBedLabel(countLead.label)} leads on deal count (${countLead.value}).`,
        );
      }
    }
    // Sentence shape: "<segment> residences accounted for N% of <geo>'s luxury
    // dollars ..." then "<segment> residences were the most frequent trade ...".
    // Strip any leading connector so the claim compares label to label.
    const claimed = (raw: string) =>
      raw.replace(/^(?:\s*(?:while|and|but|whereas|though|as|the)\s+)+/, "").trim();
    const dealsClaim = s.match(
      /([a-z0-9+\- ]{1,20}?) residences (?:were the most frequent trade|accounted for the most deals)/,
    );
    const dealsName = dealsClaim ? claimed(dealsClaim[1]) : null;
    if (dealsName && !sameBedSegment(dealsName, countLabel)) {
      out.push(
        `Names "${dealsName}" as the deal-count leader; data says ${canonicalBedLabel(countLead.label)}.`,
      );
    }
    const dollarClaim = s.match(
      /([a-z0-9+\- ]{1,20}?) residences (?:accounted for \d+% of|carried the most luxury dollars|drove most of)/,
    );
    const dollarName = dollarClaim ? claimed(dollarClaim[1]) : null;
    if (dollarName && !sameBedSegment(dollarName, dollarLabel)) {
      out.push(
        `Names "${dollarName}" as the dollar leader; data says ${canonicalBedLabel(volLead.label)}.`,
      );
    }
    if (mixSplit && !s.includes(countLabel)) {
      out.push(
        `Dollar and deal-count leaders differ but ${canonicalBedLabel(countLead.label)} is never mentioned.`,
      );
    }


  }

  if (b.key === "rank") {
    // The sentence leads with the luxury DOLLAR VOLUME rank when the registry
    // supplies one, then quotes the luxury INTENSITY rank. Both are positions
    // among qualifying neighborhoods only. Audit each against its own field.
    const volRank = p.rank?.volumeRank ?? null;
    const intensityRank = p.rank?.manhattanRank ?? null;
    const ordinals = [...s.matchAll(/ranks (\d+)(?:st|nd|rd|th)/g)].map((m) => Number(m[1]));
    const expected = [volRank, intensityRank].filter((n): n is number => n != null);
    ordinals.forEach((n, i) => {
      const want = expected[i];
      if (want != null && n !== want) {
        out.push(
          `Sentence quotes rank ${n} in position ${i + 1}; payload ${i === 0 && volRank != null ? "volume rank" : "intensity rank"} is ${want}.`,
        );
      }
    });
    const total = p.rank?.volumeRankTotal ?? null;
    if (total != null) {
      for (const n of [volRank, intensityRank]) {
        if (n != null && n > total) {
          out.push(`Quotes rank ${n} against a qualifying set of ${total}.`);
        }
      }
    }
    const localPct = p.rank?.luxurySharePct;
    const nextPct = p.rank?.nextPct;
    // Wording follows the shares: "behind" only holds when the cited neighbor
    // sits above the local share, "ahead of" only when it sits below.
    if (typeof localPct === "number" && typeof nextPct === "number") {
      if (has("just behind", "behind ") && nextPct < localPct) {
        out.push(
          `Claims "behind" but neighbor share ${nextPct}% is below local ${localPct}%.`,
        );
      }
      if (has("ahead of") && nextPct > localPct) {
        out.push(`Claims "ahead of" but neighbor share ${nextPct}% exceeds local ${localPct}%.`);
      }
    }
  }


  if (b.key === "heroContracts") {
    // Only the month-pace clause reflects heroDir. The trailing "underlying
    // 12-month pace" clause is a separate year-over-year signal and is allowed
    // to point the other way, so it is excluded before checking direction.
    const monthClause = s.split("the underlying 12-month pace")[0];
    const hasIn = (...words: string[]) => words.some((w) => monthClause.includes(w));
    const up = hasIn("above", "strong month", "solid month");
    const down = hasIn("below", "easing", "soft month", "cooled");
    if (up && !down && ctx.heroDir.includes("down")) out.push("Reads as rising; momentum direction is down.");
    if (down && !up && ctx.heroDir.includes("up")) out.push("Reads as falling; momentum direction is up.");
  }


  if (b.key === "heroVolume") {
    if (has("above") && ctx.volDir.includes("down")) {
      out.push("Reads as above pace; volume direction is down.");
    }
    if (has("below") && ctx.volDir.includes("up")) {
      out.push("Reads as below pace; volume direction is up.");
    }
  }

  if (b.key === "crossMetric") {
    const n = s.match(/only (\d+) deals/);
    const actual = p.hero?.luxuryContractsCount;
    if (n && actual != null && Number(n[1]) !== actual) {
      out.push(`Cites ${n[1]} deals; payload count is ${actual}.`);
    }
  }

  if (b.key === "supply") {
    const local = p.supply?.luxury?.monthsOfSupply;
    const borough = p.supply?.boroughMonthsOfSupply;
    if (typeof local === "number" && typeof borough === "number") {
      if (has("tighter") && local > borough) {
        out.push(`Says tighter, but local supply ${local} exceeds borough ${borough}.`);
      }
      if (has("looser") && local < borough) {
        out.push(`Says looser, but local supply ${local} is under borough ${borough}.`);
      }
    }
  }

  if (b.key === "dom") {
    const cur = p.dom?.currentDays;
    const avg = p.dom?.avg12moDays;
    if (typeof cur === "number" && typeof avg === "number") {
      if (has("faster") && cur > avg) out.push(`Says faster, but ${cur} days exceeds the ${avg}-day average.`);
      if (has("slower", "longer to sign") && cur < avg) {
        out.push(`Says slower, but ${cur} days is under the ${avg}-day average.`);
      }
    }
  }

  return out;
}

export function buildBlocks(r: NeighborhoodReport): Block[] {
  const p = r.payload;
  const c = r.computed;

  const heroM = momentumDirDampened(
    p.hero.luxuryContractsCount,
    p.hero.luxuryContracts12moAvg,
  );
  const volM = momentumDirDampened(
    parseCurrencyStr(p.hero.luxuryVolumeDisplay),
    parseCurrencyStr(p.hero.luxuryVolume12moAvgDisplay),
  );
  const crossLux = collapseDir(heroM.dir);
  const crossOverall = collapsePulseClass(p.pulse?.dollarVolumeMomClass);

  const volLead = leaderOf(p.bedroomMix?.volumeData);
  const countLead = leaderOf(p.bedroomMix?.countData);
  const mixSplit = !!volLead && !!countLead && !sameBedSegment(volLead.label, countLead.label);
  const thinMix = (p.bedroomMix?.totalContracts ?? 0) < SMALL_SAMPLE_FLOOR;

  const ctx: Ctx = {
    p,
    heroDir: heroM.dir,
    volDir: volM.dir,
    volLead,
    countLead,
    mixSplit,
    thinMix,
  };

  const blocks: Block[] = [

    {
      key: "heroContracts",
      label: "Hero · contracts",
      sentence: c.heroContractsNote,
      branch: `dir=${heroM.dir}${heroM.capped ? " (dampened)" : ""}`,
      inputs: [
        ["current", String(p.hero.luxuryContractsCount)],
        ["3mo avg", String(p.hero.luxuryContracts3moAvg)],
        ["12mo avg", String(p.hero.luxuryContracts12moAvg)],
        ["12mo avg yr ago", String(p.hero.luxuryContracts12moAvgYearAgo)],
      ],
      flag:
        p.hero.luxuryContractsCount < SMALL_SAMPLE_FLOOR
          ? `below small-sample floor (${SMALL_SAMPLE_FLOOR})`
          : undefined,
    },
    {
      key: "heroVolume",
      label: "Hero · volume (not rendered, folded into cross-metric)",
      sentence: c.heroVolumeNote,
      branch: `dir=${volM.dir}${volM.capped ? " (dampened)" : ""}`,
      inputs: [
        ["current", p.hero.luxuryVolumeDisplay],
        ["12mo avg", p.hero.luxuryVolume12moAvgDisplay],
        ["trophy count", String(p.weekStats?.clearedTrophy ?? "")],
      ],
    },
    {
      key: "crossMetric",
      label: "Hero · cross-metric (rendered)",
      sentence: c.smallSampleNote ?? c.crossMetricSowhat,
      branch: c.smallSampleNote
        ? "small-sample override"
        : `luxury=${crossLux} / overall=${crossOverall}`,
      inputs: [
        ["luxury contracts", String(p.hero.luxuryContractsCount)],
        ["luxury 12mo avg", String(p.hero.luxuryContracts12moAvg)],
        ["overall vol MoM class", String(p.pulse?.dollarVolumeMomClass ?? "none")],
      ],
    },
    {
      key: "rank",
      label: "Rank / luxury intensity",
      sentence: c.rankSowhat,
      branch: `volRank=${p.rank?.volumeRank ?? "n/a"} · intensityRank=${p.rank?.manhattanRank} vs ${p.rank?.nextNeighborhood ?? "n/a"}`,
      inputs: [
        ["volume rank", String(p.rank?.volumeRank ?? "n/a")],
        ["manhattan rank", String(p.rank?.manhattanRank ?? "")],
        ["luxury share %", String(p.rank?.luxurySharePct ?? "")],
        ["share counts", String(p.rank?.luxuryShareCountsDisplay ?? "")],
        ["local luxury median", String(p.rank?.localLineDisplay ?? "")],
        ["next nbhd", `${p.rank?.nextNeighborhood ?? "n/a"} @ ${p.rank?.nextPct ?? "n/a"}%`],
      ],
    },
    {
      key: "supply",
      label: "Supply leverage",
      sentence: c.supplySowhat,
      branch: `local=${p.supply?.luxury?.monthsOfSupply} vs borough=${p.supply?.boroughMonthsOfSupply}`,
      inputs: [
        ["luxury months of supply", String(p.supply?.luxury?.monthsOfSupply ?? "")],
        ["borough months of supply", String(p.supply?.boroughMonthsOfSupply ?? "")],
      ],
    },
    {
      key: "dom",
      label: "Days on market",
      sentence: c.domSowhat,
      branch: `current=${p.dom?.currentDays} vs 12mo=${p.dom?.avg12moDays}`,
      inputs: [
        ["current days", String(p.dom?.currentDays ?? "")],
        ["12mo avg days", String(p.dom?.avg12moDays ?? "")],
      ],
    },
    {
      key: "unitMix",
      label: "Unit mix",
      sentence: c.unitMixSowhat,
      branch: thinMix
        ? "thin sample override"
        : mixSplit
          ? "split leaders (dollars vs deals)"
          : "single leader",
      inputs: [
        ["total contracts", String(p.bedroomMix?.totalContracts ?? "")],
        [
          "dollar leader",
          volLead ? `${canonicalBedLabel(volLead.label)} (${volLead.value})` : "n/a",
        ],
        [
          "count leader",
          countLead ? `${canonicalBedLabel(countLead.label)} (${countLead.value})` : "n/a",
        ],
        ["dollar leader (raw)", volLead ? volLead.label : "n/a"],
        ["count leader (raw)", countLead ? countLead.label : "n/a"],
      ],
      flag: mixSplit ? "dollar leader differs from deal-count leader" : undefined,
    },
  ];

  return blocks.map((b) => {
    const audit = detectContradictions(b, ctx);
    return audit.length ? { ...b, audit } : b;
  });

}

function csvCell(v: string): string {
  const s = (v ?? "").replace(/\r?\n/g, " ").trim();
  return /[",;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildCsv(rows: Row[]): string {
  const header = [
    "neighborhood",
    "slug",
    "period",
    "block_key",
    "block_label",
    "sentence",
    "branch",
    "flag",
    "contradictions",
    "inputs",
    // Canonical bedroom labels so external tools never parse raw upstream wording.
    "bed_dollar_leader",
    "bed_count_leader",
    "bed_dollar_leader_raw",
    "bed_count_leader_raw",
  ];
  const blanks = new Array(header.length - 6).fill("");
  const lines: string[] = [header.join(",")];
  for (const { slug, report } of rows) {
    if (!report) {
      lines.push([slug, slug, "", "", "", "no payload row", ...blanks].map(csvCell).join(","));
      continue;
    }
    const geo = report.payload?.geo ?? slug;
    const period = report.payload?.periodLabel ?? report.period ?? "";
    const volLead = leaderOf(report.payload?.bedroomMix?.volumeData);
    const countLead = leaderOf(report.payload?.bedroomMix?.countData);
    for (const b of buildBlocks(report)) {
      lines.push(
        [
          geo,
          slug,
          period,
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
        ]

          .map(csvCell)
          .join(","),
      );
    }
  }
  return lines.join("\n");
}

/** The alias table itself, so downstream tools can adopt the same vocabulary. */
export function buildBedLabelMapCsv(): string {
  const lines = ["normalized_alias,canonical_label,sort_index"];
  for (const { alias, canonical } of bedLabelAliasMap()) {
    lines.push([alias, canonical, String(bedSortIndex(canonical))].map(csvCell).join(","));
  }
  return lines.join("\n");
}
