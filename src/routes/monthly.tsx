import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import { QR_DESIGN_CSS, QR_MONOGRAM_SVG, buildQrDesignScript } from "../lib/qr-design";
import { breadcrumbScript, TRAILS } from "../lib/breadcrumbs";
import { MONTH_HERO } from "../lib/site-images";
import { useAdminRole } from "../hooks/use-admin-role";
import { srTable, srSummary, zipSeries, describeSeries, describeParts } from "../lib/sr-table";
import { SMALL_SAMPLE_FLOOR, smallSampleString, PROVISIONAL_STRING } from "../lib/sowhat";
import {
  getLatestMonthlyReport,
  type MonthlyReportRow,
  type MonthlyMomentumRow,
  type MonthlyTier,
  type MonthlyTierSeriesPoint,
  type MonthlyMarketPulseByTypeRow,
  type MonthlyMarketPulseSeriesPoint,
} from "../lib/monthly-report.functions";

/* ─────────── formatting ─────────── */

const DASH = "—";

function fmtInt(n: number | null | undefined): string {
  return n === null || n === undefined || !Number.isFinite(n) ? DASH : Math.round(n).toLocaleString();
}
function fmtMoney(n: number | null | undefined): string {
  return n === null || n === undefined || !Number.isFinite(n) ? DASH : `$${Math.round(n).toLocaleString()}`;
}
function fmtMoneyM(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return DASH;
  if (Math.abs(n) >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  return `$${(n / 1_000_000).toFixed(1)}M`;
}
function fmtPpsf(n: number | null | undefined): string {
  return n === null || n === undefined || !Number.isFinite(n) ? DASH : `$${Math.round(n).toLocaleString()}`;
}
function fmtPct(n: number | null | undefined, digits = 1): string {
  return n === null || n === undefined || !Number.isFinite(n) ? DASH : `${n.toFixed(digits)}%`;
}
function fmtDays(n: number | null | undefined): string {
  return n === null || n === undefined || !Number.isFinite(n) ? DASH : `${Math.round(n)} days`;
}
function fmtSigned(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return DASH;
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}
function deltaClass(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "fl";
  if (n > 0.5) return "up";
  if (n < -0.5) return "dn";
  return "fl";
}
function rankDeltaLabel(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return DASH;
  if (n > 0) return `▲ ${n}`;
  if (n < 0) return `▼ ${Math.abs(n)}`;
  return "◆";
}
function unitFmt(unit: MonthlyMomentumRow["unit"]): (n: number) => string {
  if (unit === "money") return (n) => fmtMoneyM(n);
  if (unit === "ppsf") return (n) => fmtPpsf(n);
  if (unit === "days") return (n) => fmtDays(n);
  if (unit === "pct") return (n) => fmtPct(n);
  return (n) => fmtInt(n);
}
function fmtMonthLong(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}
function fmtDateLong(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/* ── formatters ported verbatim from this-week.tsx (byte-identical output), used only
     by the 5 sections ported into this file: hero tier boxes, the dual headline metrics
     + stat row, Top Deals of the Month, The Luxury Lines, and the Market Pulse badge. ── */
const twIsNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
function twFmtMoneyM(n: number | null | undefined, dec = 2): string {
  if (!twIsNum(n)) return DASH;
  return `$${(n / 1_000_000).toFixed(dec)}M`;
}
function twFmtMoneyShort(n: number | null | undefined): string {
  if (!twIsNum(n)) return DASH;
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${Math.round(n / 1_000_000)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${Math.round(n)}`;
}
function twFmtCurrencyInt(n: number | null | undefined): string {
  return twIsNum(n) ? `$${Math.round(n).toLocaleString()}` : DASH;
}
function twSfxPill(pct: number | null | undefined, suffix: string): React.JSX.Element | null {
  if (!twIsNum(pct)) return null;
  if (pct > 0) return <span className="ldr-badge ldr-badge-up">▲ {pct.toFixed(0)}% {suffix}</span>;
  if (pct < 0) return <span className="ldr-badge ldr-badge-dn">▼ {Math.abs(pct).toFixed(0)}% {suffix}</span>;
  return <span className="ldr-badge ldr-badge-zero">flat {suffix}</span>;
}

/** Tier -> canonical percentile class + text hex, matching the real .hero-tier / .hero-floor /
 *  .hero-num rules in src/reports/quarterly-brief.html (the Quarterly Report), used only by
 *  the rebuilt hero-grid below. */
const HERO_TIER_PCLASS: Record<"luxury" | "prime" | "trophy", "p90" | "p95" | "p99"> = {
  luxury: "p90",
  prime: "p95",
  trophy: "p99",
};
const HERO_TIER_HEX: Record<"luxury" | "prime" | "trophy", string> = {
  luxury: "#565C62",
  prime: "#797467",
  trophy: "#9A6863",
};

const DONUT_COLORS = ['#969FA8', '#AA8B84', '#8A8179', '#9A9280', '#C0BAB0'];

function donutBedIndex(label: string): number {
  const l = String(label || "").toLowerCase();
  if (l.startsWith("studio")) return 0;
  if (l.startsWith("4")) return 4;
  if (l.startsWith("3")) return 3;
  if (l.startsWith("2")) return 2;
  if (l.startsWith("1")) return 1;
  return 5;
}

type DonutSlice = { label: string; value: number; fmt: string };

function drawDonut(canvas: HTMLCanvasElement | null, data: DonutSlice[], centerLabel: string) {
  if (!canvas || !data || data.length === 0) return;
  data = data.slice().sort((a, b) => donutBedIndex(a.label) - donutBedIndex(b.label));
  const dpr = window.devicePixelRatio || 1;
  const size = 360;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = "100%";
  canvas.style.height = "auto";
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  const cx = size / 2, cy = size / 2;
  const outerR = 96, innerR = outerR * 0.58;
  const total = data.reduce((s, d) => s + d.value, 0);
  let angle = -Math.PI / 2;
  const gap = 0.014;
  const slices: Array<{ mid: number; color: string; label: string; fmt: string }> = [];
  data.forEach((slice) => {
    const color = DONUT_COLORS[donutBedIndex(slice.label) % DONUT_COLORS.length];
    const sweep = (slice.value / total) * (Math.PI * 2) - gap;
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, angle + gap / 2, angle + sweep, false);
    ctx.arc(cx, cy, innerR, angle + sweep, angle + gap / 2, true);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    const mid = angle + gap / 2 + (sweep - gap / 2) / 2;
    slices.push({ mid, color, label: slice.label, fmt: slice.fmt });
    angle += sweep + gap;
  });

  ctx.fillStyle = "#1B1714";
  ctx.font = "bold 18px Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(centerLabel, cx, cy);
  const labelR = outerR + 22;
  slices.forEach((sl) => {
    const lx = cx + Math.cos(sl.mid) * labelR;
    const ly = cy + Math.sin(sl.mid) * labelR;
    const cosA = Math.cos(sl.mid);
    const align: CanvasTextAlign = cosA > 0.15 ? "left" : cosA < -0.15 ? "right" : "center";
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#6B6560";
    ctx.font = "11px system-ui";
    ctx.fillText(sl.label, lx, ly - 7);
    ctx.fillStyle = sl.color;
    ctx.font = "bold 12px Georgia, serif";
    ctx.fillText(sl.fmt, lx, ly + 8);
  });
}

/* ─────────── tokens and component styles ─────────── */

const MONTHLY_CSS = `
.monthly-scope {
  --ivory:       #FBF9F5;
  --paper:       #FFFFFF;
  --paper-2:     #FBF9F5;
  --taupe:       #E4DDD3;
  --ink:         #1C1A18;
  --ink-mid:     #4A4744;
  --ash:         #50677A;
  --olive:       #75694E;
  --rust:        #9E5040;
  --p90:         #98A0A8; /* Luxury  (locked canonical) */
  --p95:         #918C7E; /* Prime   (locked canonical) */
  --p99:         #A37670; /* Trophy  (locked canonical) */
  --p90-text:    #6C7881;
  --p95-text:    #7A7363;
  --p99-text:    #A45A58;
  --up-strong:   #2E6645;
  --down-strong: #9C2F26;

  /* ── Legacy aliases so classes ported verbatim from this-week.tsx keep resolving ── */
  --rule:        var(--taupe);
  --rule-mid:    var(--taupe);
  --ground:      var(--paper);
  --ground-mid:  var(--paper-2);
  --ground-hi:   var(--paper-2);
  --text:        var(--ink);
  --text-mid:    var(--ink-mid);
  --text-dim:    var(--ash);
  --accent:      var(--p90);
  --gold:        var(--olive);
  --gold-bg:     rgba(117,105,78,0.08);
  --rust-bg:     rgba(158,80,64,0.10);
  --sage:        var(--up-strong);
  --sage-bg:     rgba(46,102,69,0.10);

  --serif:       'Ivy Mode','Cormorant Garamond','Times New Roman',Georgia,serif;
  --sans:        'Jost','Helvetica Neue',Helvetica,Arial,sans-serif;

  background: var(--paper);
  color: var(--ink-mid);
  font-family: var(--sans);
  font-size: 17.5px;
  line-height: 1.68;
  -webkit-font-smoothing: antialiased;
  font-variant-numeric: tabular-nums;
}
.monthly-scope *, .monthly-scope *::before, .monthly-scope *::after { box-sizing: border-box; }

/* masthead */
.m-masthead { padding: 56px 56px 36px; border-bottom: 1px solid var(--taupe); background: var(--paper-2); }
.m-eyebrow { font-family: var(--sans); font-size: 11px; letter-spacing: .22em; text-transform: uppercase; color: var(--olive); margin-bottom: 18px; }
.m-title { font-family: var(--serif); font-weight: 300; font-size: clamp(38px, 5vw, 62px); line-height: 1.08; color: var(--ink); margin-bottom: 14px; }
.m-byline { font-size: 14px; color: var(--ink-mid); letter-spacing: .02em; }
.m-orient { margin-top: 14px; font-size: 14px; color: var(--ink-mid); max-width: 62ch; }
.m-flag { display: inline-block; margin-top: 16px; padding: 7px 12px; background: rgba(158,80,64,.10); color: var(--rust); font-size: 12.5px; letter-spacing: .02em; }

/* ─── MASTHEAD (ported verbatim from this-week.tsx) ─────────────── */
.tw-masthead { padding: 64px 64px 44px; display: flex; flex-direction: column; align-items: flex-start; gap: 0; background: var(--paper); }
.tw-masthead__brand { font-family: var(--serif); font-size: 17px; letter-spacing: .22em; text-transform: uppercase; color: var(--rust); margin-bottom: 6px; font-weight: 400; }
.tw-masthead__edition { display: inline-flex; align-items: center; font-family: var(--sans); font-size: 11px; letter-spacing: .16em; text-transform: uppercase; color: var(--olive); font-weight: 700; padding: 5px 14px; border-radius: 999px; background: rgba(117,105,78,0.10); border: 1px solid rgba(117,105,78,0.35); margin-bottom: 18px; }
.tw-masthead__title { font-family: var(--serif); font-size: clamp(36px,5.2vw,58px); font-weight: 400; line-height: 1.12; color: var(--ink); text-wrap: balance; }
.tw-masthead__meta { margin-top: 32px; font-size: 17.5px; color: var(--olive); line-height: 1.68; font-family: var(--sans); font-weight: 400; }
.tw-masthead__meta strong { color: var(--ink-mid); display: block; font-weight: 600; letter-spacing: .04em; margin-bottom: 4px; font-size: 18px; }
@media (max-width: 640px) {
  .tw-masthead { padding: 36px 24px 28px; }
  .tw-masthead__title { line-height: 1.1; }
  .tw-masthead__meta { line-height: 1.7; }
  .tw-masthead--photo { min-height: 300px; padding: 80px 24px 26px; }
  .tw-masthead--photo .tw-masthead__bg { object-position: 50% 28%; }
}

/* Photo masthead (Manhattan-wide reports). Same treatment as neighborhood pages. */
.tw-masthead--photo { position: relative; isolation: isolate; overflow: hidden; min-height: 420px; justify-content: flex-end; padding: 120px 64px 44px; }
.tw-masthead--photo .tw-masthead__bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 50% 28%; z-index: -2; }
.tw-masthead--photo::after { content: ""; position: absolute; inset: 0; z-index: -1; background: linear-gradient(180deg, rgba(20,15,12,0.30) 0%, rgba(20,15,12,0.52) 45%, rgba(20,15,12,0.80) 100%); }
.tw-masthead--photo .tw-masthead__brand { color: #F2E4DF; text-shadow: 0 1px 6px rgba(0,0,0,0.55); }
.tw-masthead--photo .tw-masthead__edition { color: #F2E4DF; background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.45); }
.tw-masthead--photo .tw-masthead__title { color: #FFFFFF; text-shadow: 0 2px 14px rgba(0,0,0,0.6); }
.tw-masthead--photo .tw-masthead__title span { color: #E7E1DA !important; }
.tw-masthead--photo .tw-masthead__meta { color: #E7E1DA; text-shadow: 0 1px 6px rgba(0,0,0,0.6); }
.tw-masthead--photo .tw-masthead__meta strong { color: #FFFFFF; }

/* ─── HERO SUP + PROVISIONAL (ported verbatim from this-week.tsx) ─── */
.week-hero__dual-num sup { font-size: 24px; line-height: 1; vertical-align: 0.55em; font-weight: 400; color: var(--text-mid); }
.hero-provisional { font-size: 13px; color: var(--text-dim); margin-top: 12px; margin-bottom: 32px; }

/* sticky toc */
.m-toc { position: sticky; top: calc(var(--site-header-h, 0px) - 1px); z-index: 40; background: var(--paper); border-bottom: 1px solid var(--taupe); height: 44px; min-height: 44px; max-height: 44px; line-height: 1; overflow-x: auto; overflow-y: hidden; scrollbar-width: none; }
.m-toc ul { display: flex; gap: 4px; list-style: none; margin: 0; padding: 0 56px; height: 44px; align-items: center; width: max-content; flex-wrap: nowrap; }
.m-toc a { display: flex; align-items: center; height: 44px; min-height: 44px; padding: 0 14px; font-family: 'Jost', system-ui, sans-serif; font-size: 12px; font-weight: 400; line-height: 1; letter-spacing: .12em; text-transform: uppercase; color: var(--ink-mid); text-decoration: none; white-space: nowrap; }
.m-toc a:hover, .m-toc a:focus-visible { color: var(--ink); text-decoration: underline; }
.m-doc-orient { padding: 16px 64px; margin: 0; font-size: 15px; color: var(--olive, #87806E); background: var(--paper); border-bottom: 1px solid var(--taupe); }

/* sections */
.m-section { padding: 36px 56px 56px; border-bottom: 1px solid var(--taupe); scroll-margin-top: calc(var(--site-header-h, 0px) + 44px); }
.sec-label { font-family: var(--sans); font-size: 11px; letter-spacing: .22em; text-transform: uppercase; color: var(--olive); margin-bottom: 12px; }
.m-h2 { font-family: var(--serif); font-weight: 300; font-size: clamp(26px, 3vw, 36px); line-height: 1.16; color: var(--ink); margin-bottom: 18px; }
.m-h3 { font-family: var(--serif); font-weight: 300; font-size: 22px; color: var(--ink); margin: 28px 0 12px; }
.m-p { max-width: 72ch; margin-bottom: 16px; }
.m-lede { font-family: var(--serif); font-style: italic; font-size: 19px; line-height: 1.55; color: var(--olive); margin-bottom: 14px; max-width: 70ch; }
.m-quote { text-align: center; font-family: var(--serif); font-style: italic; font-size: 26px; line-height: 1.45; color: var(--ink); max-width: 60ch; margin: 0 auto 32px; }
.m-quote cite { display: block; margin-top: 14px; font-style: normal; font-family: var(--sans); font-size: 11px; letter-spacing: .2em; text-transform: uppercase; color: var(--olive); }

/* glance grid (legacy — superseded in Part 1 by the ported .week-hero__dual / .week-stats, kept for any other callers) */
.m-glance { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1px; background: var(--taupe); border: 1px solid var(--taupe); margin-bottom: 28px; }
.m-glance__cell { background: var(--paper); padding: 22px 20px; }
.m-glance__k { font-size: 11px; letter-spacing: .16em; text-transform: uppercase; color: var(--olive); margin-bottom: 10px; }
.m-glance__v { font-family: var(--serif); font-size: 34px; line-height: 1.05; color: var(--ink); font-variant-numeric: tabular-nums; }
.m-glance__d { margin-top: 8px; font-size: 12.5px; letter-spacing: .02em; }

/* deltas */
.monthly-scope .up { color: var(--up-strong); }
.monthly-scope .dn { color: var(--down-strong); }
.monthly-scope .fl { color: var(--olive); }

/* hero boxes (legacy .m-box — superseded in Part 1 by the ported .data-key, kept for any other callers) */
.m-boxes { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 18px; }
.m-box { border: 1px solid var(--taupe); border-top: 3px solid var(--tier, var(--p90)); background: var(--paper-2); padding: 22px 20px; }
.m-box__label { font-size: 11px; letter-spacing: .18em; text-transform: uppercase; color: var(--tier-text, var(--p90-text)); margin-bottom: 12px; }
.m-box__v { font-family: var(--serif); font-size: 30px; color: var(--ink); font-variant-numeric: tabular-nums; }
.m-box__row { display: flex; justify-content: space-between; gap: 12px; margin-top: 12px; font-size: 13.5px; border-top: 1px solid var(--taupe); padding-top: 10px; }
.m-box__row span:last-child { font-variant-numeric: tabular-nums; color: var(--ink); }

/* callout / what this means */
.m-callout { border-left: 3px solid var(--olive); background: var(--paper-2); padding: 18px 22px; margin: 22px 0; max-width: 76ch; }
.m-wtm { border: 1px solid var(--taupe); background: var(--paper-2); padding: 26px 24px; }
.m-wtm__t { font-family: var(--serif); font-size: 24px; color: var(--ink); margin-bottom: 12px; }
.m-wtm .m-p, .m-wtm .m-rec { max-width: none; }
#part-1 .m-callout, #part-1 .m-p, #part-1 .m-lede, #part-2 .m-callout, #part-2 .m-p, #part-2 .m-lede, #part-3 .m-callout, #part-3 .m-p, #part-3 .m-lede, #part-4 .m-callout, #part-4 .m-p, #part-4 .m-lede, #part-5 .m-callout, #part-5 .m-p, #part-5 .m-lede { max-width: none; }
.m-rec { margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--taupe); font-size: 15px; }
.m-rec strong { color: var(--ink); }

/* tables */
.cv-wrap { overflow-x: auto; overflow-y: hidden; border: 1px solid var(--taupe); margin: 18px 0; }
.cv-table { width: 100%; border-collapse: collapse; font-size: 14.5px; font-variant-numeric: tabular-nums; background: var(--paper); }
.cv-table caption { text-align: left; padding: 14px 16px; font-size: 11px; letter-spacing: .18em; text-transform: uppercase; color: var(--olive); background: var(--paper-2); border-bottom: 1px solid var(--taupe); }
.cv-table th, .cv-table td { padding: 11px 16px; text-align: right; border-bottom: 1px solid var(--taupe); }
.cv-table th:first-child, .cv-table td:first-child { text-align: left; }
.cv-table thead th { font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: var(--ink-mid); font-weight: 500; }
.cv-table tbody th { font-weight: 400; color: var(--ink); }
.cv-table tbody tr:last-child th, .cv-table tbody tr:last-child td { border-bottom: 0; }
.rank-num { font-family: var(--serif); font-size: 19px; color: var(--olive); width: 3ch; display: inline-block; }

/* charts */
.m-charts { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 22px; }
.m-chart { border: 1px solid var(--taupe); background: var(--paper); padding: 18px; }
.m-chart__t { font-size: 11px; letter-spacing: .18em; text-transform: uppercase; color: var(--olive); margin-bottom: 14px; }
.m-chart__c { position: relative; height: 280px; }
.m-legend { display: flex; flex-wrap: wrap; gap: 16px; margin-top: 14px; font-size: 12.5px; color: var(--ink-mid); }
.m-legend i { display: inline-block; width: 14px; height: 3px; margin-right: 7px; vertical-align: middle; }
.m-panels { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 22px; margin-bottom: 8px; }
.m-panels .cv-wrap { margin: 0; }

/* tier-card disclosure (Luxury Lines) */
.m-tier-detail { margin-top: 2px; border-top: 1px solid var(--rule); }
.m-tier-detail > summary { cursor: pointer; list-style: none; display: flex; align-items: center; gap: 8px; padding: 12px 16px; font-family: var(--sans); font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--text-mid); background: var(--ground-hi); min-height: 44px; }
.m-tier-detail > summary::-webkit-details-marker { display: none; }
.m-tier-detail > summary::before { content: '▸'; color: var(--rust); font-size: 10px; }
.m-tier-detail[open] > summary::before { content: '▾'; }
.m-tier-detail[open] > summary { border-bottom: 1px solid var(--rule); }

/* momentum: three tiers, five metrics (visual language ported from report.html's cycle chart) */
.m-cycle-title { font-family: var(--serif); font-size: 20px; color: var(--ink); text-transform: none; letter-spacing: .02em; margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1px solid var(--taupe); font-weight: 400; }
.m-cycle-toggle { display: flex; flex-wrap: nowrap; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; border: 1px solid var(--ink); width: fit-content; max-width: 100%; margin-bottom: 4px; }
.m-cycle-toggle::-webkit-scrollbar { display: none; }
.m-cycle-toggle button { font-family: var(--sans); font-size: 13px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; padding: 12px 18px; min-height: 44px; background: var(--paper); color: var(--ink); border: none; border-right: 1px solid var(--ink); cursor: pointer; white-space: nowrap; flex: none; }
.m-cycle-toggle button:last-child { border-right: none; }
.m-cycle-toggle button.is-active { background: var(--ink); color: #fff; }
.m-cycle-toggle button:hover:not(.is-active) { background: #F0ECE6; }
.m-cycle-hint { font-size: 14px; color: var(--ash); font-style: italic; margin: 10px 0 18px; }
.m-cycle-chart { border: 1px solid var(--rule); padding: 28px 32px 16px; margin-top: 8px; position: relative; overflow: hidden; background: var(--paper); }
.m-cycle-legend { display: flex; flex-wrap: wrap; gap: 24px; margin-bottom: 18px; font-size: 14px; position: relative; z-index: 1; font-variant-numeric: tabular-nums; }
.m-cycle-legend span { display: inline-flex; align-items: center; gap: 8px; }
.m-cycle-legend i { width: 10px; height: 10px; border-radius: 50%; display: inline-block; flex: none; }
.m-cycle-legend em { font-style: normal; color: var(--ink-mid); }
.m-cycle-canvas { position: relative; height: 340px; z-index: 1; }
@media (max-width: 720px) {
  .m-cycle-chart { padding: 16px 12px 12px; }
  .m-cycle-legend { gap: 6px 14px; font-size: 12px; margin-bottom: 10px; flex-direction: column; }
  .m-cycle-toggle button { padding: 12px 14px; font-size: 12px; }
}


/* xref pills */
.m-xrefs { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 20px; }
.xref { display: inline-flex; align-items: center; min-height: 44px; padding: 0 16px; border: 1px solid var(--taupe); background: var(--paper); font-size: 12px; letter-spacing: .12em; text-transform: uppercase; color: var(--ink-mid); text-decoration: none; }
.xref:hover, .xref:focus-visible { color: var(--ink); border-color: var(--olive); }

/* bottom line + footnotes */
.m-bottom { padding: 56px; background: var(--paper-2); border-bottom: 1px solid var(--taupe); }
.m-bottom p { font-family: var(--serif); font-style: italic; font-size: 24px; line-height: 1.5; color: var(--ink); max-width: 64ch; }
.m-notes { padding: 36px 56px 56px; font-size: 13px; color: var(--ink-mid); scroll-margin-top: calc(var(--site-header-h, 0px) + 44px); }
.m-notes h2 { font-size: 11px; letter-spacing: .22em; text-transform: uppercase; color: var(--olive); margin-bottom: 14px; }
.m-notes p, .m-notes dd { max-width: 82ch; margin-bottom: 10px; }
.m-notes dt { font-weight: 500; color: var(--ink); margin-top: 10px; }

/* ══════════ Ported verbatim from this-week.tsx — hero tier boxes (.data-key) ══════════ */
.data-key { border: 1px solid var(--rule); border-top: 3px solid #0a0a0a; background: var(--ground); padding: 0; margin-bottom: 44px; }
.data-key__tiers { display: grid; grid-template-columns: repeat(3, 1fr); }
.data-key__tier { padding: 50px 32px 48px; border-right: 1px solid var(--rule); text-align: center; display: flex; flex-direction: column; align-items: center; }
.data-key__tier:last-child { border-right: none; }
.data-key__tier-eyebrow { font-family: var(--serif); font-style: italic; font-size: 24px; font-weight: 400; letter-spacing: 0.01em; text-transform: none; margin-bottom: 30px; }
.data-key__tier-eyebrow--luxury { color: #6C7881; }
.data-key__tier-eyebrow--prime  { color: #7A7363; }
.data-key__tier-eyebrow--trophy { color: #A45A58; }
.data-key__tier-floor { display: flex; align-items: baseline; justify-content: center; gap: 10px; margin-bottom: 22px; }
.data-key__tier-floor-num { font-family: var(--serif); font-size: 32px; font-weight: 300; line-height: 1; letter-spacing: -0.01em; }
.data-key__tier-floor-num sup { font-size: 0.55em; font-weight: 400; margin-left: 1px; top: -0.05em; position: relative; }
.data-key__tier-floor-lbl { font-size: 12.5px; font-weight: 400; letter-spacing: 0.16em; text-transform: uppercase; color: var(--text-dim); transform: translateY(-2px); }
.data-key__tier-rule { width: 150px; height: 1px; background: var(--rule); margin: 0 0 30px; }
.data-key__tier-count { font-family: var(--serif); font-size: clamp(48px, 4.6vw, 56px); font-weight: 300; line-height: 1; margin-bottom: 18px; letter-spacing: 0; }
.data-key__tier-sub { font-size: 15px; font-weight: 400; color: var(--text-mid); margin-bottom: 30px; }
.data-key__tier-desc { font-size: 15px; font-weight: 400; color: var(--text-mid); }
.data-key__tier--luxury .data-key__tier-floor-num,
.data-key__tier--luxury .data-key__tier-count { color: #6C7881; }
.data-key__tier--prime  .data-key__tier-floor-num,
.data-key__tier--prime  .data-key__tier-count { color: #7A7363; }
.data-key__tier--trophy .data-key__tier-floor-num,
.data-key__tier--trophy .data-key__tier-count { color: #A45A58; }
@media (max-width: 720px) {
  .data-key__tiers { grid-template-columns: 1fr; }
  .data-key__tier { border-right: none; border-bottom: 1px solid var(--rule); }
  .data-key__tier:last-child { border-bottom: none; }
}

/* ══════════ Real hero-grid — tier cutoffs + counts + volume, structural port of
   src/reports/quarterly-brief.html's .hero-grid / .hero-cell / .hero-tier / .hero-floor /
   .hero-num / .hero-sub (that file's lines ~37, ~53-66, ~287-296). Supersedes .data-key
   above for this section per docs/design-rulebook.md §11 + explicit owner direction to
   model Monthly's hero on the Quarterly instead of This Week. ══════════ */
.hero-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px 40px; background: var(--paper); border: 2px solid var(--ink); border-top-width: 5px; border-radius: 3px; margin-bottom: 40px; padding: 40px 36px; }
.hero-cell { background: transparent; border: none; padding: 0; text-align: center; }
.hero-cell:nth-child(1), .hero-cell:nth-child(2) { border-right: 1px solid rgba(28,26,24,.18); }
.hero-tier { font-family: 'Ivy Mode','Cormorant Garamond',serif; font-size: 16px; font-weight: 900; letter-spacing: .18em; text-transform: uppercase; margin-bottom: 8px; color: var(--ink); -webkit-text-stroke: .4px currentColor; }
.hero-tier.p90, .hero-floor.p90 { color: #565C62; }
.hero-tier.p95, .hero-floor.p95 { color: #797467; }
.hero-tier.p99, .hero-floor.p99 { color: #9A6863; }
.hero-floor { display: inline-block; font-family: 'Ivy Mode','Times New Roman',Georgia,serif; font-size: 1.5rem; font-weight: 500; line-height: 1; margin-bottom: 18px; padding-bottom: 16px; border-bottom: 1px solid rgba(28,26,24,.18); font-variant-numeric: tabular-nums; color: var(--ink); }
.hero-floor.p90 { border-bottom-color: color-mix(in oklab, var(--p90) 45%, transparent); }
.hero-floor.p95 { border-bottom-color: color-mix(in oklab, var(--p95) 45%, transparent); }
.hero-floor.p99 { border-bottom-color: color-mix(in oklab, var(--p99) 45%, transparent); }
.hero-floor-lbl { display: block; font-size: 12px; color: var(--ash); text-transform: uppercase; letter-spacing: .1em; font-weight: 400; font-family: 'Jost',system-ui,sans-serif; margin: 6px 0 0; }
.hero-num { font-family: 'Ivy Mode','Times New Roman',Georgia,serif; font-size: 2.2rem; font-weight: 400; line-height: 1; margin-bottom: 6px; font-variant-numeric: tabular-nums; }
.hero-sub { font-size: 14px; color: var(--ash); }
@media (max-width: 640px) {
  .hero-grid { grid-template-columns: 1fr !important; padding: 24px 20px; gap: 0; margin-bottom: 28px; }
  .hero-cell:nth-child(1), .hero-cell:nth-child(2) { border-right: none; }
  .hero-cell + .hero-cell { border-top: 1px solid rgba(28,26,24,.18); padding-top: 20px; margin-top: 20px; }
  .hero-num { font-size: 1.9rem; }
  .hero-floor { font-size: 1.25rem; margin-bottom: 14px; padding-bottom: 12px; }
}

/* ══════════ Top 10 Neighborhoods concentration summary. Structural port of the
   Quarterly Report's concentration block, which lives as a full-width 4th .hero-cell
   inside the same .hero-grid box as the three tier cards. ══════════ */
.m-top10-concentration { border: none; border-top: 1px solid rgba(28,26,24,.18); border-radius: 0; background: transparent; padding: 26px 0 0; margin: 14px 0 0; text-align: center; }
.m-top10-concentration__title { font-family: var(--serif); font-size: 20px; color: var(--ink); margin-bottom: 10px; }
.m-top10-concentration__stats { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px; text-align: center; }
.m-top10-concentration__val { font-family: var(--serif); font-size: 1.8rem; color: var(--ink-mid); font-variant-numeric: tabular-nums; }
.m-top10-concentration__cap { font-size: 14px; color: var(--olive); margin-top: 6px; }
@media (max-width: 640px) {
  .m-top10-concentration { padding: 20px 20px; }
  .m-top10-concentration__stats { grid-template-columns: 1fr; gap: 16px; }
}


/* ══════════ Ported verbatim — dual headline metrics + secondary stat row ══════════ */
.week-hero__dual { display: flex; align-items: flex-end; gap: 0; margin-bottom: 40px; flex-wrap: wrap; }
.week-hero__dual-metric { flex: 1; min-width: 220px; padding-right: 56px; border-right: 1px solid var(--rule); margin-right: 56px; }
.week-hero__dual-metric:last-child { border-right: none; padding-right: 0; margin-right: 0; }
.week-hero__dual-num { font-family: var(--serif); font-weight: 700; line-height: 0.88; color: var(--text); margin-bottom: 10px; }
.week-hero__dual-num--primary { font-size: clamp(80px, 14vw, 128px); letter-spacing: -4px; }
.week-hero__dual-num--secondary { font-size: clamp(48px, 9vw, 80px); letter-spacing: -2px; }
.week-hero__dual-label { font-size: 13px; font-weight: 700; color: var(--text); letter-spacing: 0.02em; margin-bottom: 10px; }

.week-stats { display: flex; gap: 0; flex-wrap: wrap; border-top: 1px solid var(--rule); padding-top: 32px; }
.week-stats__item { flex: 1; min-width: 140px; padding-right: 32px; border-right: 1px solid var(--rule); margin-right: 32px; }
.week-stats__item:last-child { border-right: none; margin-right: 0; padding-right: 0; }
.week-stats__val { font-family: var(--serif); font-size: 26px; font-weight: 700; line-height: 1; color: var(--text); margin-bottom: 6px; }
.week-stats__label { font-size: 12.5px; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-mid); line-height: 1.3; }
.stat-empty { font-family: var(--sans) !important; font-size: 13px !important; font-style: italic; color: var(--text-dim) !important; font-weight: 400 !important; }

/* ══════════ Ported verbatim — delta chips shared by the dual metrics + Luxury Lines ══════════ */
.ldr-badge { display: inline-flex; align-items: center; gap: 2px; font-size: 12px; font-weight: 700; padding: 2px 6px; border-radius: 2px; white-space: nowrap; }
.ldr-badge-up { background: var(--sage-bg); color: var(--sage); }
.ldr-badge-dn { background: var(--rust-bg); color: var(--rust); }
.ldr-badge-zero { color: var(--text-dim); }

/* ══════════ Ported verbatim from this-week.tsx — Quick Compare cards + Leaderboard detail table (Part 4) ══════════ */
.ldr-card { margin-top: 40px; border: 1px solid var(--rule); overflow: hidden; }
.ldr-toolbar { display: flex; align-items: center; padding: 10px 16px; border-bottom: 1px solid var(--rule); background: var(--ground-hi); }
.ldr-toolbar-label { font-size: 9.5px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--text-dim); }
.ldr-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
.ldr-tbl { width: 100%; border-collapse: collapse; min-width: 700px; }
.ldr-grp th { font-size: 8.5px; letter-spacing: 0.1em; text-transform: uppercase; font-weight: 700; padding: 5px 10px; border-bottom: 1px solid var(--rule); }
.ldr-grp .grp-baseline { color: var(--text-dim); background: var(--ground); }

.ldr-tbl thead tr:last-child th { font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-dim); font-weight: 700; padding: 8px 10px; text-align: left; background: var(--ground); border-bottom: 1px solid var(--rule); white-space: nowrap; }
.ldr-tbl thead tr:last-child th.r { text-align: right; }

.ldr-tbl tbody tr { border-bottom: 1px solid var(--rule); }
.ldr-tbl tbody tr:last-child { border-bottom: none; }
.ldr-tbl tbody tr:hover { background: rgba(0,0,0,0.018); }
.ldr-tbl tbody tr.gold-row td.ldr-rank { border-left: 2px solid var(--gold); }
.ldr-tbl td { padding: 10px 10px; vertical-align: middle; }
.ldr-rank { font-size: 11.5px; color: var(--text-dim); font-variant-numeric: tabular-nums; text-align: center; width: 32px; }
.ldr-name { font-family: var(--serif); font-size: 14px; color: var(--text); min-width: 148px; }
.ldr-vol { min-width: 156px; }
.ldr-vol-row { display: flex; align-items: center; gap: 8px; }
.ldr-vol-track { flex: 1; max-width: 88px; height: 4px; background: var(--rule); overflow: hidden; }
.ldr-vol-bar { height: 100%; background: rgba(136,129,111,0.7); }
.ldr-vol-num { font-size: 12px; font-variant-numeric: tabular-nums; color: var(--text); white-space: nowrap; min-width: 48px; }
.ldr-num { font-size: 12px; font-variant-numeric: tabular-nums; color: var(--text-mid); text-align: right; white-space: nowrap; }
.ldr-entry { font-size: 12px; font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; min-width: 62px; color: var(--text); }
.ldr-avg { font-size: 12px; font-variant-numeric: tabular-nums; text-align: right; color: var(--text-mid); min-width: 62px; }
.ldr-pct { min-width: 70px; }
.ldr-pct-row { display: flex; align-items: center; justify-content: flex-end; gap: 5px; }
.ldr-pct-track { width: 24px; height: 3px; background: var(--rule); overflow: hidden; }
.ldr-pct-bar { height: 100%; background: rgba(135,150,161,0.7); }
.ldr-pct-num { font-size: 12px; font-variant-numeric: tabular-nums; color: var(--text-mid); min-width: 28px; text-align: right; }
.ldr-delta { text-align: right; width: 66px; }
.ldr-foot { padding: 8px 16px; border-top: 1px solid var(--rule); display: flex; align-items: center; gap: 12px; flex-wrap: wrap; background: var(--ground); }
.ldr-leg { display: flex; align-items: center; gap: 4px; font-size: 10px; color: var(--text-dim); }
.qc-grid { display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: auto 1fr auto; gap: 20px; margin-top: 20px; }
@media (max-width: 980px) { .qc-grid { grid-template-columns: 1fr 1fr; } }
@media (max-width: 640px) { .qc-grid { grid-template-columns: 1fr; } }
.qc-card { background: var(--ground); border: 1px solid var(--rule); border-radius: 4px; padding: 16px 0 4px; display: grid; grid-row: span 3; grid-template-rows: subgrid; align-content: start; }
@supports not (grid-template-rows: subgrid) { .qc-card { display: flex; flex-direction: column; } .qc-card__head { min-height: 64px; } }
.qc-card__head { padding: 0 16px 12px; border-bottom: 1px solid var(--rule); margin-bottom: 2px; }
.qc-card__title { font-family: var(--serif); font-size: 15px; color: var(--text); margin: 0 0 4px; font-weight: 400; }
.qc-card__cadence { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-dim); font-weight: 600; line-height: 1.5; }
.qc-tbl { width: 100%; border-collapse: collapse; align-self: start; }
.qc-tbl th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-dim); font-weight: 600; padding: 8px 16px; height: 30px; box-sizing: border-box; }
.qc-tbl th.r { text-align: right; }
.qc-tbl td { padding: 4px 16px; height: 36px; box-sizing: border-box; font-size: 12.5px; line-height: 1.3; border-top: 1px solid var(--rule); vertical-align: middle; }
.qc-card__note { padding: 10px 16px 2px; font-size: 11px; color: var(--text-dim); line-height: 1.55; align-self: end; }
.qc-rank { color: var(--text-dim); width: 24px; font-variant-numeric: tabular-nums; }
.qc-name { font-family: var(--serif); color: var(--text); }
.qc-n-tag { font-size: 9.5px; color: var(--text-dim); }
.qc-num { font-variant-numeric: tabular-nums; color: var(--text); white-space: nowrap; text-align: right; }
.qc-bar-cell { display: flex; align-items: center; gap: 6px; justify-content: flex-end; }
.qc-bar-track { width: 40px; height: 4px; background: var(--rule); border-radius: 2px; overflow: hidden; }
.qc-bar-fill { height: 100%; background: var(--rust); }
.qc-bar-num { font-size: 12px; color: var(--text); width: 30px; text-align: right; }
.qc-tagcell { text-align: left; white-space: nowrap; }
.qc-tag { display: inline-block; font-size: 9.5px; font-weight: 700; padding: 2px 5px; border-radius: 3px; margin-right: 3px; }
.qc-tag-c { background: rgba(172,98,96,0.14); color: var(--rust); }
.qc-tag-l { background: rgba(135,150,161,0.16); color: var(--text-mid); }
.qc-tag-new { background: rgba(135,128,110,0.14); color: var(--text-dim); font-style: italic; }

/* ══════════ Ported verbatim — section eyebrow/title/note, used by the 3 new sections below ══════════ */
.section__eyebrow { font-family: var(--sans); font-size: 14px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: var(--olive); margin-bottom: 12px; display: flex; align-items: center; gap: 12px; }
.section__eyebrow::after { content: ''; flex: 1; height: 1px; background: var(--taupe); }
.section__title { font-family: var(--serif); font-size: clamp(22px,3.2vw,32px); font-weight: 400; line-height: 1.15; color: var(--ink); margin-bottom: 22px; text-wrap: balance; }
.section__note { font-family: var(--sans); font-size: 16.5px; color: var(--ink-mid); max-width: 640px; line-height: 1.65; margin-bottom: 32px; }
@media (max-width: 700px) {
  .section__title { font-size: 26px; }
  .section__eyebrow { font-size: 13px; }
}

/* ══════════ Ported verbatim — Top Deals table ══════════ */
.top-deals { margin: 0 auto; max-width: 960px; background: var(--ground-hi); border: 1px solid var(--rule-mid); border-radius: 2px; overflow: hidden; }
.top-deals__head { display: grid; grid-template-columns: 1fr 62px 90px 68px 66px 120px 84px; align-items: baseline; gap: 12px; padding: 12px 22px; border-bottom: 1px solid var(--rule-mid); background: var(--ground-mid); font-size: 10px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: var(--text-mid); }
.top-deals__head > div + div { text-align: right; }
.top-deals__list { display: flex; flex-direction: column; padding: 6px 22px 16px; }
.top-deal-row { display: grid; grid-template-columns: 1fr 62px 90px 68px 66px 120px 84px; align-items: baseline; gap: 12px; padding: 12px 0; border-top: 1px solid var(--rule); }
.top-deal-row:first-child { border-top: none; padding-top: 14px; }
.top-deal-row__address { font-family: var(--serif); font-size: 16px; font-weight: 700; color: var(--text); }
.top-deal-row__sf { font-size: 12.5px; color: var(--text-mid); text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.top-deal-row__ppsf { font-size: 12.5px; color: var(--text-mid); text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.top-deal-row__dom { font-size: 12.5px; color: var(--text-mid); text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.top-deal-row__type { font-size: 10.5px; color: var(--text-dim); text-align: right; text-transform: uppercase; letter-spacing: 0.06em; white-space: nowrap; }
.top-deal-row__hood { font-size: 10.5px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--text-mid); text-align: right; }
.top-deal-row__price { font-family: var(--serif); font-size: 15px; font-weight: 700; color: var(--text); text-align: right; white-space: nowrap; }
.top-deals--empty { font-family: var(--serif); font-size: 14px; font-style: italic; color: var(--text-mid); padding: 14px 22px 18px; }
@media (max-width: 700px) {
  .top-deals { max-width: none; }
  .top-deals__head { display: none; }
  .top-deals__list { padding: 4px 16px 12px; }
  .top-deal-row {
    display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 12px;
    grid-template-columns: none;
    padding: 14px 0; border-top: 1px solid var(--rule);
  }
  .top-deal-row:first-child { border-top: none; }
  .top-deal-row__address { flex: 1 1 60%; font-size: 15px; }
  .top-deal-row__price { flex: 0 0 auto; margin-left: auto; font-size: 14px; text-align: right; }
  .top-deal-row__sf,
  .top-deal-row__ppsf,
  .top-deal-row__dom,
  .top-deal-row__type,
  .top-deal-row__hood {
    flex: 0 0 auto; text-align: left; font-size: 11px; color: var(--text-dim); letter-spacing: 0.02em; text-transform: none; font-weight: 400;
  }
  .top-deal-row__sf::before { content: "SF "; color: var(--text-dim); }
  .top-deal-row__ppsf::before { content: "$/SF "; color: var(--text-dim); }
  .top-deal-row__dom::before { content: "DOM "; color: var(--text-dim); }
  .top-deal-row__type::before { content: "Type "; color: var(--text-dim); }
  .top-deal-row__hood { letter-spacing: 0.02em; text-transform: none; font-weight: 400; }
  .top-deal-row__hood::before { content: "In "; color: var(--text-dim); }
}

/* ══════════ Ported verbatim — Luxury Lines tier cards ══════════ */
.tier-total { display: flex; align-items: flex-end; justify-content: space-between; gap: 32px; flex-wrap: wrap; margin-top: 32px; padding: 22px 26px; background: var(--ground-hi); border: 1px solid var(--rule-mid); border-top: 3px solid var(--text); }
.tier-total__label { font-size: 12px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: var(--text-mid); display: flex; flex-direction: column; gap: 8px; max-width: 42ch; min-width: 0; flex: 1 1 clamp(240px, 40%, 42ch); }
.tier-total__sub { font-size: 13.5px; font-weight: 400; letter-spacing: 0.01em; text-transform: none; color: var(--text-dim); text-wrap: pretty; }
.tier-total__head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; min-width: 0; }
.tier-total__chip { font-size: 10px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-dim); border: 1px solid var(--rule, rgba(0,0,0,0.15)); border-radius: 999px; padding: 3px 9px; cursor: help; white-space: nowrap; }
.tier-total__chip:hover, .tier-total__chip:focus-visible { color: var(--text); border-color: currentColor; outline: none; }
.tier-total__figs { display: flex; gap: 44px; flex-wrap: wrap; min-width: 0; flex: 0 1 auto; }
.tier-total__fig { min-width: 0; flex: 1 1 130px; }
.tier-total__num { font-family: var(--serif); font-size: clamp(28px, 7vw, 44px); font-weight: 700; line-height: 1; letter-spacing: -0.01em; color: var(--text); overflow-wrap: anywhere; }
.tier-total__cap { font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--text-dim); margin: 8px 0 6px; }
.tier-total__pills { display: flex; gap: 6px; flex-wrap: wrap; min-height: 19px; }
@media (max-width: 720px) {
  .tier-total { padding: 18px; gap: 20px; align-items: flex-start; }
  .tier-total__label { flex: 1 1 100%; max-width: none; letter-spacing: 0.14em; }
  .tier-total__figs { gap: 20px 28px; width: 100%; }
  .tier-total__fig { flex: 1 1 120px; }
}
@media (max-width: 420px) {
  .tier-total__figs { display: grid; grid-template-columns: minmax(0, 1fr); gap: 18px; }
  .tier-total__fig { flex: none; }
  .tier-total__cap { letter-spacing: 0.1em; }
}
.tier-check { margin-top: 18px; font-size: 12.5px; line-height: 1.5; color: var(--text-dim); display: flex; gap: 8px; align-items: flex-start; }
.tier-check::before { content: ""; flex: 0 0 auto; width: 7px; height: 7px; margin-top: 6px; border-radius: 50%; background: currentColor; }
.tier-check--warn { color: #A37670; }
.tier-check--idle { opacity: 0.8; }



.tier-grid { display: grid; grid-template-columns: 1fr 1px 1fr 1px 1fr; margin-top: 40px; }

.tier-divider { background: var(--rule-mid); margin: 0 40px; }
.tier-col { padding-right: 16px; }
.tier-col:last-child { padding-right: 0; }
.tier-col__label { font-size: 12px; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase; color: var(--text-dim); margin-bottom: 12px; }
.tier-col__price { font-family: var(--serif); font-size: clamp(36px, 6vw, 52px); font-weight: 700; line-height: 1; color: var(--text); margin-bottom: 4px; letter-spacing: -1px; }
.tier-col__pct { font-size: 13.5px; color: var(--p90-text); font-weight: 600; letter-spacing: 0.06em; margin-bottom: 28px; }
.tier-col__stats { display: flex; flex-direction: column; gap: 0; padding-top: 20px; border-top: 1px solid var(--rule); }
.pulse-row { display: flex; justify-content: space-between; align-items: flex-start; padding: 10px 20px; border-bottom: 1px solid var(--rule); background: var(--ground-hi); }
.pulse-row:last-child { border-bottom: none; }
.pulse-row__label { font-size: 12px; color: var(--text-mid); }
.pulse-row__val { font-family: var(--serif); font-size: 15px; font-weight: 700; color: var(--text); white-space: nowrap; }
.pulse-block { position: relative; }
.pulse-summary { display: flex; align-items: stretch; gap: 0; margin-bottom: 32px; padding-top: 28px; flex-wrap: wrap; }
.pulse-summary__metric { flex: 1; min-width: 200px; padding-right: 40px; border-right: 1px solid var(--rule); margin-right: 40px; }
.pulse-summary__metric:last-of-type { border-right: none; margin-right: 0; padding-right: 0; }
.pulse-summary__num { font-family: var(--serif); font-size: clamp(32px, 6vw, 48px); font-weight: 700; line-height: 1; color: var(--text); margin-bottom: 4px; }
.pulse-summary__label { font-size: 13.5px; color: var(--text-mid); margin-bottom: 10px; letter-spacing: 0.02em; }
.pulse-summary__vs { font-size: 13.5px; color: var(--text-dim); display: flex; gap: 6px; align-items: baseline; }
.pulse-summary__vs strong { font-size: 14.5px; font-weight: 700; }
.pulse-summary__vs.down strong { color: var(--rust); }
.pulse-summary__vs.up strong { color: var(--sage); }
.pulse-summary__vs.flat strong { color: var(--text-dim); }
.pulse-grid { display: grid; grid-template-columns: repeat(3, 1fr); border: 1px solid var(--rule-mid); border-radius: 2px; overflow: hidden; margin-top: 16px; }
.pulse-col__head { padding: 12px 20px; background: var(--ground-mid); border-bottom: 1px solid var(--rule-mid); font-size: 10px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: var(--text-mid); display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 4px; }
.pulse-col:not(:last-child) .pulse-col__head,
.pulse-col:not(:last-child) .pulse-row { border-right: 1px solid var(--rule-mid); }
@media (max-width: 800px) {
  .pulse-grid { grid-template-columns: 1fr; }
  .pulse-col:not(:last-child) .pulse-col__head,
  .pulse-col:not(:last-child) .pulse-row { border-right: none; border-bottom: 1px solid var(--rule-mid); }
  .tier-grid { grid-template-columns: 1fr; gap: 0; }
  .tier-divider { display: none; }
  .tier-col { padding-right: 0; padding-top: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--rule); }
  .tier-col:last-child { border-bottom: none; }
  .tier-col__rule { width: 40px; }
  .week-hero__dual-metric { flex: 1 1 100%; padding-right: 0; border-right: none; margin-right: 0; padding-bottom: 24px; margin-bottom: 24px; border-bottom: 1px solid var(--rule); }
  .week-hero__dual-metric:last-child { padding-bottom: 0; margin-bottom: 0; border-bottom: none; }
  .week-stats__item { min-width: 120px; padding-right: 20px; margin-right: 20px; }
}
@media (max-width: 480px) {
  .week-stats { flex-direction: column; gap: 20px; }
  .week-stats__item { border-right: none; margin-right: 0; padding-right: 0; }
}

/* ══════════ Ported verbatim — Market Pulse status badge (5-state so-what read) ══════════ */
.week-read { display: inline-flex; align-items: center; gap: 7px; padding: 6px 14px; border-radius: 2px; font-size: 13px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 8px; }
.week-read--busy   { background: rgba(199,185,178,0.18); color: #2A5C40; border: 1px solid rgba(199,185,178,0.4); }
.week-read--above  { background: rgba(199,185,178,0.10); color: #3D6652; border: 1px solid rgba(199,185,178,0.25); }
.week-read--normal { background: var(--ground-mid); color: var(--text-mid); border: 1px solid var(--rule-mid); }
.week-read--slow   { background: rgba(158,80,64,0.08); color: #7A3428; border: 1px solid rgba(158,80,64,0.25); }
.week-read--quiet  { background: var(--gold-bg); color: #7A5E2A; border: 1px solid rgba(135,128,110,0.3); }

/* ══════════ Ported verbatim — Unit Breakdown donut charts (hand-drawn canvas,
   matching This Week's actual implementation — not Chart.js) ══════════ */
.donut-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; margin-top: 32px; }
.donut-wrap { display: flex; flex-direction: column; align-items: center; }
.donut-title { font-size: 11px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--text-mid); margin-bottom: 20px; align-self: flex-start; }
.donut-canvas-wrap { width: 100%; max-width: 360px; }
.donut-canvas-wrap canvas { display: block; width: 100%; height: auto; }

/* ══════════ Ported verbatim — Supply and Absorption dual strip (This Week) ══════════ */
.supply-dual { display: grid; grid-template-columns: 1fr 1px 1fr; gap: 0; margin: 32px 0 40px; }
.supply-half { padding-right: 40px; }
.supply-half:last-child { padding-right: 0; padding-left: 56px; }
.supply-half__head { font-size: 12px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: var(--text-dim); margin-bottom: 20px; padding-bottom: 10px; border-bottom: 1px solid var(--rule); }
.supply-divider { background: var(--rule-mid); }
.supply-strip { display: flex; flex-direction: column; gap: 24px; }
.supply-stat__val { font-family: var(--serif); font-size: clamp(40px, 7vw, 60px); font-weight: 700; line-height: 1; color: var(--text); letter-spacing: -1px; margin-bottom: 6px; }
.supply-stat__label { font-size: 10.5px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--text-mid); margin-bottom: 4px; }
.supply-stat__context { font-size: 11.5px; color: var(--text-dim); margin-top: 6px; }
@media (max-width: 600px) {
  .supply-dual { grid-template-columns: 1fr; }
  .supply-divider { display: none; }
  .supply-half { padding: 0 0 32px 0; border-bottom: 1px solid var(--rule); }
  .supply-half:last-child { padding: 32px 0 0 0; border-bottom: none; }
}


@media (max-width: 720px) {
  .m-masthead { padding: 32px 24px 24px; }
  .donut-grid { grid-template-columns: 1fr; gap: 40px; }
  .m-toc ul { padding: 0 24px; }
  .m-doc-orient { padding-left: 24px; padding-right: 24px; }
  .m-section { padding: 32px 24px; }
  .m-bottom, .m-notes { padding: 32px 24px; }
  .monthly-scope { font-size: 16.5px; }
}
`;

/* ─────────── route ─────────── */

const TITLE = "The Month · Manhattan Luxury · Domi Data";
const DESC =
  "Manhattan luxury signed contracts, month over month: tier cutoffs, momentum against the trailing three and twelve month averages, supply and absorption, and neighborhood concentration.";

export const Route = createFileRoute("/monthly")({
  validateSearch: (search: Record<string, unknown>) => ({
    preview: String(search.preview ?? "") === "1" ? (1 as const) : undefined,
  }),
  loaderDeps: ({ search }) => ({ preview: search.preview }),
  // Static preview/prerender passes can run this loader outside a live server
  // request, where the server function has no Start context. Swallow that and
  // let the component re-fetch on the client instead of erroring the page.
  loader: async ({ deps }) => {
    // Gated: never fetch or embed the payload in SSR output.
    if (!MONTHLY_LIVE && deps.preview !== 1) return null;
    try {
      return await getLatestMonthlyReport();
    } catch (err) {
      console.error("[monthly] loader fell back to client fetch:", err);
      return null;
    }
  },
  head: () => ({
    links: [{ rel: "canonical", href: "https://domidata.heatherdomi.com/monthly" }],
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      // Placeholder until MONTHLY_LIVE is true; keep it out of the index.
      { name: "robots", content: MONTHLY_LIVE ? "index, follow, noai, noimageai, max-snippet:20, max-image-preview:none" : "noindex, nofollow, noai, noimageai" },

      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
    scripts: [breadcrumbScript(TRAILS.monthly)],
  }),
  errorComponent: ({ error }) => (
    <div className="site">
      <SiteHeader />
      <main id="main-content" style={{ padding: "80px 56px", textAlign: "center" }}>
        <h1 style={{ fontFamily: "'Ivy Mode', Georgia, serif", fontSize: 28, marginBottom: 12 }}>
          The Month is temporarily unavailable
        </h1>
        <p style={{ color: "#4A4744" }}>{error.message}</p>
      </main>
      <SiteFooter />
    </div>
  ),
  notFoundComponent: () => (
    <div className="site">
      <SiteHeader />
      <main id="main-content" style={{ padding: "80px 56px", textAlign: "center" }}>
        <h1 style={{ fontFamily: "'Ivy Mode', Georgia, serif", fontSize: 28 }}>Report not found</h1>
      </main>
      <SiteFooter />
    </div>
  ),
  component: MonthlyPage,
});

/* ─────────── page ─────────── */

/** Set to true to switch The Month back on. While false, /monthly stays reachable
 *  and linked in nav but renders the coming-soon view below. The full report
 *  component (MonthlyBody and everything it renders) remains intact. */
const MONTHLY_LIVE = true;

function MonthlyComingSoon() {
  return (
    <div className="site">
      <SiteHeader />
      <main id="main-content" className="page-shell">
        <div className="page-eyebrow">The Month</div>
        <h1 className="page-title">Coming Soon</h1>
        <p className="page-deck">
          The Month is being finalized. It publishes once this month's contracts close and the
          figures are verified. Until then, The Week carries the latest signed-contract read.
        </p>
        <div className="m-xrefs" style={{ display: "flex", gap: 12, marginTop: 24 }}>
          <Link to="/this-week" className="xref">
            The Week
          </Link>
        </div>

      </main>
      <SiteFooter />
    </div>
  );
}

/** Loader data when the server pass succeeded, otherwise a client-side re-fetch. */
function useMonthlyRow(allowed: boolean): { row: MonthlyReportRow | null; loading: boolean } {
  const loaded = Route.useLoaderData();
  const fetchRow = useServerFn(getLatestMonthlyReport);
  const [row, setRow] = useState<MonthlyReportRow | null>(allowed ? (loaded ?? null) : null);
  const [loading, setLoading] = useState(allowed ? !loaded : false);
  useEffect(() => {
    if (!allowed) {
      setRow(null);
      setLoading(false);
      return;
    }
    if (loaded) return;
    let cancelled = false;
    setLoading(true);
    void fetchRow()
      .then((res) => {
        if (!cancelled) setRow((res as MonthlyReportRow | null) ?? null);
      })
      .catch((err) => {
        console.error("[monthly] client fetch failed:", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [allowed, loaded, fetchRow]);
  return { row, loading };
}


export function MonthlyPage() {
  const { preview } = Route.useSearch();
  const previewBypass = preview === 1;
  const { row, loading } = useMonthlyRow(MONTHLY_LIVE || previewBypass);
  const hasReport = Boolean(row?.payload);
  const [redirectedToPreview, setRedirectedToPreview] = useState(false);
  useEffect(() => {
    // When a report exists, send /monthly straight to the preview view.
    if (!MONTHLY_LIVE && !previewBypass && hasReport) {
      window.history.replaceState(null, "", "/monthly?preview=1");
      setRedirectedToPreview(true);
    }
  }, [hasReport, previewBypass]);
  if (!MONTHLY_LIVE && !loading && !previewBypass)
    return <MonthlyComingSoon />;
  return <MonthlyLive row={row} loading={loading} />;
}



export function MonthlyLive({ row, loading }: { row: MonthlyReportRow | null; loading: boolean }) {
  if (loading && !row) {
    return (
      <div className="site">
        <SiteHeader />
        <main id="main-content" style={{ padding: "120px 24px", textAlign: "center" }}>
          <p style={{ color: "#4A4744" }}>Loading The Month…</p>
        </main>
        <SiteFooter />
      </div>
    );
  }




  if (!row || !row.payload) {
    return (
      <div className="site">
        <SiteHeader />
        <style dangerouslySetInnerHTML={{ __html: MONTHLY_CSS + QR_DESIGN_CSS }} />
        <main id="main-content" className="monthly-scope">
          <section className="m-section" style={{ textAlign: "center", padding: "96px 24px" }}>
            <h1 className="m-h2">The Month isn't available yet</h1>
            <p className="m-p" style={{ margin: "0 auto" }}>
              The next edition publishes after month close. In the meantime, The Week carries the
              latest signed-contract read.
            </p>
            <div className="m-xrefs" style={{ justifyContent: "center" }}>
              <Link to="/this-week" className="xref">
                The Week
              </Link>
              <a href="/quarterly-brief.html" className="xref">
                The Quarterly
              </a>
            </div>
          </section>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return <MonthlyBody row={row} />;
}

/** Ported verbatim from this-week.tsx's tierCol() string-builder — same three stat
 *  rows (Avg $/sq ft, Volume · 12mo TTM, Signed · 12mo TTM), each with YoY + MoM
 *  delta chips, reusing the .pulse-row / .pulse-row__label / .pulse-row__val classes
 *  This Week itself reuses from the Market Pulse section. */
function renderTierCol(
  key: "luxury" | "prime" | "trophy",
  label: string,
  pctLabel: string,
  color: string,
  tr: MonthlyTier | null | undefined,
) {
  const statRow = (rowLabel: string, val: string | null, yoy: number | null | undefined, mom: number | null | undefined) => (
    <div className="pulse-row" key={rowLabel}>
      <span className="pulse-row__label">{rowLabel}</span>
      {val !== null ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          <span className="pulse-row__val">{val}</span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end", minHeight: 19 }}>
            {twSfxPill(yoy, "YoY")}
            {twSfxPill(mom, "MoM")}
          </div>
        </div>
      ) : (
        <span className="pulse-row__val"><span className="stat-empty">{DASH}</span></span>
      )}
    </div>
  );

  return (
    <div className="tier-col">
      <div className="tier-col__label">{label} &middot; {pctLabel}</div>
      <div className="tier-col__rule" style={{ height: 3, width: 40, background: color, marginBottom: 16, borderRadius: 1 }} />
      <div className="tier-col__price" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span>{twFmtMoneyM(tr?.cutoff ?? null)}</span>
        {twSfxPill(tr?.cutoff_yoy_pct ?? null, "YoY")}
        {twSfxPill(tr?.cutoff_mom_pct ?? null, "MoM")}
      </div>
      <div className="tier-col__stats">
        {statRow("Contracts", twIsNum(tr?.count) ? fmtInt(tr!.count) : null, tr?.count_yoy_pct, tr?.count_mom_pct)}
        {statRow("Volume", twIsNum(tr?.volume) ? twFmtMoneyShort(tr!.volume) : null, tr?.volume_yoy_pct, tr?.volume_mom_pct)}
      </div>
      <details className="m-tier-detail">
        <summary>Trailing 12-month detail</summary>
        <div className="m-tier-detail__body">
          {statRow("Median Price", twIsNum(tr?.median_price) ? twFmtMoneyShort(tr!.median_price) : null, tr?.median_price_yoy_pct, null)}
          {statRow("Avg $ / sq ft", twIsNum(tr?.ppsf_avg) ? twFmtCurrencyInt(tr!.ppsf_avg) : null, tr?.ppsf_avg_yoy_pct, tr?.ppsf_avg_mom_pct)}
          {statRow("Days on Market", twIsNum(tr?.dom) ? String(Math.round(tr!.dom as number)) : null, tr?.dom_yoy_pct, null)}
          {statRow("Volume · 12mo TTM", twIsNum(tr?.volume_52wk) ? twFmtMoneyShort(tr!.volume_52wk) : null, tr?.volume_52wk_yoy_pct, tr?.volume_52wk_mom_pct)}
          {statRow("Signed · 12mo TTM", twIsNum(tr?.cleared_52wk) ? fmtInt(tr!.cleared_52wk) : null, tr?.cleared_52wk_yoy_pct, tr?.cleared_52wk_mom_pct)}
        </div>
      </details>
    </div>
  );
}

/** Some months arrive from the feed with the three tiers as exclusive price bands
 *  (Luxury + Prime + Trophy add up to the segment total); other months arrive with
 *  them nested (Prime and Trophy sit inside Luxury). Work out which shape this month
 *  uses so the copy and the sanity check describe the same thing the reader sees. */
type TierShape = "bands" | "nested" | "unknown";

function tierShape(
  totalCount: number | null | undefined,
  tiers: { luxury?: MonthlyTier | null; prime?: MonthlyTier | null; trophy?: MonthlyTier | null } | null | undefined,
): TierShape {
  const l = tiers?.luxury?.count;
  const pr = tiers?.prime?.count;
  const tp = tiers?.trophy?.count;
  if (!twIsNum(totalCount) || !twIsNum(l)) return "unknown";
  const t = Math.round(totalCount as number);
  if (twIsNum(pr) && twIsNum(tp) && Math.round((l as number) + (pr as number) + (tp as number)) === t) return "bands";
  if (Math.round(l as number) === t) return "nested";
  return "unknown";
}

/** Lightweight on-page sanity check. Confirms the segment total agrees with the three
 *  tier cards below, under whichever shape the feed sent this month. Renders a one-line
 *  reconciliation note in plain language, never blocks. */
function TierTotalCheck({
  totalCount,
  totalVolume,
  tiers,
}: {
  totalCount: number | null | undefined;
  totalVolume: number | null | undefined;
  tiers: { luxury?: MonthlyTier | null; prime?: MonthlyTier | null; trophy?: MonthlyTier | null } | null | undefined;
}) {
  const { state: adminState } = useAdminRole();
  const lux = tiers?.luxury ?? null;
  const prime = tiers?.prime ?? null;
  const trophy = tiers?.trophy ?? null;
  // Internal QA note only. Public readers never see the reconciliation line.
  if (adminState !== "admin") return null;

  const checkable = twIsNum(totalCount) && twIsNum(lux?.count);
  if (!checkable) {
    return (
      <p className="tier-check tier-check--idle" role="status">
        Reconciliation pending. Tier figures for this month are not yet complete.
      </p>
    );
  }

  const shape = tierShape(totalCount, tiers);
  const sumCount =
    twIsNum(lux?.count) && twIsNum(prime?.count) && twIsNum(trophy?.count)
      ? (lux!.count as number) + (prime!.count as number) + (trophy!.count as number)
      : null;
  const sumVolume =
    twIsNum(lux?.volume) && twIsNum(prime?.volume) && twIsNum(trophy?.volume)
      ? (lux!.volume as number) + (prime!.volume as number) + (trophy!.volume as number)
      : null;

  const close = (a: number, b: number) => (b === 0 ? a === 0 : Math.abs(a - b) / Math.abs(b) <= 0.005);

  if (shape === "bands") {
    const volOk = !twIsNum(totalVolume) || sumVolume === null || close(totalVolume as number, sumVolume);
    if (volOk) {
      return (
        <p className="tier-check tier-check--ok" role="status">
          Checked: the three tiers are separate price bands this month, and they add up to the segment
          total of {fmtInt(totalCount)} contracts
          {twIsNum(totalVolume) ? ` and ${twFmtMoneyShort(totalVolume)}` : ""}.
        </p>
      );
    }
    return (
      <p className="tier-check tier-check--warn" role="status">
        Check flagged: the tier counts add up to the {fmtInt(totalCount)} contract total, but their dollar
        volumes add to {twFmtMoneyShort(sumVolume as number)} against a stated total of{" "}
        {twFmtMoneyShort(totalVolume as number)}. Figures are shown as reported by the data feed.
      </p>
    );
  }

  if (shape === "nested") {
    const issues: string[] = [];
    if (twIsNum(totalVolume) && twIsNum(lux?.volume) && !close(totalVolume as number, lux!.volume as number)) {
      issues.push(
        `the total shows ${twFmtMoneyShort(totalVolume as number)} while the Luxury tier shows ${twFmtMoneyShort(lux!.volume as number)}`,
      );
    }
    if (twIsNum(prime?.count) && (prime!.count as number) > (lux!.count as number)) {
      issues.push("Prime holds more contracts than Luxury, which cannot happen when it sits inside it");
    }
    if (twIsNum(trophy?.count) && twIsNum(prime?.count) && (trophy!.count as number) > (prime!.count as number)) {
      issues.push("Trophy holds more contracts than Prime, which cannot happen when it sits inside it");
    }
    if (issues.length === 0) {
      return (
        <p className="tier-check tier-check--ok" role="status">
          Checked: Prime and Trophy sit inside the Luxury tier this month, and the Luxury tier matches the
          segment total of {fmtInt(totalCount)} contracts
          {twIsNum(totalVolume) ? ` and ${twFmtMoneyShort(totalVolume)}` : ""}.
        </p>
      );
    }
    return (
      <p className="tier-check tier-check--warn" role="status">
        Check flagged: {issues.join("; ")}. Figures are shown as reported by the data feed.
      </p>
    );
  }

  return (
    <p className="tier-check tier-check--warn" role="status">
      Check flagged: the segment total of {fmtInt(totalCount)} contracts does not match the Luxury tier (
      {fmtInt(lux!.count)})
      {sumCount !== null ? `, and the three tiers add to ${fmtInt(sumCount)}` : ""}. That means the feed sent
      the tiers neither as separate bands nor as nested subsets. Figures are shown as reported by the data
      feed.
    </p>
  );
}



/** Ported from this-week.tsx's buildPulseCol()/pulseRow() string-builders, translated to JSX.
 *  Renders one condo/co-op/townhouse column of the Market Pulse breakdown: 6 stat rows, each
 *  with YoY + MoM delta chips, or a "small sample" badge when the row's own count is thin. */
function renderPulseCol(title: string, row: MonthlyMarketPulseByTypeRow | null | undefined) {
  const r = row ?? null;
  const thin = !twIsNum(r?.contracts) || (r!.contracts as number) < SMALL_SAMPLE_FLOOR;
  const thinSales = !twIsNum(r?.recorded_sales) || (r!.recorded_sales as number) < SMALL_SAMPLE_FLOOR;
  const smallSampleBadge = <span className="ldr-badge ldr-badge-zero">small sample</span>;

  const pRow = (label: string, val: React.ReactNode, deltas: React.ReactNode) => (
    <div className="pulse-row" key={label}>
      <span className="pulse-row__label">{label}</span>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
        <span className="pulse-row__val">{val}</span>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end", minHeight: 19 }}>
          {deltas}
        </div>
      </div>
    </div>
  );

  const discountVal = twIsNum(r?.discount_pct)
    ? `${(r!.discount_pct as number) >= 0 ? "" : "-"}${Math.abs(r!.discount_pct as number).toFixed(2)}%`
    : <span className="stat-empty">{DASH}</span>;

  return (
    <div className="pulse-col">
      <div className="pulse-col__head">{title}</div>
      {pRow("Signed contracts", twIsNum(r?.contracts) ? fmtInt(r!.contracts) : <span className="stat-empty">No qualifying contracts</span>, thin ? smallSampleBadge : <>{twSfxPill(r?.contracts_yoy_pct, "YoY")}{twSfxPill(r?.contracts_mom_pct, "MoM")}</>)}
      {pRow("Contract volume", twIsNum(r?.contracts_volume) ? twFmtMoneyShort(r!.contracts_volume) : <span className="stat-empty">Unavailable</span>, thin ? smallSampleBadge : <>{twSfxPill(r?.contracts_volume_yoy_pct, "YoY")}{twSfxPill(r?.contracts_volume_mom_pct, "MoM")}</>)}
      {pRow("Recorded sales", twIsNum(r?.recorded_sales) ? fmtInt(r!.recorded_sales) : <span className="stat-empty">{DASH}</span>, thinSales ? smallSampleBadge : <>{twSfxPill(r?.recorded_sales_yoy_pct, "YoY")}{twSfxPill(r?.recorded_sales_mom_pct, "MoM")}</>)}
      {pRow("Avg price / sq ft", twIsNum(r?.ppsf) ? twFmtCurrencyInt(r!.ppsf) : <span className="stat-empty">{DASH}</span>, thin ? smallSampleBadge : <>{twSfxPill(r?.ppsf_yoy_pct, "YoY")}{twSfxPill(r?.ppsf_mom_pct, "MoM")}</>)}
      {pRow("Discount from ask", discountVal, thin ? smallSampleBadge : <>{twSfxPill(r?.discount_pct_yoy_pct, "YoY")}{twSfxPill(r?.discount_pct_mom_pct, "MoM")}</>)}
      {pRow("Days on market", twIsNum(r?.dom) ? String(Math.round(r!.dom as number)) : <span className="stat-empty">{DASH}</span>, thin ? smallSampleBadge : <>{twSfxPill(r?.dom_yoy_pct, "YoY")}{twSfxPill(r?.dom_mom_pct, "MoM")}</>)}
    </div>
  );
}

function vsAvg12Pct(current: number | null | undefined, avg: number | null | undefined): number | null {
  if (!twIsNum(current) || !twIsNum(avg) || avg === 0) return null;
  return ((current - avg) / avg) * 100;
}

/* ── Momentum chart: three tiers, five metrics ──────────────────────────────
 * Visual language ported from src/reports/report.html's "Three Tiers, Three
 * Metrics" cycle chart (metric-toggle row, dot legend with tier cutoff,
 * bordered card), rebuilt as a React + Chart.js component. One chart instance
 * is created on mount and its data swapped on metric change, rather than
 * destroyed and rebuilt on every toggle. Reads only p.tier_series; renders the
 * same "not available" line the old momentum table used when that is missing. */
type TierMetricKey = "count" | "volume" | "median" | "ppsf" | "dom";

const TIER_METRICS: Array<{ key: TierMetricKey; label: string; axis: string }> = [
  { key: "count", label: "Contracts", axis: "contracts" },
  { key: "volume", label: "Volume ($M)", axis: "dollar volume" },
  { key: "median", label: "Median Price", axis: "median price" },
  { key: "ppsf", label: "PPSF ($/sf)", axis: "price per square foot" },
  { key: "dom", label: "Days on Market", axis: "days on market" },
];

const TIER_LINES: Array<{ key: "luxury" | "prime" | "trophy"; name: string; color: string }> = [
  { key: "luxury", name: "Luxury (Top 10%)", color: "#98A0A8" },
  { key: "prime", name: "Prime (Top 5%)", color: "#918C7E" },
  { key: "trophy", name: "Trophy (Top 1%)", color: "#A37670" },
];

/* Faint vertical hover-guide line, matching this-week.tsx's legacy `.chart-crosshair`
 * treatment. Chart.js has no built-in equivalent, so this is a small chart-instance-scoped
 * plugin (passed via the `plugins` array on each chart's own config, not globally
 * registered) that reads the same active-element state the tooltip already uses. Shared
 * by both MomentumTierChart and MarketPulseSeriesChart below so the two charts behave
 * identically to each other and to This Week's reference implementation. */
const hoverGuideLinePlugin = {
  id: "hoverGuideLine",
  afterDraw(chart: any) {
    const active = chart.getActiveElements();
    if (!active || !active.length) return;
    const meta = chart.getDatasetMeta(active[0].datasetIndex);
    const el = meta?.data?.[active[0].index];
    if (!el) return;
    const { top, bottom } = chart.chartArea;
    const ctx = chart.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(el.x, top);
    ctx.lineTo(el.x, bottom);
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(28,26,24,.28)";
    ctx.stroke();
    ctx.restore();
  },
};

function tierMetricFmt(metric: TierMetricKey): (n: number) => string {
  if (metric === "count") return (n) => Math.round(n).toLocaleString();
  if (metric === "volume" || metric === "median") return (n) => twFmtMoneyShort(n);
  if (metric === "ppsf") return (n) => `${twFmtCurrencyInt(n)}/sf`;
  return (n) => `${Math.round(n)} days`;
}

function MomentumTierChart({
  series,
  tiers,
}: {
  series: MonthlyTierSeriesPoint[] | null | undefined;
  tiers: { luxury?: MonthlyTier; prime?: MonthlyTier; trophy?: MonthlyTier } | null | undefined;
}) {
  const [metric, setMetric] = useState<TierMetricKey>("count");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<{ data: any; options: any; update: () => void; destroy: () => void } | null>(null);

  const points = Array.isArray(series) ? series : [];
  const labels = points.map((pt) => pt.month);
  const valuesFor = (tier: "luxury" | "prime" | "trophy", m: TierMetricKey): Array<number | null> =>
    points.map((pt) => {
      const v = pt?.[tier]?.[m];
      return twIsNum(v) ? (v as number) : null;
    });

  useEffect(() => {
    if (!points.length) return;
    let disposed = false;

    (async () => {
      const { Chart, registerables } = await import("chart.js");
      if (disposed || !canvasRef.current) return;
      Chart.register(...registerables);

      const grid = "rgba(28,26,24,.06)";
      const axis = { color: "#4A4744", font: { family: "'Jost', Helvetica, Arial, sans-serif", size: 12 } };

      chartRef.current = new Chart(canvasRef.current, {
        type: "line",
        data: {
          labels,
          datasets: TIER_LINES.map((t) => ({
            label: t.name,
            data: valuesFor(t.key, metric),
            borderColor: t.color,
            backgroundColor: t.color,
            spanGaps: true,
          })),
        },
        plugins: [hoverGuideLinePlugin],
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 400 },
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              position: "nearest",
              backgroundColor: "#1C1A18",
              titleFont: { family: "'Jost', Helvetica, Arial, sans-serif", size: 12 },
              bodyFont: { family: "'Jost', Helvetica, Arial, sans-serif", size: 13 },
              padding: 10,
              // Order rows to match the visual stacking of the lines at that x position.
              itemSort: (a: any, b: any) => (b.parsed?.y ?? -Infinity) - (a.parsed?.y ?? -Infinity),
              callbacks: {
                label: (ctx: any) =>
                  `${ctx.dataset.label}: ${
                    twIsNum(ctx.parsed?.y) ? tierMetricFmt(metric)(ctx.parsed.y) : DASH
                  }`,
              },
            },
          },
          scales: {
            x: { grid: { color: grid }, ticks: { ...axis, maxRotation: 0, autoSkipPadding: 18 } },
            y: {
              grid: { color: grid },
              ticks: { ...axis, callback: (v: any) => tierMetricFmt(metric)(Number(v)) },
              beginAtZero: false,
            },
          },
          elements: {
            point: {
              radius: 3.5,
              hoverRadius: 5.5,
              hitRadius: 12,
              borderWidth: 1.5,
              borderColor: "#FFFDF9",
            },
            line: { borderWidth: 2, tension: 0.25 },
          },
        },
      }) as unknown as { data: any; options: any; update: () => void; destroy: () => void };
    })();

    return () => {
      disposed = true;
      chartRef.current?.destroy();
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series]);

  useEffect(() => {
    const c = chartRef.current;
    if (!c) return;
    c.data.labels = labels;
    c.data.datasets.forEach((ds: any, i: number) => {
      ds.data = valuesFor(TIER_LINES[i].key, metric);
    });
    const fmt = tierMetricFmt(metric);
    c.options.scales.y.ticks.callback = (v: any) => fmt(Number(v));
    c.options.plugins.tooltip.callbacks.label = (ctx: any) =>
      `${ctx.dataset.label}: ${twIsNum(ctx.parsed?.y) ? fmt(ctx.parsed.y) : DASH}`;
    c.update();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metric, series]);

  if (!points.length) {
    return <p className="m-p">Momentum figures are not available for this month.</p>;
  }

  const active = TIER_METRICS.find((m) => m.key === metric)!;
  const rangeLabel = `${labels[0]}\u2013${labels[labels.length - 1]}`;
  const descId = `m-cycle-desc-${metric}`;
  const descHtml =
    srSummary(
      descId,
      describeSeries(
        `Line chart of monthly ${active.axis} by luxury tier`,
        labels,
        TIER_LINES.map((t) => ({ name: t.name, values: valuesFor(t.key, metric), fmt: tierMetricFmt(metric) })),
      ),
    ) +
    srTable(
      `Monthly ${active.axis} by luxury tier`,
      ["Month", ...TIER_LINES.map((t) => t.name)],
      zipSeries(labels, TIER_LINES.map((t) => valuesFor(t.key, metric))),
    );

  return (
    <div className="m-cycle">
      <div className="m-cycle-title">Three Tiers, Five Metrics &middot; {rangeLabel}</div>
      <div className="m-cycle-toggle" role="group" aria-label="Choose a metric to chart">
        {TIER_METRICS.map((m) => (
          <button
            key={m.key}
            type="button"
            className={m.key === metric ? "is-active" : undefined}
            aria-pressed={m.key === metric}
            onClick={() => setMetric(m.key)}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p className="m-cycle-hint">Choose a metric to redraw the chart. Hover a point for the exact reading.</p>
      <div className="m-cycle-chart">
        <div className="m-cycle-legend">
          {TIER_LINES.map((t) => (
            <span key={t.key}>
              <i style={{ background: t.color }} aria-hidden="true" />
              {t.name}
              <em>{twFmtMoneyM(tiers?.[t.key]?.cutoff ?? null)}</em>
            </span>
          ))}
        </div>
        <div className="m-cycle-canvas">
          <canvas
            ref={canvasRef}
            role="img"
            aria-describedby={descId}
            aria-label={`Monthly ${active.axis} by luxury tier, ${rangeLabel}`}
          />
        </div>
      </div>
      <div dangerouslySetInnerHTML={{ __html: descHtml }} />
    </div>
  );
}

/* ── Market Pulse history chart: four segments, six metrics ────────────────
 * Same visual language and architecture as MomentumTierChart above (metric-
 * toggle row, dot legend, one Chart.js instance created on mount with data
 * swapped on toggle rather than destroyed/rebuilt). Reads only
 * p.market_pulse_series; renders the same "not available" line when that's
 * missing. "All Manhattan" only carries Signed Contracts / Contract Volume
 * (the source endpoint has no recorded-sales/ppsf/discount/dom breakdown at
 * the all-Manhattan level) — its line is simply absent on the other four
 * metrics, not a gap or an error. */
type PulseMetricKey = "contracts" | "volume" | "recorded_sales" | "ppsf" | "discount_pct" | "dom";

const PULSE_METRICS: Array<{ key: PulseMetricKey; label: string; axis: string }> = [
  { key: "contracts", label: "Signed Contracts", axis: "signed contracts" },
  { key: "volume", label: "Contract Volume", axis: "contract dollar volume" },
  { key: "recorded_sales", label: "Recorded Sales", axis: "recorded sales" },
  { key: "ppsf", label: "Avg $ / sq ft", axis: "average price per square foot" },
  { key: "discount_pct", label: "Discount from Ask", axis: "discount from ask" },
  { key: "dom", label: "Days on Market", axis: "days on market" },
];

const PULSE_LINES: Array<{ key: "all" | "condo" | "coop" | "townhouse"; name: string; color: string }> = [
  { key: "all", name: "All Manhattan", color: "#4A4744" },
  { key: "condo", name: "Condos", color: "#98A0A8" },
  { key: "coop", name: "Co-ops", color: "#918C7E" },
  { key: "townhouse", name: "Townhouses", color: "#A37670" },
];

function pulseMetricFmt(metric: PulseMetricKey): (n: number) => string {
  if (metric === "contracts" || metric === "recorded_sales") return (n) => Math.round(n).toLocaleString();
  if (metric === "volume") return (n) => twFmtMoneyShort(n);
  if (metric === "ppsf") return (n) => `${twFmtCurrencyInt(n)}/sf`;
  if (metric === "discount_pct") return (n) => `${n >= 0 ? "" : "-"}${Math.abs(n).toFixed(1)}%`;
  return (n) => `${Math.round(n)} days`;
}

function pulseValueFor(
  pt: MonthlyMarketPulseSeriesPoint,
  line: "all" | "condo" | "coop" | "townhouse",
  metric: PulseMetricKey,
): number | null {
  if (line === "all") {
    if (metric === "contracts") return twIsNum(pt.all?.contracts) ? (pt.all!.contracts as number) : null;
    if (metric === "volume") return twIsNum(pt.all?.volume) ? (pt.all!.volume as number) : null;
    return null;
  }
  const row = pt[line];
  if (!row) return null;
  const v = metric === "volume" ? row.contracts_volume : row[metric];
  return twIsNum(v) ? (v as number) : null;
}

function MarketPulseSeriesChart({ series }: { series: MonthlyMarketPulseSeriesPoint[] | null | undefined }) {
  const [metric, setMetric] = useState<PulseMetricKey>("contracts");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<{ data: any; options: any; update: () => void; destroy: () => void } | null>(null);

  const points = Array.isArray(series) ? series : [];
  const labels = points.map((pt) => pt.month);
  const valuesFor = (line: "all" | "condo" | "coop" | "townhouse", m: PulseMetricKey): Array<number | null> =>
    points.map((pt) => pulseValueFor(pt, line, m));

  useEffect(() => {
    if (!points.length) return;
    let disposed = false;

    (async () => {
      const { Chart, registerables } = await import("chart.js");
      if (disposed || !canvasRef.current) return;
      Chart.register(...registerables);

      const grid = "rgba(28,26,24,.06)";
      const axis = { color: "#4A4744", font: { family: "'Jost', Helvetica, Arial, sans-serif", size: 12 } };

      chartRef.current = new Chart(canvasRef.current, {
        type: "line",
        data: {
          labels,
          datasets: PULSE_LINES.map((l) => ({
            label: l.name,
            data: valuesFor(l.key, metric),
            borderColor: l.color,
            backgroundColor: l.color,
            spanGaps: true,
          })),
        },
        plugins: [hoverGuideLinePlugin],
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 400 },
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              position: "nearest",
              backgroundColor: "#1C1A18",
              titleFont: { family: "'Jost', Helvetica, Arial, sans-serif", size: 12 },
              bodyFont: { family: "'Jost', Helvetica, Arial, sans-serif", size: 13 },
              padding: 10,
              itemSort: (a: any, b: any) => (b.parsed?.y ?? -Infinity) - (a.parsed?.y ?? -Infinity),
              callbacks: {
                label: (ctx: any) =>
                  `${ctx.dataset.label}: ${
                    twIsNum(ctx.parsed?.y) ? pulseMetricFmt(metric)(ctx.parsed.y) : DASH
                  }`,
              },
            },
          },
          scales: {
            x: { grid: { color: grid }, ticks: { ...axis, maxRotation: 0, autoSkipPadding: 18 } },
            y: {
              grid: { color: grid },
              ticks: { ...axis, callback: (v: any) => pulseMetricFmt(metric)(Number(v)) },
              beginAtZero: false,
            },
          },
          elements: {
            point: { radius: 3.5, hoverRadius: 5.5, hitRadius: 12, borderWidth: 1.5, borderColor: "#FFFDF9" },
            line: { borderWidth: 2, tension: 0.25 },
          },
        },
      }) as unknown as { data: any; options: any; update: () => void; destroy: () => void };
    })();

    return () => {
      disposed = true;
      chartRef.current?.destroy();
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series]);

  useEffect(() => {
    const c = chartRef.current;
    if (!c) return;
    c.data.labels = labels;
    c.data.datasets.forEach((ds: any, i: number) => {
      ds.data = valuesFor(PULSE_LINES[i].key, metric);
    });
    const fmt = pulseMetricFmt(metric);
    c.options.scales.y.ticks.callback = (v: any) => fmt(Number(v));
    c.options.plugins.tooltip.callbacks.label = (ctx: any) =>
      `${ctx.dataset.label}: ${twIsNum(ctx.parsed?.y) ? fmt(ctx.parsed.y) : DASH}`;
    c.update();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metric, series]);

  if (!points.length) {
    return <p className="m-p">Market Pulse history is not available for this month.</p>;
  }

  const active = PULSE_METRICS.find((m) => m.key === metric)!;
  const rangeLabel = `${labels[0]}–${labels[labels.length - 1]}`;
  const descId = `m-pulse-cycle-desc-${metric}`;
  const descHtml =
    srSummary(
      descId,
      describeSeries(
        `Line chart of monthly ${active.axis} by segment`,
        labels,
        PULSE_LINES.map((l) => ({ name: l.name, values: valuesFor(l.key, metric), fmt: pulseMetricFmt(metric) })),
      ),
    ) +
    srTable(
      `Monthly ${active.axis} by segment`,
      ["Month", ...PULSE_LINES.map((l) => l.name)],
      zipSeries(labels, PULSE_LINES.map((l) => valuesFor(l.key, metric))),
    );

  return (
    <div className="m-cycle">
      <div className="m-cycle-title">Four Segments, Six Metrics &middot; {rangeLabel}</div>
      <div className="m-cycle-toggle" role="group" aria-label="Choose a Market Pulse metric to chart">
        {PULSE_METRICS.map((m) => (
          <button
            key={m.key}
            type="button"
            className={m.key === metric ? "is-active" : undefined}
            aria-pressed={m.key === metric}
            onClick={() => setMetric(m.key)}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p className="m-cycle-hint">Choose a metric to redraw the chart. Hover a point for the exact reading.</p>
      <div className="m-cycle-chart">
        <div className="m-cycle-legend">
          {PULSE_LINES.map((l) => (
            <span key={l.key}>
              <i style={{ background: l.color }} aria-hidden="true" />
              {l.name}
            </span>
          ))}
        </div>
        <div className="m-cycle-canvas">
          <canvas
            ref={canvasRef}
            role="img"
            aria-describedby={descId}
            aria-label={`Monthly ${active.axis} by segment, ${rangeLabel}`}
          />
        </div>
      </div>
      <div dangerouslySetInnerHTML={{ __html: descHtml }} />
    </div>
  );
}

export function MonthlyBody({ row }: { row: MonthlyReportRow }) {
  const p = row.payload;
  const monthLabel = fmtMonthLong(row.month_start);
  const scopeRef = useRef<HTMLElement | null>(null);
  const volDonutRef = useRef<HTMLCanvasElement | null>(null);
  const cntDonutRef = useRef<HTMLCanvasElement | null>(null);


  useEffect(() => {
    try {
      // eslint-disable-next-line no-new-func
      new Function(
        buildQrDesignScript({
          scopeSelector: ".monthly-scope",
          wmSel: ".m-chart__c canvas, .cv-table",
          revealSel: ".m-section, .m-glance, .m-box, .cv-wrap, .m-chart, .data-key, .tier-col, .top-deal-row",
        }),
      )();
    } catch (e) {
      console.error("QR design script error:", e);
    }
  }, []);

  const g = p.glance;
  const n = p.narrative ?? {};

  const bm = p.bedroom_mix;
  const bedroomOrder = ["studio", "1", "2", "3", "4+"];
  const bedroomLabels: Record<string, string> = { studio: "Studio", "1": "1-Bed", "2": "2-Bed", "3": "3-Bed", "4+": "4+ Beds" };
  const hasVol = !!bm && !!bm.volume && Object.values(bm.volume).some((v) => twIsNum(v) && v > 0);
  const hasCount = !!bm && !!bm.count && Object.values(bm.count).some((v) => twIsNum(v) && v > 0);
  const volumeData: DonutSlice[] = bedroomOrder
    .map((k) => ({ label: bedroomLabels[k], value: Number(bm?.volume?.[k] ?? 0) }))
    .filter((d) => d.value > 0)
    .map((d) => ({ ...d, fmt: twFmtMoneyShort(d.value) }));
  const countData: DonutSlice[] = bedroomOrder
    .map((k) => ({ label: bedroomLabels[k], value: Number(bm?.count?.[k] ?? 0) }))
    .filter((d) => d.value > 0)
    .map((d) => ({ ...d, fmt: String(Math.round(d.value)) }));
  const volumeTotal = volumeData.reduce((s, d) => s + d.value, 0);
  const countTotal = countData.reduce((s, d) => s + d.value, 0);
  const volDonutCenter = volumeTotal > 0 ? twFmtMoneyShort(volumeTotal) : DASH;
  const cntDonutCenter = countTotal > 0 ? String(countTotal) : DASH;

  useEffect(() => {
    drawDonut(volDonutRef.current, volumeData, volDonutCenter);
    drawDonut(cntDonutRef.current, countData, cntDonutCenter);
  }, [volumeData, countData, volDonutCenter, cntDonutCenter]);

  const tierBoxes: Array<{ key: "luxury" | "prime" | "trophy"; label: string; t: MonthlyTier | undefined }> = [
    { key: "luxury", label: "Luxury (Top 10%)", t: p.tiers?.luxury },
    { key: "prime", label: "Prime (Top 5%)", t: p.tiers?.prime },
    { key: "trophy", label: "Trophy (Top 1%)", t: p.tiers?.trophy },
  ];


  return (
    <div className="site">
      <SiteHeader />
      <style dangerouslySetInnerHTML={{ __html: MONTHLY_CSS + QR_DESIGN_CSS }} />
      <div dangerouslySetInnerHTML={{ __html: QR_MONOGRAM_SVG }} />

      <main id="main-content" className="monthly-scope" ref={scopeRef as React.RefObject<HTMLElement>}>
        {/* masthead */}
        <header className="tw-masthead tw-masthead--photo">
          <img className="tw-masthead__bg" src={MONTH_HERO.url} alt={MONTH_HERO.caption} />

          <div>
            <div className="tw-masthead__brand">Domi Data&trade; Luxury Lines</div>
            <div className="tw-masthead__edition">NYRAC Edition</div>
            <h1 className="tw-masthead__title">Manhattan Luxury:<br />The Month <span style={{ color: "var(--text-dim)", fontWeight: 400 }}>&middot; {monthLabel}</span></h1>
          </div>
          <div className="tw-masthead__meta">Updates monthly after month close</div>
        </header>

        {/* toc */}
        <nav className="m-toc" aria-label="Report sections">
          <ul>
            <li><a href="#part-1">1 &middot; The Month in One Read</a></li>
            <li><a href="#top-deals">2 &middot; Top Deals of the Month</a></li>
            <li><a href="#part-2">3 &middot; Momentum</a></li>
            <li><a href="#luxury-lines">4 &middot; The Luxury Lines</a></li>
            <li><a href="#market-pulse">5 &middot; Manhattan Market Pulse</a></li>
            <li><a href="#unit-breakdown">6 &middot; Unit Breakdown</a></li>
            <li><a href="#part-3">7 &middot; Supply and Absorption</a></li>
            <li><a href="#part-4">8 &middot; Neighborhoods</a></li>
            <li><a href="#part-5">9 &middot; What This Means</a></li>
            <li><a href="#footnotes">Method and Notes</a></li>
          </ul>
        </nav>


        <p className="m-doc-orient">
          This report reads one month of Manhattan luxury signed-contract activity against its own recent history. The Week tracks the latest deals. The Quarter sets the longer trend. This page shows whether that trend is starting to shift.
        </p>

        {/* part 1 */}
        <section className="m-section" id="part-1" aria-labelledby="part-1-h">
          {n.part1_quote ? (
            <blockquote className="m-quote">
              {n.part1_quote}
              <cite>Heather Domi</cite>
            </blockquote>
          ) : null}
          <div className="sec-label">Part 1</div>
          <h2 className="m-h2" id="part-1-h">The Month in One Read</h2>

          {/* ── hero tier boxes, rebuilt to match the Quarterly Report's real .hero-grid
               (src/reports/quarterly-brief.html), per explicit owner direction to use the
               Quarterly (not This Week) as the reference model for this section only ── */}
          <div className="hero-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
            {tierBoxes.map((b) => (
              <div key={b.key} className="hero-cell">
                <div className={`hero-tier ${HERO_TIER_PCLASS[b.key]}`}>{b.label}</div>
                <div className={`hero-floor ${HERO_TIER_PCLASS[b.key]}`}>
                  {twFmtMoneyM(b.t?.cutoff ?? null)}+
                  <span className="hero-floor-lbl">Benchmark floor</span>
                </div>
                <div className="hero-num" style={{ color: HERO_TIER_HEX[b.key] }}>
                  {fmtInt(b.t?.count ?? null)}
                </div>
                <div className="hero-sub">Contracts &middot; {monthLabel}</div>
                <div className="hero-num" style={{ color: HERO_TIER_HEX[b.key], margin: "10px 0 2px" }}>
                  {twFmtMoneyShort(b.t?.volume ?? null)}
                </div>
                <div className="hero-sub">Dollar Volume &middot; {monthLabel}</div>
              </div>
            ))}

            {/* ── 4th full-width hero cell, matching quarterly-brief.html where the Top 10
                 Neighborhoods concentration summary is a .hero-cell with grid-column:1/-1
                 nested inside the same .hero-grid box. Null-safe via fmtPct / fmtMoneyM /
                 fmtInt, which already render an em dash for null/undefined. ── */}
            <div className="hero-cell m-top10-concentration" style={{ gridColumn: "1 / -1" }}>
              <div className="m-top10-concentration__title">Top 10 Neighborhoods &middot; {monthLabel}</div>
              <div className="m-top10-concentration__stats">
                <div>
                  <div className="m-top10-concentration__val">{fmtPct(p.top10_concentration?.pct_of_luxury_volume)}</div>
                  <div className="m-top10-concentration__cap">of {monthLabel} Luxury dollar volume</div>
                </div>
                <div>
                  <div className="m-top10-concentration__val">{fmtMoneyM(p.top10_concentration?.volume)}</div>
                  <div className="m-top10-concentration__cap">Luxury dollar volume in the top 10 neighborhoods</div>
                </div>
                <div>
                  <div className="m-top10-concentration__val">{fmtInt(p.top10_concentration?.contracts)}</div>
                  <div className="m-top10-concentration__cap">Luxury contracts signed in the top 10 neighborhoods</div>
                </div>
              </div>
            </div>
            <div className="hero-cell m-top10-concentration" style={{ gridColumn: "1 / -1" }}>
              <div className="m-top10-concentration__title">Manhattan Market Snapshot &middot; {monthLabel}</div>
              <div className="m-top10-concentration__stats">
                <div>
                  <div className="m-top10-concentration__val">
                    {twIsNum(g?.median_price) ? twFmtMoneyM(g.median_price) : <span className="stat-empty">{DASH}</span>}
                  </div>
                  <div className="m-top10-concentration__cap">Median luxury deal price (Top 10%)</div>
                </div>
                <div>
                  <div className="m-top10-concentration__val">
                    {twIsNum(g?.median_ppsf) ? twFmtCurrencyInt(g.median_ppsf) : <span className="stat-empty">{DASH}</span>}
                  </div>
                  <div className="m-top10-concentration__cap">Median price per sq ft (Top 10%)</div>
                </div>
                <div>
                  <div className="m-top10-concentration__val">
                    {twIsNum(g?.avg_dom) ? Math.round(g.avg_dom) : <span className="stat-empty">{DASH}</span>}
                  </div>
                  <div className="m-top10-concentration__cap">Avg days on market (Top 10%)</div>
                </div>
              </div>
            </div>
          </div>

          <p className="m-p" style={{ marginTop: 18, fontSize: 14 }}>
            Cutoffs are the price a contract must clear to sit in each tier. They are recalculated
            from the trailing record, so a rising cutoff means the whole field moved up, not that any
            single deal did.
          </p>
        </section>

        {/* ── new section, ported verbatim from this-week.tsx: Top Deals ── */}
        <section className="m-section" id="top-deals" aria-labelledby="top-deals-h">
          <div className="section__eyebrow">This Month's Headliners &middot; {monthLabel}</div>
          <h2 className="section__title" id="top-deals-h">Top Deals of the Month</h2>
          <p className="section__note"><strong>The month's highest signed-contract prices across Manhattan.</strong></p>
          <div className="top-deals">
            <div className="top-deals__head">
              <div>Address</div><div>SF</div><div>$ / SF</div><div>DOM</div><div>Type</div><div>Neighborhood</div><div>Price</div>
            </div>
            {p.top_deals && p.top_deals.length > 0 ? (
              <div className="top-deals__list">
                {p.top_deals.slice(0, 5).map((d, i) => (
                  <div className="top-deal-row" key={`${d.address}-${i}`}>
                    <div className="top-deal-row__address">{d.address}</div>
                    <div className="top-deal-row__sf">{twIsNum(d.sf) ? `${fmtInt(d.sf)} sf` : DASH}</div>
                    <div className="top-deal-row__ppsf">{twIsNum(d.ppsf) ? `$${fmtInt(d.ppsf)}/sf` : DASH}</div>
                    <div className="top-deal-row__dom">{twIsNum(d.dom) ? `${d.dom}d` : DASH}</div>
                    <div className="top-deal-row__type">{d.property_type ?? DASH}</div>
                    <div className="top-deal-row__hood">{d.neighborhood}</div>
                    <div className="top-deal-row__price">{twFmtMoneyM(d.price)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="top-deals--empty">No qualifying deals this month.</div>
            )}
          </div>
        </section>

        {/* part 2 */}
        <section className="m-section" id="part-2" aria-labelledby="part-2-h">
          {n.part2_lede ? <p className="m-lede">{n.part2_lede}</p> : null}
          <div className="sec-label">Part 2</div>
          <h2 className="m-h2" id="part-2-h">Momentum</h2>
          <p className="m-p">
            Each measure below is plotted for the last thirteen months. A reading holding above its own
            recent months is acceleration. A reading falling back toward or below them is a bounce inside
            a slower stretch.
          </p>

          <div className="section__eyebrow" style={{ marginTop: 28 }}>Momentum, Charted &middot; 13 Months</div>
          <h2 className="m-h2">Three tiers, five ways to read them.</h2>
          <MomentumTierChart series={p.tier_series} tiers={p.tiers} />
        </section>

        {/* ── new section, ported verbatim from this-week.tsx: The Luxury Lines ── */}
        <section className="m-section" id="luxury-lines" aria-labelledby="luxury-lines-h">
          <div className="section__eyebrow">Market Structure &middot; {monthLabel}</div>
          <h2 className="section__title" id="luxury-lines-h">The Luxury Lines</h2>
          <p className="section__note" style={{ maxWidth: "none" }}>
            Three tiers defined by the trailing 12 months (TTM) of actual Manhattan signed contracts. Entry
            prices update monthly as new data enters the window.
          </p>
          <div className="tier-total">
            <div className="tier-total__label">
              <span className="tier-total__head">
                Luxury segment total &middot; {monthLabel}
                <span
                  className="tier-total__chip"
                  tabIndex={0}
                  role="note"
                  aria-label={`What counts: every Manhattan signed contract at or above the Luxury entry price${
                    twIsNum(p.tiers?.luxury?.cutoff) ? ` of ${fmtMoney(p.tiers!.luxury!.cutoff)}` : ""
                  }, the Top 10% line set by the trailing 12 months of signed contracts. ${
                    tierShape(p.glance?.luxury_count ?? null, p.tiers) === "bands"
                      ? "The three tiers below split that total into separate price bands, so they add up to it."
                      : "Prime and Trophy contracts are included in the total, so the three tiers below are not additive."
                  }`}
                  title={`Every Manhattan signed contract at or above the Luxury entry price${
                    twIsNum(p.tiers?.luxury?.cutoff) ? ` of ${fmtMoney(p.tiers!.luxury!.cutoff)}` : ""
                  } (the Top 10% line, set by the trailing 12 months of signed contracts). ${
                    tierShape(p.glance?.luxury_count ?? null, p.tiers) === "bands"
                      ? "The three tiers below split that total into separate price bands, so they add up to it."
                      : "Prime and Trophy sit inside this total, so the three tiers below are not additive."
                  }`}
                >
                  What counts
                </span>
              </span>
              <span className="tier-total__sub">
                Every contract at or above the Top 10% line
                {twIsNum(p.tiers?.luxury?.cutoff) ? `, currently ${fmtMoney(p.tiers!.luxury!.cutoff)}` : ""}.{" "}
                {tierShape(p.glance?.luxury_count ?? null, p.tiers) === "bands"
                  ? "The three tiers below split this total into separate price bands: Luxury, then Prime, then Trophy. They add up to it."
                  : "Prime and Trophy are counted inside this total, not added to it."}
              </span>

            </div>

            <div className="tier-total__figs">
              <div className="tier-total__fig">
                <div className="tier-total__num">
                  {twIsNum(p.glance?.luxury_count) ? fmtInt(p.glance.luxury_count) : <span className="stat-empty">{DASH}</span>}
                </div>
                <div className="tier-total__cap">Contracts</div>
                <div className="tier-total__pills">
                  {twSfxPill(p.glance?.luxury_count_yoy_pct, "YoY")}
                  {twSfxPill(p.glance?.luxury_count_mom_pct, "MoM")}
                </div>
              </div>
              <div className="tier-total__fig">
                <div className="tier-total__num">
                  {twIsNum(p.glance?.luxury_volume) ? twFmtMoneyShort(p.glance.luxury_volume) : <span className="stat-empty">{DASH}</span>}
                </div>
                <div className="tier-total__cap">Dollar volume</div>
                <div className="tier-total__pills">
                  {twSfxPill(p.glance?.luxury_volume_yoy_pct, "YoY")}
                  {twSfxPill(p.glance?.luxury_volume_mom_pct, "MoM")}
                </div>
              </div>
            </div>
          </div>
          <div className="tier-grid">

            {renderTierCol("luxury", "Luxury", "Top 10%", "#98A0A8", p.tiers?.luxury)}
            <div className="tier-divider" />
            {renderTierCol("prime", "Prime", "Top 5%", "#918C7E", p.tiers?.prime)}
            <div className="tier-divider" />
            {renderTierCol("trophy", "Trophy", "Top 1%", "#A37670", p.tiers?.trophy)}
          </div>
          <TierTotalCheck
            totalCount={p.glance?.luxury_count ?? null}
            totalVolume={p.glance?.luxury_volume ?? null}
            tiers={p.tiers}
          />

        </section>

        {/* ── new section, ported verbatim from this-week.tsx: Market Pulse header + badge, now with the full all-Manhattan + by-type breakdown ── */}
        <section className="m-section" id="market-pulse" aria-labelledby="market-pulse-h">
          <div className="section__eyebrow">Full Market &middot; {monthLabel}</div>
          <h2 className="section__title" id="market-pulse-h">Manhattan Market Pulse</h2>
          {p.market_read ? (
            <div id="month-read-badge" className={`week-read week-read--${p.market_read.class}`}>
              {p.market_read.badge}
            </div>
          ) : (
            <div className="week-read week-read--normal">Normal</div>
          )}

          {(() => {
            const mp = p.market_pulse?.all ?? null;
            const mpCountVsAvg = vsAvg12Pct(mp?.contracts, mp?.contracts_avg12);
            const mpVolVsAvg = vsAvg12Pct(mp?.volume, mp?.volume_avg12);
            return (
              <div className="pulse-block">
                <div className="pulse-summary">
                  <div className="pulse-summary__metric">
                    <div className="pulse-summary__num">
                      {twIsNum(mp?.contracts) ? fmtInt(mp!.contracts) : <span className="stat-empty">{DASH}</span>}
                    </div>
                    <div className="pulse-summary__label">Signed Contracts &middot; All Manhattan Residential</div>
                    {twIsNum(mp?.contracts_mom_pct) || twIsNum(mp?.contracts_yoy_pct) ? (
                      <>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                          {twSfxPill(mp?.contracts_yoy_pct, "YoY")}
                          {twSfxPill(mp?.contracts_mom_pct, "MoM")}
                        </div>
                        <div style={{ fontSize: 13.5, color: "var(--text-dim)" }}>
                          {twIsNum(mpCountVsAvg) ? `${mpCountVsAvg! >= 0 ? "+" : ""}${mpCountVsAvg!.toFixed(0)}% vs 12-month avg · ${fmtInt(mp?.contracts_avg12)} contracts/month` : ""}
                        </div>
                      </>
                    ) : (
                      <div className="pulse-summary__vs flat"><span className="stat-empty">Baseline unavailable</span></div>
                    )}
                  </div>
                  <div className="pulse-summary__metric">
                    <div className="pulse-summary__num">
                      {twIsNum(mp?.volume) ? twFmtMoneyShort(mp!.volume) : <span className="stat-empty">{DASH}</span>}
                    </div>
                    <div className="pulse-summary__label">Total Dollar Volume &middot; All Manhattan</div>
                    {twIsNum(mp?.volume_mom_pct) || twIsNum(mp?.volume_yoy_pct) ? (
                      <>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                          {twSfxPill(mp?.volume_yoy_pct, "YoY")}
                          {twSfxPill(mp?.volume_mom_pct, "MoM")}
                        </div>
                        <div style={{ fontSize: 13.5, color: "var(--text-dim)" }}>
                          {twIsNum(mpVolVsAvg) ? `${mpVolVsAvg! >= 0 ? "+" : ""}${mpVolVsAvg!.toFixed(0)}% vs 12-month avg · ${twFmtMoneyShort(mp?.volume_avg12)}/month` : ""}
                        </div>
                      </>
                    ) : (
                      <div className="pulse-summary__vs flat"><span className="stat-empty">Baseline unavailable</span></div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="pulse-grid">
            {renderPulseCol("Condos", p.market_pulse?.by_type?.condo)}
            {renderPulseCol("Co-ops", p.market_pulse?.by_type?.coop)}
            {renderPulseCol("Townhouses", p.market_pulse?.by_type?.townhouse)}
          </div>

          <div className="section__eyebrow" style={{ marginTop: 28 }}>Market Pulse, Charted &middot; 13 Months</div>
          <h2 className="m-h2">Four segments, six ways to read them.</h2>
          <MarketPulseSeriesChart series={p.market_pulse_series} />
        </section>

        {/* ── new section, ported verbatim from this-week.tsx: Unit Breakdown donut charts ── */}
        <section className="m-section" id="unit-breakdown" aria-labelledby="unit-breakdown-h">
          <div className="section__eyebrow">Unit Breakdown &middot; {monthLabel}</div>
          <h2 className="section__title" id="unit-breakdown-h">Contracts and Volume by Unit Size</h2>
          <p className="section__note" style={{ maxWidth: "none" }}>
            Where activity concentrates this month: by bedroom count, both by number of deals and total dollar volume.
          </p>
          {!hasVol && !hasCount ? (
            <p className="m-p"><span className="stat-empty">Bedroom mix not available for this month.</span></p>
          ) : (
            <div className="donut-grid">
              <div className="donut-wrap">
                <div className="donut-title">Dollar volume</div>
                {hasVol ? (
                  <>
                    <div className="donut-canvas-wrap">
                      <canvas
                        ref={volDonutRef}
                        width={360}
                        height={360}
                        role="img"
                        aria-label="Dollar volume by unit size"
                        aria-describedby="m-donut-volume-desc"
                      />
                    </div>
                    <span
                      id="m-donut-volume-desc"
                      dangerouslySetInnerHTML={{
                        __html: srSummary(
                          "m-donut-volume-desc",
                          describeParts(
                            "Donut chart of dollar volume by unit size",
                            bedroomOrder.map((k) => ({ label: bedroomLabels[k], value: Number(bm?.volume?.[k] ?? 0) })).filter((d) => d.value > 0),
                            (n) => twFmtMoneyShort(n),
                          ),
                        ),
                      }}
                    />
                    <span
                      dangerouslySetInnerHTML={{
                        __html: srTable(
                          "Dollar volume by unit size",
                          ["Unit size", "Dollar volume"],
                          bedroomOrder.map((k) => [bedroomLabels[k], Number(bm?.volume?.[k] ?? 0)] as [string, number]).filter((r) => r[1] > 0),
                        ),
                      }}
                    />
                  </>
                ) : (
                  <p className="m-p"><span className="stat-empty">Not available for this month.</span></p>
                )}
              </div>
              <div className="donut-wrap">
                <div className="donut-title">Contracts signed</div>
                {hasCount ? (
                  <>
                    <div className="donut-canvas-wrap">
                      <canvas
                        ref={cntDonutRef}
                        width={360}
                        height={360}
                        role="img"
                        aria-label="Contracts by unit size"
                        aria-describedby="m-donut-count-desc"
                      />
                    </div>
                    <span
                      id="m-donut-count-desc"
                      dangerouslySetInnerHTML={{
                        __html: srSummary(
                          "m-donut-count-desc",
                          describeParts(
                            "Donut chart of contracts signed by unit size",
                            bedroomOrder.map((k) => ({ label: bedroomLabels[k], value: Number(bm?.count?.[k] ?? 0) })).filter((d) => d.value > 0),
                          ),
                        ),
                      }}
                    />
                    <span
                      dangerouslySetInnerHTML={{
                        __html: srTable(
                          "Contracts signed by unit size",
                          ["Unit size", "Contracts"],
                          bedroomOrder.map((k) => [bedroomLabels[k], Number(bm?.count?.[k] ?? 0)] as [string, number]).filter((r) => r[1] > 0),
                        ),
                      }}
                    />
                  </>
                ) : (
                  <p className="m-p"><span className="stat-empty">Not available for this month.</span></p>
                )}
              </div>
            </div>
          )}
        </section>

        {/* part 3 */}
        <section className="m-section" id="part-3" aria-labelledby="part-3-h">
          {n.part3_lede ? <p className="m-lede">{n.part3_lede}</p> : null}
          <div className="sec-label">Part 3</div>
          <h2 className="m-h2" id="part-3-h">Supply and Absorption</h2>
          {n.part3_callout ? <div className="m-callout">{n.part3_callout}</div> : null}
          <p className="m-p">
            Months of supply is the count of active listings divided by the monthly contract pace. It
            answers how long the current inventory would last if demand held steady. Absorption is the
            share of that inventory that went to contract during the month.
          </p>

          {(() => {
            const rows = p.supply ?? [];
            const lux = rows.find((r) => /lux/i.test(r.segment)) ?? null;
            const all =
              rows.find((r) => /^all\b|all manhattan|manhattan resid|market wide|marketwide/i.test(r.segment)) ??
              rows.find((r) => r !== lux) ??
              null;
            if (!lux && !all) return null;
            const half = (r: typeof lux, head: string, note: boolean) =>
              r ? (
                <div className="supply-half">
                  <div className="supply-half__head">{head}</div>
                  <div className="supply-strip">
                    <div className="supply-stat">
                      <div className="supply-stat__label">Active listings</div>
                      <div className="supply-stat__val">{fmtInt(r.inventory)}</div>
                    </div>
                    <div className="supply-stat">
                      <div className="supply-stat__label">Months of supply</div>
                      <div className="supply-stat__val">
                        {r.months_supply === null || r.months_supply === undefined ? DASH : r.months_supply.toFixed(1)}
                      </div>
                      {note ? <div className="supply-stat__context">Above 9 months = buyer's market</div> : null}
                    </div>
                    <div className="supply-stat">
                      <div className="supply-stat__label">Monthly absorption</div>
                      <div className="supply-stat__val">{fmtPct(r.absorption_pct)}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="supply-half">
                  <div className="supply-half__head">{head}</div>
                  <p className="m-p"><span className="stat-empty">Not available for this month.</span></p>
                </div>
              );
            return (
              <div className="supply-dual">
                {half(lux, "Luxury market", true)}
                <div className="supply-divider" />
                {half(all, "All Manhattan residential", false)}
              </div>
            );
          })()}


          {p.supply?.length ? (
            <div className="cv-wrap">
              <table className="cv-table">
                <caption>Inventory, contracts, and absorption by segment</caption>
                <thead>
                  <tr>
                    <th scope="col">Segment</th>
                    <th scope="col">Active listings</th>
                    <th scope="col">Contracts signed</th>
                    <th scope="col">Months of supply</th>
                    <th scope="col">Absorption</th>
                  </tr>
                </thead>
                <tbody>
                  {p.supply.map((r) => (
                    <tr key={r.segment}>
                      <th scope="row">{r.segment}</th>
                      <td>{fmtInt(r.inventory)}</td>
                      <td>{fmtInt(r.contracts)}</td>
                      <td>{r.months_supply === null || r.months_supply === undefined ? DASH : r.months_supply.toFixed(1)}</td>
                      <td>{fmtPct(r.absorption_pct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="m-p">Supply figures are not available for this month.</p>
          )}
        </section>

        {/* part 4 */}
        <section className="m-section" id="part-4" aria-labelledby="part-4-h">
          {n.part4_lede ? <p className="m-lede">{n.part4_lede}</p> : null}
          <div className="sec-label">Part 4</div>
          <h2 className="m-h2" id="part-4-h">Neighborhoods</h2>
          <p className="m-p">
            Three views of the same neighborhood data. Largest Luxury Markets ranks by trailing 12-month
            (TTM) dollar volume. Most Concentrated ranks by trailing 12-month (TTM) luxury share among neighborhoods with
            at least 11 qualifying contracts. {monthLabel}'s Activity ranks by the month's own
            signed contracts and cross-tags each row against the other two views.
          </p>




          <div className="qc-grid">
            <div className="qc-card">
              <div className="qc-card__head">
                <p className="qc-card__title">Most Concentrated</p>
                <span className="qc-card__cadence">TTM % Lux &middot; min. 11 qualifying deals &middot; updates monthly</span>
              </div>
              <table className="qc-tbl">
                <thead>
                  <tr>
                    <th><span className="sr-only">Rank</span></th>
                    <th>Neighborhood</th>
                    <th className="r">% Lux</th>
                  </tr>
                </thead>
                <tbody>
                  {p.concentrated_leaderboard?.length ? (
                    (() => {
                      const maxPct = Math.max(
                        ...p.concentrated_leaderboard.map((r) => (typeof r.pct_lux === "number" ? r.pct_lux : 0)),
                        1,
                      );
                      return p.concentrated_leaderboard.slice(0, 10).map((r) => {
                        const pctPct = typeof r.pct_lux === "number" ? (r.pct_lux / maxPct) * 100 : 0;
                        return (
                          <tr key={r.name}>
                            <td className="qc-rank">{r.rank}</td>
                            <td className="qc-name">
                              {r.name}
                              <span className="qc-n-tag"> &middot; n={fmtInt(r.contracts_52wk)}</span>
                            </td>
                            <td className="qc-num">
                              <div className="qc-bar-cell">
                                <div className="qc-bar-track">
                                  <div className="qc-bar-fill" style={{ width: `${pctPct.toFixed(0)}%` }} />
                                </div>
                                <span className="qc-bar-num">{fmtPct(r.pct_lux)}</span>
                              </div>
                            </td>
                          </tr>
                        );
                      });
                    })()
                  ) : (
                    <tr>
                      <td colSpan={3} style={{ textAlign: "center" }}>Not available for this month.</td>
                    </tr>
                  )}
                </tbody>
              </table>
              <p className="qc-card__note">Where luxury deals make up the biggest share of local sales.</p>
            </div>

            <div className="qc-card">
              <div className="qc-card__head">
                <p className="qc-card__title">Largest Luxury Markets</p>
                <span className="qc-card__cadence">TTM $ Volume &middot; updates monthly</span>
              </div>
              <table className="qc-tbl">
                <thead>
                  <tr>
                    <th><span className="sr-only">Rank</span></th>
                    <th>Neighborhood</th>
                    <th className="r">Luxury $ Vol</th>
                  </tr>
                </thead>
                <tbody>
                  {p.leaderboard?.length ? (
                    p.leaderboard.slice(0, 10).map((r) => (
                      <tr key={r.name}>
                        <td className="qc-rank">{r.rank}</td>
                        <td className="qc-name">{r.name}</td>
                        <td className="qc-num">{fmtMoneyM(r.vol_52wk)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} style={{ textAlign: "center" }}>Not available for this month.</td>
                    </tr>
                  )}
                </tbody>
              </table>
              <p className="qc-card__note">Where the luxury business is largest, measured by total dollar volume.</p>
            </div>

            <div className="qc-card">
              <div className="qc-card__head">
                <p className="qc-card__title">{monthLabel}'s Activity</p>
                <span className="qc-card__cadence">Signed contracts &middot; {monthLabel}</span>
              </div>
              <table className="qc-tbl">
                <thead>
                  <tr>
                    <th><span className="sr-only">Rank</span></th>
                    <th>Neighborhood</th>
                    <th className="r">Signed</th>
                    <th className="r">Volume</th>
                  </tr>
                </thead>
                <tbody>
                  {p.monthly_activity_leaderboard?.length ? (
                    p.monthly_activity_leaderboard.map((r) => (
                      <tr key={r.name}>
                        <td className="qc-tagcell">
                          {typeof r.concentrated_rank === "number" ? (
                            <span className="qc-tag qc-tag-c">C{r.concentrated_rank}</span>
                          ) : null}
                          {typeof r.largest_rank === "number" ? (
                            <span className="qc-tag qc-tag-l">L{r.largest_rank}</span>
                          ) : null}
                          {typeof r.concentrated_rank !== "number" && typeof r.largest_rank !== "number" ? (
                            <span className="qc-tag qc-tag-new">New</span>
                          ) : null}
                        </td>
                        <td className="qc-name">{r.name}</td>
                        <td className="qc-num">{fmtInt(r.month_contracts)}</td>
                        <td className="qc-num">{fmtMoneyM(r.month_volume)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} style={{ textAlign: "center" }}>No neighborhoods qualified this month.</td>
                    </tr>
                  )}
                </tbody>
              </table>
              <p className="qc-card__note">{monthLabel}'s most active neighborhoods by signed contracts. Tags show where a neighborhood also ranks. C = Most Concentrated, L = Largest Markets.</p>
            </div>
          </div>

          <div className="ldr-card">
            <div className="ldr-toolbar">
              <span className="ldr-toolbar-label">Top 10 &middot; Ranked by TTM luxury dollar volume</span>
            </div>
            <div className="ldr-scroll">
              <table className="ldr-tbl">
                <thead>
                  <tr className="ldr-grp">
                    <th colSpan={8} className="grp-baseline">TTM baseline</th>
                  </tr>
                  <tr>
                    <th><span className="sr-only">Rank</span></th>
                    <th>Neighborhood</th>
                    <th>Luxury Dollar Volume</th>
                    <th className="r">Contracts</th>
                    <th className="r">Nbhd Median</th>
                    <th className="r">Avg Sale</th>
                    <th className="r">% Lux</th>
                    <th className="r">Rank vs. 1yr Ago</th>
                  </tr>
                </thead>
                <tbody>
                  {p.leaderboard?.length ? (
                    (() => {
                      const maxPct = Math.max(
                        ...p.leaderboard.map((r) => (typeof r.pct_lux === "number" ? r.pct_lux : 0)),
                        1,
                      );
                      const maxVol = Math.max(
                        ...p.leaderboard.map((r) => (typeof r.vol_52wk === "number" ? r.vol_52wk : 0)),
                        1,
                      );
                      return p.leaderboard.slice(0, 10).map((r, i) => {
                        const pctPct = typeof r.pct_lux === "number" ? (r.pct_lux / maxPct) * 100 : 0;
                        const volPct = typeof r.vol_52wk === "number" ? (r.vol_52wk / maxVol) * 100 : 0;
                        const deltaEl =
                          typeof r.rank_delta !== "number" ? (
                            <span className="ldr-badge ldr-badge-zero">—</span>
                          ) : r.rank_delta > 0 ? (
                            <span className="ldr-badge ldr-badge-up">▲ {r.rank_delta}</span>
                          ) : r.rank_delta < 0 ? (
                            <span className="ldr-badge ldr-badge-dn">▼ {Math.abs(r.rank_delta)}</span>
                          ) : (
                            <span className="ldr-badge ldr-badge-zero">◆</span>
                          );
                        return (
                          <tr key={r.name} className={i < 3 ? "gold-row" : undefined}>
                            <td className="ldr-rank">{r.rank}</td>
                            <td className="ldr-name">{r.name}</td>
                            <td className="ldr-vol">
                              <div className="ldr-vol-row">
                                <div className="ldr-vol-track">
                                  <div className="ldr-vol-bar" style={{ width: `${volPct.toFixed(0)}%` }} />
                                </div>
                                <span className="ldr-vol-num">{fmtMoneyM(r.vol_52wk)}</span>
                              </div>
                            </td>
                            <td className="ldr-num">{fmtInt(r.contracts_52wk)}</td>
                            <td className="ldr-entry">{fmtMoney(r.local_median)}</td>
                            <td className="ldr-avg">{fmtMoney(r.avg_sale)}</td>
                            <td className="ldr-pct">
                              <div className="ldr-pct-row">
                                <div className="ldr-pct-track">
                                  <div className="ldr-pct-bar" style={{ width: `${pctPct.toFixed(0)}%` }} />
                                </div>
                                <span className="ldr-pct-num">{fmtPct(r.pct_lux)}</span>
                              </div>
                            </td>
                            <td className="ldr-delta">{deltaEl}</td>
                          </tr>
                        );
                      });
                    })()
                  ) : (
                    <tr>
                      <td colSpan={8} style={{ textAlign: "center" }}>Not available for this month.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* part 5 */}
        <section className="m-section" id="part-5" aria-labelledby="part-5-h">
          {n.part5_lede ? <p className="m-lede">{n.part5_lede}</p> : null}
          <div className="sec-label">Part 5</div>
          <h2 className="m-h2" id="part-5-h">What This Means</h2>
          <div className="m-wtm">
            <p className="m-wtm__t">Reading the month</p>
            <p className="m-p">
              {n.what_this_means ??
                "The month's figures sit in the tables above. Where a measure clears both its three month and twelve month average, treat it as signal. Where it clears only one, treat it as noise until a second month agrees."}
            </p>
            {n.recommendation ? (
              <p className="m-rec"><strong>Recommendation.</strong> {n.recommendation}</p>
            ) : null}
            {n.open_item ? (
              <p className="m-rec"><strong>Open item.</strong> {n.open_item}</p>
            ) : null}
          </div>

          <div className="m-xrefs">
            <Link to="/this-week" className="xref">The Week</Link>
            <a href="/quarterly-brief.html" className="xref">The Quarterly</a>
            <Link to="/archive" className="xref">Weekly Archive</Link>
          </div>
        </section>


        {/* footnotes */}
        <section className="m-notes" id="footnotes" aria-labelledby="footnotes-h">
          <h2 id="footnotes-h">Method and Notes</h2>
          <p>
            Figures cover signed contracts recorded between {fmtDateLong(row.month_start)} and{" "}
            {fmtDateLong(row.month_end)} in Manhattan. Tier cutoffs are percentile thresholds
            recalculated from the trailing record, so they move with the market rather than being set
            by hand.
          </p>
          <p>
            {"Any figure drawn from fewer than "}
            {SMALL_SAMPLE_FLOOR}
            {" transactions carries a small-sample note beside it. Read those figures as directional."}
          </p>
          {row.is_provisional ? <p>{PROVISIONAL_STRING}</p> : null}
          <h2 style={{ marginTop: 26 }}>Abbreviations</h2>
          <dl>
            <dt>DOF</dt>
            <dd>Department of Finance, the New York City agency that assesses property value for tax purposes.</dd>
            <dt>PPSF</dt>
            <dd>Price per square foot.</dd>
            <dt>DOM</dt>
            <dd>Days on market, the time from listing to signed contract.</dd>
            <dt>MoM</dt>
            <dd>Month over month, this month compared with the month before it.</dd>
            <dt>YoY</dt>
            <dd>Year over year, this month compared with the same month one year earlier.</dd>
          </dl>
        </section>
      </main>

      <SiteFooter asOf={fmtDateLong(row.month_end)} />
    </div>
  );
}
