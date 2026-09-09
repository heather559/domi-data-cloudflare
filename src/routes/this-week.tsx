import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { SiteHeader } from "../components/site-header";
import { SiteFooter, MP_PATH } from "../components/site-footer";
import { SubscribeForm } from "../components/subscribe-form";
import { QR_DESIGN_CSS, QR_MONOGRAM_SVG, buildQrDesignScript } from "../lib/qr-design";
import { breadcrumbScript, TRAILS } from "../lib/breadcrumbs";
import { WEEK_HERO } from "../lib/site-images";
import domiDataLockupAsset from "../assets/hd-dd-lockup-v2.png.asset.json";
const domiDataLockup = domiDataLockupAsset.url;
import {
  getLatestWeeklyReport,
  type WeeklyReportPayload,
  type WeeklyReportRow,
} from "../lib/weekly-report.functions";

/* ─────────── formatters (single source of truth) ─────────── */
const EMPTY = "—";
const NONE_LINE = "No qualifying contracts";

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function fmtInt(n: number | null | undefined): string {
  return isNum(n) ? Math.round(n).toLocaleString() : EMPTY;
}
function fmtMoneyM(n: number | null | undefined, dec = 2): string {
  if (!isNum(n)) return EMPTY;
  return `$${(n / 1_000_000).toFixed(dec)}M`;
}
/** Compact $ — B / M / k */
function fmtMoneyShort(n: number | null | undefined): string {
  if (!isNum(n)) return EMPTY;
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${Math.round(n / 1_000_000)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${Math.round(n)}`;
}
function fmtCurrencyInt(n: number | null | undefined): string {
  return isNum(n) ? `$${Math.round(n).toLocaleString()}` : EMPTY;
}
function fmtPctSigned(n: number | null | undefined, dec = 1): string {
  if (!isNum(n)) return EMPTY;
  if (Math.abs(n) < 0.05) return "flat";
  return (n >= 0 ? "▲" : "▼") + Math.abs(n).toFixed(dec) + "%";
}
function fmtPctInt(n: number | null | undefined): string {
  return isNum(n) ? `${Math.round(n)}%` : EMPTY;
}
function vsAvgPct(current: number | null, avg: number | null): number | null {
  if (!isNum(current) || !isNum(avg) || avg === 0) return null;
  return ((current - avg) / avg) * 100;
}
function deltaClass(pct: number | null): "up" | "down" | "flat" {
  if (!isNum(pct)) return "flat";
  if (pct > 0.05) return "up";
  if (pct < -0.05) return "down";
  return "flat";
}
export function fmtDateLong(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
function fmtDateShort(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}
export function fmtWeekRange(startISO: string, endISO: string): string {
  const s = new Date(startISO + "T00:00:00Z");
  const e = new Date(endISO + "T00:00:00Z");
  const sMonth = s.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  const eMonth = e.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  const year = e.getUTCFullYear();
  if (sMonth === eMonth) return `${sMonth} ${s.getUTCDate()}–${e.getUTCDate()}, ${year}`;
  return `${sMonth} ${s.getUTCDate()} – ${eMonth} ${e.getUTCDate()}, ${year}`;
}
function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!),
  );
}

const HOOD_SPECIAL: Record<string, string> = {
  soho: "SoHo", noho: "NoHo", nomad: "NoMad", dumbo: "DUMBO",
  "hell's kitchen": "Hell's Kitchen",
};
const HOOD_MINOR = new Set(["of", "the", "and", "on"]);
function titleCaseHood(s: string): string {
  if (!s) return s;
  const key = s.trim().toLowerCase();
  if (HOOD_SPECIAL[key]) return HOOD_SPECIAL[key];
  return s
    .split(/(\s+|-|\/)/)
    .map((part, i) => {
      if (/^\s+$/.test(part) || part === "-" || part === "/") return part;
      const lower = part.toLowerCase();
      if (HOOD_SPECIAL[lower]) return HOOD_SPECIAL[lower];
      if (i > 0 && HOOD_MINOR.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join("");
}

/* server-rendered so-what callout (small italic/muted line).
   The first callout rendered in a build is the page's plain-English summary
   paragraph; it carries id="week-summary" for the SpeakableSpecification. */
let summaryTagged = false;
/** Voice guide: no em dashes or "--" pseudo-dashes in published copy. */
function deDash(text: string): string {
  return text
    .replace(/\s+--\s+/g, ". ")
    .replace(/\s+[—–]\s+/g, ". ")
    .replace(/\.\s*\.\s*/g, ". ")
    .replace(/\.\s*\)/g, ")")
    .replace(/\(\s*\./g, "(")
    .replace(/\s{2,}/g, " ")
    .trim();
}
function sowhatCallout(text: string | null | undefined, tag = "What this means"): string {
  if (!text) return "";
  const id = summaryTagged ? "" : ' id="week-summary"';
  summaryTagged = true;
  return `<div class="sowhat"${id}><div class="sowhat__tag">${esc(tag)}</div><div class="sowhat__line">${esc(deDash(text))}</div></div>`;
}



/* ─────────── Screen-reader data tables (paired with each canvas chart) ─────────── */
// Shared with NeighborhoodReportPage — single implementation in src/lib/sr-table.ts.
import { srTable, zipSeries, srSummary, describeSeries, describeParts } from "../lib/sr-table";




/* ─────────── CSS (preserved verbatim + small additions for empty/flag) ─────────── */
export const REPORT_CSS = `
.report-scope {
  /* ── Shared Domi Data design tokens (verbatim from spec) ── */
  --ivory:       #FBF9F5;
  --paper:       #FFFFFF;
  --paper-2:     #FBF9F5;
  --taupe:       #E4DDD3;
  --ink:         #1C1A18;
  --ink-mid:     #4A4744;
  --ash:         #50677A;
  --olive:       #75694E;
  --rust:        #9E5040;
  --trophy:      #A37670;
  --rose-taupe:  #BA8C86;
  --p90:         #98A0A8; /* Luxury  (locked canonical) */
  --p95:         #918C7E; /* Prime   (locked canonical) */
  --p99:         #A37670; /* Trophy  (locked canonical) */
  /* Text-only AA variants (brand shades). Fills/bars/chips keep the canonical hexes above. */
  --p90-text:    #6C7881; /* Luxury text  4.52:1 */
  --p95-text:    #7A7363; /* Prime text   4.71:1 */
  --p99-text:    #A45A58; /* Trophy text  5.02:1 */
  --up-strong:   #2E6645;
  --down-strong: #9C2F26;

  /* ── Legacy aliases so existing selectors keep resolving ── */
  --ground:      var(--paper);
  --ground-mid:  var(--paper-2);
  --ground-hi:   var(--paper-2);
  --text:        var(--ink);
  --text-mid:    var(--ink-mid);
  --text-dim:    var(--ash);
  --rule:        var(--taupe);
  --rule-mid:    var(--taupe);
  --accent:      var(--p90);
  --accent-bg:   rgba(152,160,168,0.10);
  --gold:        var(--olive);
  --gold-bg:     rgba(117,105,78,0.08);
  --rust-bg:     rgba(158,80,64,0.10);
  --sage:        var(--up-strong);
  --sage-bg:     rgba(46,102,69,0.10);
  --serif:       'Ivy Mode','Cormorant Garamond','Times New Roman',Georgia,serif;
  --sans:        'Jost','Helvetica Neue',Helvetica,Arial,sans-serif;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }

.report-scope {
  background: var(--paper);
  color: var(--ink-mid);
  font-family: var(--sans);
  font-size: 17.5px;
  line-height: 1.68;
  -webkit-font-smoothing: antialiased;
  font-variant-numeric: tabular-nums;
}
@media (max-width: 640px) {
  .report-scope { font-size: 16px; }
}
.report-scope h1, .report-scope h2, .report-scope h3, .report-scope h4 {
  font-family: var(--serif);
  color: var(--ink);
  font-weight: 400;
  text-wrap: balance;
}

/* ─── MASTHEAD ─────────────────────────────────── */
.masthead {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 28px 56px 26px;
  border-bottom: 1px solid var(--rule);
  background: var(--ground);
}
.masthead__wordmark { font-family: var(--serif); font-size: 18px; font-weight: 700; letter-spacing: 0.04em; color: var(--text); }
.masthead__wordmark span { color: var(--accent); }
.masthead__tm { font-size: 0.48em; font-weight: 400; vertical-align: super; color: var(--text-dim); letter-spacing: 0; margin-left: 1px; }
.masthead__scope { font-weight: 400; color: var(--text-mid); letter-spacing: 0.01em; }
.masthead__date { font-size: 11px; font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase; color: var(--text-dim); }

/* ─── LEDE ─────────────────────────────────────── */
.page-lede { margin: 0 56px 48px; padding: 16px 20px; background: var(--ground-hi); border-left: 3px solid var(--accent); font-size: 13.5px; color: var(--text); line-height: 1.7; }
.page-lede__label { font-weight: 700; color: var(--accent); }
@media (max-width: 600px) { .page-lede { margin-left: 24px; margin-right: 24px; } }

/* ─── HERO SUP + PROVISIONAL ────────────────────── */
.week-hero__dual-num sup { font-size: 24px; line-height: 1; vertical-align: 0.55em; font-weight: 400; color: var(--text-mid); }
.hero-provisional { font-size: 13px; color: var(--text-dim); margin-top: 12px; margin-bottom: 32px; }

/* ─── SO-WHAT (matches shared .callout / .callout-label) ─── */
.sowhat { margin-top: 36px; margin-bottom: 36px; background: var(--paper); border: 1px solid var(--ink); border-radius: 2px; padding: 26px 30px; }
.sowhat__tag { display: inline-block; font-family: var(--sans); font-size: 12px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #fff; background: var(--trophy); padding: 5px 11px; border-radius: 2px; margin-bottom: 14px; }
.sowhat__line { font-family: var(--sans); font-size: 17.5px; color: var(--ink); line-height: 1.62; }
.sowhat__line b { font-weight: 700; }
.sowhat__cta { margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--taupe); }
.sowhat__cta-link { display: inline-block; font-family: var(--sans); font-size: 15px; font-weight: 700; letter-spacing: .04em; color: var(--rust); text-decoration: none; border-bottom: 1px solid var(--rust); padding-bottom: 1px; }
.sowhat__cta-link:hover { color: var(--ink); border-color: var(--ink); }
.sowhat__cta-link::after { content: " \\2192"; }

/* ─── MASTHEAD (shared design system) ─────────────── */
.tw-masthead { padding: 64px 64px 44px; display: flex; flex-direction: column; align-items: flex-start; gap: 0; background: var(--paper); }
.tw-masthead__brand { font-family: var(--serif); font-size: 17px; letter-spacing: .22em; text-transform: uppercase; color: var(--rust); margin-bottom: 18px; font-weight: 400; }
.tw-masthead__title { font-family: var(--serif); font-size: clamp(36px,5.2vw,58px); font-weight: 400; line-height: 1.12; color: var(--ink); text-wrap: balance; }
.tw-masthead__meta { margin-top: 32px; font-size: 17.5px; color: var(--olive); line-height: 1.68; font-family: var(--sans); font-weight: 400; }
.tw-masthead__meta strong { color: var(--ink-mid); display: block; font-weight: 600; letter-spacing: .04em; margin-bottom: 4px; font-size: 18px; }
/* Photo masthead (Manhattan-wide reports). Same treatment as neighborhood pages. */
.tw-masthead--photo { position: relative; isolation: isolate; overflow: hidden; min-height: 420px; justify-content: flex-end; padding: 120px 64px 44px; }
.tw-masthead--photo .tw-masthead__bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 50% 32%; z-index: -2; }
.tw-masthead--photo::after { content: ""; position: absolute; inset: 0; z-index: -1; background: linear-gradient(180deg, rgba(20,15,12,0.30) 0%, rgba(20,15,12,0.52) 45%, rgba(20,15,12,0.80) 100%); }
.tw-masthead--photo .tw-masthead__brand { color: #F2E4DF; text-shadow: 0 1px 6px rgba(0,0,0,0.55); }
.tw-masthead--photo .tw-masthead__title { color: #FFFFFF; text-shadow: 0 2px 14px rgba(0,0,0,0.6); }
.tw-masthead--photo .tw-masthead__title span { color: #E7E1DA !important; }
.tw-masthead--photo .tw-masthead__meta { color: #E7E1DA; text-shadow: 0 1px 6px rgba(0,0,0,0.6); }
.tw-masthead--photo .tw-masthead__meta strong { color: #FFFFFF; }
@media (max-width: 640px) {
  .tw-masthead { padding: 36px 24px 28px; }
  .tw-masthead__title { line-height: 1.1; }
  .tw-masthead__meta { line-height: 1.7; }
  .tw-masthead--photo { min-height: 300px; padding: 80px 24px 26px; }
  .tw-masthead--photo .tw-masthead__bg { object-position: 50% 35%; }
}

/* ─── HERO ─────────────────────────────────────── */
.week-hero { padding: 72px 56px 64px; border-bottom: 1px solid var(--rule); }
.week-hero__eyebrow { font-size: 12px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: var(--text-dim); margin-bottom: 20px; }
.week-hero__primary { display: flex; align-items: flex-end; gap: 32px; margin-bottom: 16px; flex-wrap: wrap; }
.week-hero__number { font-family: var(--serif); font-size: clamp(96px, 18vw, 160px); font-weight: 700; line-height: 0.88; letter-spacing: -4px; color: var(--text); min-width: 180px; }
.week-hero__label-block { padding-bottom: 8px; }
.week-hero__label { font-family: var(--serif); font-size: clamp(20px, 3vw, 28px); font-weight: 400; line-height: 1.2; color: var(--text); margin-bottom: 6px; }
.week-hero__sub { font-size: 13.5px; color: var(--text-mid); letter-spacing: 0.04em; }
.week-hero__callout { display: inline-flex; align-items: center; gap: 8px; background: var(--accent-bg); border: 1px solid rgba(199,185,178,0.3); border-radius: 2px; padding: 8px 16px; font-size: 13px; color: var(--accent); font-weight: 600; letter-spacing: 0.02em; margin-bottom: 48px; }
.week-hero__callout::before { content: '▲'; font-size: 10px; }

.week-hero__windows { display: flex; align-items: center; gap: 0; margin-bottom: 10px; flex-wrap: wrap; }
.week-hero__window { display: flex; align-items: baseline; gap: 10px; padding: 10px 20px 10px 0; }
.week-hero__window-sep { width: 1px; height: 24px; background: var(--rule-mid); margin: 0 20px 0 0; align-self: center; flex-shrink: 0; }
.week-hero__window-pct { font-family: var(--serif); font-size: 24px; font-weight: 700; color: var(--accent); line-height: 1; }
.week-hero__window-label { font-size: 13.5px; color: var(--text-mid); letter-spacing: 0.02em; }
.week-hero__window-note { font-size: 13.5px; color: var(--text-dim); margin-bottom: 28px; font-style: italic; }

/* ─── HERO DOLLAR VOLUME ────────────────────────── */
.week-hero__vol-block { padding-top: 24px; border-top: 1px solid var(--rule); margin-bottom: 40px; }
.week-hero__vol-row { display: flex; align-items: baseline; gap: 20px; flex-wrap: wrap; margin-bottom: 10px; }
.week-hero__vol-num { font-family: var(--serif); font-size: clamp(28px, 5vw, 40px); font-weight: 700; line-height: 1; color: var(--text); }
.week-hero__vol-desc { font-size: 13.5px; color: var(--text-mid); }

/* ─── HERO DUAL (drama + symmetry) ─────────────── */
.week-hero__dual { display: flex; align-items: flex-end; gap: 0; margin-bottom: 40px; flex-wrap: wrap; }
.week-hero__dual-metric { flex: 1; min-width: 220px; padding-right: 56px; border-right: 1px solid var(--rule); margin-right: 56px; }
.week-hero__dual-metric:last-child { border-right: none; padding-right: 0; margin-right: 0; }
.week-hero__dual-num { font-family: var(--serif); font-weight: 700; line-height: 0.88; color: var(--text); margin-bottom: 10px; }
.week-hero__dual-num--primary { font-size: clamp(80px, 14vw, 128px); letter-spacing: -4px; }
.week-hero__dual-num--secondary { font-size: clamp(48px, 9vw, 80px); letter-spacing: -2px; }
.week-hero__dual-label { font-size: 13px; font-weight: 700; color: var(--text); letter-spacing: 0.02em; margin-bottom: 10px; }

/* ─── HERO GRID (ported from monthly.tsx / quarterly-brief.html) ─── */
.hero-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px 40px; background: var(--paper); border: 2px solid var(--ink); border-top-width: 5px; border-radius: 3px; margin-bottom: 40px; padding: 40px 36px; }
.hero-cell { background: transparent; border: none; padding: 0; text-align: center; }
.hero-cell:nth-child(1), .hero-cell:nth-child(2) { border-right: 1px solid rgba(28,26,24,.18); }
.hero-tier { font-family: var(--serif); font-size: 16px; font-weight: 900; letter-spacing: .18em; text-transform: uppercase; margin-bottom: 8px; color: var(--ink); -webkit-text-stroke: .4px currentColor; }
.hero-tier.p90, .hero-floor.p90 { color: #565C62; }
.hero-tier.p95, .hero-floor.p95 { color: #797467; }
.hero-tier.p99, .hero-floor.p99 { color: #9A6863; }
.hero-floor { display: inline-block; font-family: var(--serif); font-size: 1.5rem; font-weight: 500; line-height: 1; margin-bottom: 18px; padding-bottom: 16px; border-bottom: 1px solid rgba(28,26,24,.18); font-variant-numeric: tabular-nums; color: var(--ink); }
.hero-floor-lbl { display: block; font-size: 12px; color: var(--ash); text-transform: uppercase; letter-spacing: .1em; font-weight: 400; font-family: var(--sans); margin: 6px 0 0; }
.hero-num { font-family: var(--serif); font-size: 2.2rem; font-weight: 400; line-height: 1; margin-bottom: 6px; font-variant-numeric: tabular-nums; }
.hero-sub { font-size: 14px; color: var(--ash); }
.hero-band { display: block; font-size: 11.5px; letter-spacing: .08em; text-transform: uppercase; color: var(--text-dim); margin-top: 10px; }
.hero-wide { border: none; border-top: 1px solid rgba(28,26,24,.18); border-radius: 0; background: transparent; padding: 26px 0 0; margin: 14px 0 0; text-align: center; grid-column: 1 / -1; }
.hero-wide__title { font-family: var(--serif); font-size: 20px; color: var(--ink); margin-bottom: 10px; }
.hero-wide__stats { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px; text-align: center; }
.hero-wide__val { font-family: var(--serif); font-size: 1.8rem; color: var(--ink-mid); font-variant-numeric: tabular-nums; }
.hero-wide__cap { font-size: 14px; color: var(--olive); margin-top: 6px; }
@media (max-width: 640px) {
  .hero-grid { grid-template-columns: 1fr !important; padding: 24px 20px; gap: 0; margin-bottom: 28px; }
  .hero-cell:nth-child(1), .hero-cell:nth-child(2) { border-right: none; }
  .hero-cell + .hero-cell { border-top: 1px solid rgba(28,26,24,.18); padding-top: 20px; margin-top: 20px; }
  .hero-num { font-size: 1.9rem; }
  .hero-floor { font-size: 1.25rem; margin-bottom: 14px; padding-bottom: 12px; }
  .hero-wide__stats { grid-template-columns: 1fr; gap: 16px; }
}

/* ─── MOMENTUM (three tiers, five metrics · 52 weeks) ─── */
.tw-momentum { border: 1px solid var(--rule); border-radius: 4px; padding: 20px 20px 16px; margin-top: 20px; }
.tw-momentum__toggle { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
.tw-momentum__toggle button { font-family: var(--sans); font-size: 12px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; padding: 7px 12px; border: 1px solid var(--rule-mid); background: none; color: var(--text-mid); border-radius: 2px; cursor: pointer; }
.tw-momentum__toggle button.is-active { background: var(--ink); border-color: var(--ink); color: var(--paper); }
.tw-momentum__hint { font-size: 13px; color: var(--text-dim); margin-bottom: 14px; }
.tw-momentum__legend { display: flex; gap: 20px; flex-wrap: wrap; margin-bottom: 12px; font-size: 13px; color: var(--text-mid); }
.tw-momentum__legend span { display: inline-flex; align-items: center; gap: 6px; }
.tw-momentum__legend i { width: 16px; height: 3px; border-radius: 2px; display: inline-block; }
.tw-momentum__legend em { font-style: normal; color: var(--text-dim); }
#momentum-chart { display: block; width: 100%; height: 260px; }
.tw-momentum__note { font-size: 12.5px; color: var(--text-dim); margin-top: 14px; line-height: 1.5; }

/* ─── CHART TOGGLE ──────────────────────────────── */
.chart-toggle { margin-top: 28px; }
.chart-toggle__btn { display: inline-flex; align-items: center; gap: 10px; background: none; border: 1px solid var(--rule-mid); border-radius: 2px; padding: 9px 16px; font-family: var(--sans); font-size: 13px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-mid); cursor: pointer; }
.chart-toggle__btn:hover { color: var(--text); border-color: var(--rule); }
.chart-toggle__icon { display: inline-block; font-size: 11px; transition: transform 0.2s; }
.chart-toggle__btn[aria-expanded="true"] .chart-toggle__icon { transform: rotate(180deg); }
.chart-toggle__panel { padding-top: 24px; }
.chart-toggle__panel[hidden] { display: none; }

/* ─── CHART INTERACTIVITY (crosshair, tooltip, expand) ── */
.chart-crosshair { position: fixed; width: 1px; background: rgba(27,23,20,0.28); pointer-events: none; display: none; z-index: 9998; }
.chart-tip { position: fixed; background: #1b1714; color: #f5efe6; font-family: var(--sans); font-size: 12.5px; line-height: 1.5; padding: 8px 10px; border-radius: 3px; box-shadow: 0 6px 20px rgba(0,0,0,0.25); pointer-events: none; z-index: 9999; display: none; min-width: 150px; }
.chart-tip__date { font-weight: 600; margin-bottom: 5px; color: #f5efe6; letter-spacing: 0.02em; }
.chart-tip__row { display: flex; align-items: center; gap: 8px; }
.chart-tip__sw { display: inline-block; width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.chart-tip__lab { color: rgba(245,239,230,0.75); }
.chart-tip__val { margin-left: auto; font-variant-numeric: tabular-nums; font-weight: 600; color: #f5efe6; }
.chart-expand { position: absolute; top: 6px; right: 6px; z-index: 5; background: rgba(255,253,249,0.9); border: 1px solid var(--rule-mid); border-radius: 2px; width: 24px; height: 24px; font-size: 13px; line-height: 1; cursor: pointer; opacity: 0; transition: opacity .18s ease; padding: 0; color: var(--text-mid); font-family: var(--sans); }
.chart-holder:hover .chart-expand, .chart-expand:focus-visible { opacity: 1; }
.chart-expand:hover { color: var(--text); border-color: var(--text-mid); background: #fff; }
.chart-modal[hidden] { display: none !important; }
.chart-modal { position: fixed; inset: 0; z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 32px; }
.chart-modal__backdrop { position: absolute; inset: 0; background: rgba(20,17,14,0.62); }
.chart-modal__panel { position: relative; background: var(--ground, #faf7f2); padding: 40px 44px 32px; border-radius: 3px; max-width: 1100px; width: 100%; box-shadow: 0 20px 60px rgba(0,0,0,0.4); }
.chart-modal__close { position: absolute; top: 10px; right: 14px; background: none; border: none; font-size: 26px; color: var(--text-mid); cursor: pointer; line-height: 1; padding: 4px 8px; }
.chart-modal__close:hover { color: var(--text); }
.chart-modal__title { font-family: var(--sans); font-size: 13px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--text-mid); margin-bottom: 16px; }
.chart-modal__canvas { display: block; width: 100%; height: 360px; }
.chart-modal__legend { display: flex; flex-wrap: wrap; gap: 20px; margin-top: 18px; font-family: var(--sans); font-size: 13px; color: var(--text-mid); }
.chart-modal__legitem { display: inline-flex; align-items: center; gap: 7px; }
.chart-modal__sw { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }

#supply-chart, #dom-chart { display: block; width: 100%; height: 200px; }

/* ─── TYPE TRENDS ──────────────────────────────── */
.type-trends__group { margin-top: 32px; }
.type-trends__group + .type-trends__group { margin-top: 48px; padding-top: 40px; border-top: 1px solid var(--rule); }
.type-trends__sub { font-size: 13px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: var(--text-mid); margin-bottom: 20px; }
.type-trends__grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 32px 40px; }
.type-trends__grid--three { grid-template-columns: repeat(3, 1fr); }
@media (max-width: 800px) { .type-trends__grid, .type-trends__grid--three { grid-template-columns: 1fr; } }
.type-chart { display: flex; flex-direction: column; }
.type-chart__title { font-size: 13px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-mid); margin-bottom: 10px; }
.type-chart canvas { display: block; width: 100%; height: 160px; }
.type-chart__legend { display: flex; gap: 14px; margin-top: 8px; flex-wrap: wrap; font-size: 12.5px; color: var(--text-mid); }
.type-chart__legend-item { display: flex; align-items: center; gap: 6px; }
.type-chart__legend-dot { width: 8px; height: 8px; border-radius: 50%; }

/* ─── WEEK READ BADGE ───────────────────────────── */
.week-read { display: inline-flex; align-items: center; gap: 7px; padding: 6px 14px; border-radius: 2px; font-size: 13px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 8px; }
.week-read--big     { background: rgba(199,185,178,0.18); color: #2A5C40; border: 1px solid rgba(199,185,178,0.4); }
.week-read--above   { background: rgba(199,185,178,0.10); color: #3D6652; border: 1px solid rgba(199,185,178,0.25); }
.week-read--normal  { background: var(--ground-mid); color: var(--text-mid); border: 1px solid var(--rule-mid); }
.week-read--slow    { background: rgba(158,80,64,0.08); color: #7A3428; border: 1px solid rgba(158,80,64,0.25); }
.week-read--holiday { background: var(--gold-bg); color: #7A5E2A; border: 1px solid rgba(135,128,110,0.3); }
/* server-side sowhat market_read classes */
.week-read--busy   { background: rgba(199,185,178,0.18); color: #2A5C40; border: 1px solid rgba(199,185,178,0.4); }
.week-read--quiet  { background: var(--gold-bg); color: #7A5E2A; border: 1px solid rgba(135,128,110,0.3); }
.week-read-explainer { font-size: 13.5px; color: var(--text-dim); margin-top: 8px; margin-bottom: 28px; max-width: 480px; line-height: 1.55; }

/* footnotes at bottom of page — see .footer-method-list in FOOTER block below */

/* ─── PULSE SUMMARY ─────────────────────────────── */
.pulse-block { position: relative; }
.pulse-block .sowhat { margin-top: 0; margin-bottom: 0; }
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

/* ─── SUPPLY DUAL ──────────────────────────────── */
.supply-dual { display: grid; grid-template-columns: 1fr 1px 1fr; gap: 0; margin-bottom: 40px; }
.supply-half { padding-right: 40px; }
.supply-half:last-child { padding-right: 0; padding-left: 56px; }
.supply-half__head { font-size: 12px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: var(--text-dim); margin-bottom: 20px; padding-bottom: 10px; border-bottom: 1px solid var(--rule); }
.supply-divider { background: var(--rule-mid); }
@media (max-width: 600px) { .supply-dual { grid-template-columns: 1fr; } .supply-divider { display: none; } .supply-half { padding: 0 0 32px 0; border-bottom: 1px solid var(--rule); } .supply-half:last-child { padding: 32px 0 0 0; border-bottom: none; } }

.chart-sublabel { font-size: 13px; color: var(--text-dim); margin-top: 8px; }
.chart-title { font-family: var(--serif); font-size: clamp(18px, 2.2vw, 22px); font-weight: 400; line-height: 1.25; color: var(--text); margin: 0 0 16px; }
.supply-chart-group { margin-top: 36px; }
.supply-chart-group + .supply-chart-group { margin-top: 48px; padding-top: 48px; border-top: 1px solid var(--rule); }

.hood-move { font-size: 13px; font-weight: 700; text-align: center; white-space: nowrap; }
.hood-move.up   { color: var(--accent); }
.hood-move.down { color: #9E5040; }
.hood-move.flat { color: var(--text-dim); }
.hood-move.isnew { color: var(--gold); font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; }

.week-stats { display: flex; gap: 0; flex-wrap: wrap; border-top: 1px solid var(--rule); padding-top: 32px; }
.week-stats__item { flex: 1; min-width: 140px; padding-right: 32px; border-right: 1px solid var(--rule); margin-right: 32px; }
.week-stats__item:last-child { border-right: none; margin-right: 0; padding-right: 0; }
.week-stats__val { font-family: var(--serif); font-size: 26px; font-weight: 700; line-height: 1; color: var(--text); margin-bottom: 6px; }
.week-stats__label { font-size: 12.5px; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-mid); line-height: 1.3; }

/* ─── SECTION SHELL (shared) ───────────────────── */
.section { padding: 36px 64px 56px; border-bottom: 1px solid var(--taupe); background: var(--paper); }
.section:last-of-type { border-bottom: none; }
.report-scope > .toc { box-sizing: border-box; display: block; width: 100%; padding: 0; background: var(--paper); border-bottom: 1px solid var(--taupe); height: 44px; min-height: 44px; max-height: 44px; overflow-x: auto; overflow-y: hidden; -webkit-overflow-scrolling: touch; scrollbar-width: none; position: sticky; top: calc(var(--site-header-h, 0px) - 1px); z-index: 90; box-shadow: 0 1px 0 rgba(28,26,24,.04); }
.report-scope > .toc[open] { height: 44px; min-height: 44px; max-height: 44px; overflow-x: auto; overflow-y: hidden; }
.report-scope > .toc::-webkit-scrollbar { display: none; }
.report-scope > .toc .toc-summary { display: none; }
.report-scope > .toc .toc-label { display: none; }
.report-scope > .toc .toc-panel { min-width: 0; height: 44px; overflow: visible; }
.report-scope > .toc .toc-panel::-webkit-scrollbar { display: none; }
.report-scope > .toc .toc-items { display: flex; flex-wrap: nowrap; align-items: center; width: max-content; height: 44px; gap: 4px; padding: 0 56px; }
.report-scope > .toc .toc-item { display: flex; align-items: center; height: 44px; min-height: 44px; font-family: var(--sans); font-size: 12px; font-weight: 400; letter-spacing: .12em; text-transform: uppercase; color: var(--ink-mid); padding: 0 14px; white-space: nowrap; text-decoration: none; }
.report-scope > .toc .toc-item:hover, .report-scope > .toc .toc-item:focus-visible { color: var(--ink); text-decoration: underline; }
.section__eyebrow { font-family: var(--sans); font-size: 14px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: var(--olive); margin-bottom: 12px; display: flex; align-items: center; gap: 12px; }
.section__eyebrow::after { content: ''; flex: 1; height: 1px; background: var(--taupe); }
.section__title { font-family: var(--serif); font-size: clamp(22px,3.2vw,32px); font-weight: 400; line-height: 1.15; color: var(--ink); margin-bottom: 22px; text-wrap: balance; }
.section__note { font-family: var(--sans); font-size: 16.5px; color: var(--ink-mid); max-width: 640px; line-height: 1.65; margin-bottom: 32px; }
@media (max-width: 700px) {
  .section { padding: 32px 24px; }
  .section__title { font-size: 26px; }
  .section__eyebrow { font-size: 13px; }
  .report-scope > .toc .toc-items { padding: 0 24px; }
}

/* ─── DATA KEY (reader's key at top of report) ─── */
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

/* ─── DEMAND CHART ─────────────────────────────── */
#demand-chart { display: block; width: 100%; height: 200px; }
.chart-legend { display: flex; gap: 24px; margin-top: 12px; flex-wrap: wrap; }
.chart-legend__item { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text-mid); }
.chart-legend__mark { width: 16px; height: 3px; border-radius: 2px; }
.chart-legend__mark--bar     { background: rgba(199,185,178,0.35); }
.chart-legend__mark--current { background: var(--accent); }
.chart-legend__mark--avg     { background: var(--gold); }

/* ─── LUXURY LINES ─────────────────────────────── */
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
.tw-tier-detail { margin-top: 2px; border-top: 1px solid var(--rule); }
.tw-tier-detail > summary { cursor: pointer; list-style: none; display: flex; align-items: center; gap: 8px; padding: 12px 16px; font-family: var(--sans); font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--text-mid); background: var(--ground-hi); min-height: 44px; }
.tw-tier-detail > summary::-webkit-details-marker { display: none; }
.tw-tier-detail > summary::before { content: '▸'; color: var(--accent); font-size: 10px; }
.tw-tier-detail[open] > summary::before { content: '▾'; }
.tw-tier-detail[open] > summary { border-bottom: 1px solid var(--rule); }
.tier-grid { display: grid; grid-template-columns: 1fr 1px 1fr 1px 1fr; margin-top: 40px; }
.tier-divider { background: var(--rule-mid); margin: 0 40px; }
.tier-col { padding-right: 16px; }
.tier-col:last-child { padding-right: 0; }
.tier-col__label { font-size: 12px; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase; color: var(--text-dim); margin-bottom: 12px; }
.tier-col__price { font-family: var(--serif); font-size: clamp(36px, 6vw, 52px); font-weight: 700; line-height: 1; color: var(--text); margin-bottom: 4px; letter-spacing: -1px; }
.tier-col__pct { font-size: 13.5px; color: var(--p90-text); font-weight: 600; letter-spacing: 0.06em; margin-bottom: 28px; }
.tier-col__stats { display: flex; flex-direction: column; gap: 0; padding-top: 20px; border-top: 1px solid var(--rule); }
.tier-stat { display: flex; justify-content: space-between; align-items: baseline; }
.tier-stat > span:first-child { font-family: var(--serif); font-size: 16px; font-weight: 700; color: var(--text); }
.tier-stat > span:last-child { font-size: 12.5px; color: var(--text-mid); letter-spacing: 0.06em; }

.trophy-callout { margin-top: 48px; background: var(--gold-bg); border: 1px solid rgba(135,128,110,0.22); border-radius: 2px; padding: 16px 20px; display: flex; align-items: center; gap: 20px; flex-wrap: wrap; }
.trophy-callout__label { font-size: 10px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: var(--gold); flex-shrink: 0; }
.trophy-callout__address { font-family: var(--serif); font-size: 16px; font-weight: 700; color: var(--text); }
.trophy-callout__price { font-size: 13px; color: var(--text-mid); margin-left: auto; }
.trophy-callout--empty { font-family: var(--serif); font-size: 14px; font-style: italic; color: var(--text-mid); }

.top-deals { margin: 0 auto; max-width: 960px; background: var(--ground-hi); border: 1px solid var(--rule-mid); border-radius: 2px; overflow: hidden; }
.top-deals__head { display: grid; grid-template-columns: 1fr 62px 90px 68px 66px 120px 84px; align-items: baseline; gap: 12px; padding: 12px 22px; border-bottom: 1px solid var(--rule-mid); background: var(--ground-mid); font-size: 10px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: var(--text-mid); }
.top-deals__head > div + div { text-align: right; }
.top-deals__list { display: flex; flex-direction: column; padding: 6px 22px 16px; }
.top-deal-row { display: grid; grid-template-columns: 1fr 62px 90px 68px 66px 120px 84px; align-items: baseline; gap: 12px; padding: 12px 0; border-top: 1px solid var(--rule); }
.top-deal-row:first-child { border-top: none; padding-top: 14px; }
.top-deal-row__address { font-family: var(--serif); font-size: 16px; font-weight: 700; color: var(--text); }
.top-deal-row__address--link { text-decoration: none; color: var(--text); border-bottom: 1px solid rgba(0,0,0,0.15); transition: border-color .15s, color .15s; display: inline; }
.top-deal-row__address--link:hover { color: var(--rust); border-bottom-color: var(--rust); }
.top-deal-row__ext { font-size: 11px; margin-left: 4px; color: var(--text-dim); vertical-align: super; }
.top-deal-row__sf { font-size: 12.5px; color: var(--text-mid); text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.top-deal-row__ppsf { font-size: 12.5px; color: var(--text-mid); text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.top-deal-row__dom { font-size: 12.5px; color: var(--text-mid); text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.top-deal-row__type { font-size: 10.5px; color: var(--text-dim); text-align: right; text-transform: uppercase; letter-spacing: 0.06em; white-space: nowrap; }
.top-deal-row__hood { font-size: 10.5px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--text-mid); text-align: right; }
.top-deal-row__price { font-family: var(--serif); font-size: 15px; font-weight: 700; color: var(--text); text-align: right; white-space: nowrap; }
.top-deals--empty { font-family: var(--serif); font-size: 14px; font-style: italic; color: var(--text-mid); padding: 14px 22px 18px; }
@media (max-width: 700px) { .top-deals__head { display: none; } .top-deal-row { grid-template-columns: 1fr; gap: 4px; } .top-deal-row__sf, .top-deal-row__ppsf, .top-deal-row__dom, .top-deal-row__type, .top-deal-row__hood, .top-deal-row__price { text-align: left; } }

/* ─── MARKET PULSE ─────────────────────────────── */
.pulse-pooled { margin-bottom: 32px; display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
.pulse-pooled__num { font-family: var(--serif); font-size: 40px; font-weight: 700; line-height: 1; }
.pulse-pooled__delta { font-size: 12px; color: var(--accent); font-weight: 600; }
.pulse-pooled__label { font-size: 12px; color: var(--text-mid); letter-spacing: 0.04em; }

.pulse-grid { display: grid; grid-template-columns: repeat(3, 1fr); border: 1px solid var(--rule-mid); border-radius: 2px; overflow: hidden; }
.pulse-col__head { padding: 12px 20px; background: var(--ground-mid); border-bottom: 1px solid var(--rule-mid); font-size: 10px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: var(--text-mid); display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 4px; }
.pulse-col__wow { font-size: 11px; font-weight: 500; letter-spacing: 0.1em; color: var(--text-dim); text-transform: uppercase; }
.pulse-col__flag { font-size: 8.5px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--gold); margin-left: 6px; }
.pulse-col:not(:last-child) .pulse-col__head,
.pulse-col:not(:last-child) .pulse-row { border-right: 1px solid var(--rule-mid); }
.pulse-row { display: flex; justify-content: space-between; align-items: flex-start; padding: 10px 20px; border-bottom: 1px solid var(--rule); background: var(--ground-hi); }
.pulse-row:last-child { border-bottom: none; }
.pulse-row__label { font-size: 12px; color: var(--text-mid); }
.pulse-row__val { font-family: var(--serif); font-size: 15px; font-weight: 700; color: var(--text); white-space: nowrap; }
.pulse-row__delta { font-size: 10px; font-weight: 700; margin-left: 4px; }
.delta--up   { color: var(--accent); }
.delta--down { color: #9E5040; }
.delta--flat { color: var(--text-dim); font-weight: 500; }

.stat-empty { font-family: var(--sans) !important; font-size: 13px !important; font-style: italic; color: var(--text-dim) !important; font-weight: 400 !important; }

/* ─── BEDROOM MIX ──────────────────────────────── */
.donut-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; margin-top: 40px; }
.donut-wrap { display: flex; flex-direction: column; align-items: center; }
.donut-title { font-size: 11px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--text-mid); margin-bottom: 20px; align-self: flex-start; }
.donut-canvas-wrap { width: 100%; max-width: 360px; }
.donut-canvas-wrap canvas { display: block; width: 100%; height: auto; }

/* ─── LEADERBOARD ─────────────────────────────── */
.ldr-card { margin-top: 40px; border: 1px solid var(--rule); overflow: hidden; }
.ldr-toolbar { display: flex; align-items: center; padding: 10px 16px; border-bottom: 1px solid var(--rule); background: var(--ground-hi); }
.ldr-toolbar-label { font-size: 9.5px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--text-dim); }
.ldr-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
.ldr-tbl { width: 100%; border-collapse: collapse; min-width: 700px; }
.ldr-grp th { font-size: 8.5px; letter-spacing: 0.1em; text-transform: uppercase; font-weight: 700; padding: 5px 10px; border-bottom: 1px solid var(--rule); }
.ldr-grp .grp-baseline { color: var(--text-dim); background: var(--ground); }
.ldr-grp .grp-current { color: #66727B; background: rgba(199,185,178,0.07); border-left: 2px solid rgba(199,185,178,0.28); }
.ldr-tbl thead tr:last-child th { font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-dim); font-weight: 700; padding: 8px 10px; text-align: left; background: var(--ground); border-bottom: 1px solid var(--rule); white-space: nowrap; }
.ldr-tbl thead tr:last-child th.r { text-align: right; }
.ldr-tbl thead tr:last-child th.section-start { border-left: 2px solid rgba(199,185,178,0.25); }
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
.ldr-wkly-ct { font-size: 13px; font-variant-numeric: tabular-nums; color: var(--text); text-align: right; font-weight: 600; min-width: 52px; border-left: 2px solid rgba(199,185,178,0.22); }
.ldr-wkly-vol { font-size: 12px; font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; color: var(--text-mid); min-width: 52px; }
.ldr-delta { text-align: right; width: 66px; }
.ldr-badge { display: inline-flex; align-items: center; gap: 2px; font-size: 12px; font-weight: 700; padding: 2px 6px; border-radius: 2px; white-space: nowrap; }
.ldr-badge-up { background: var(--sage-bg); color: var(--sage); }
.ldr-badge-dn { background: var(--rust-bg); color: var(--rust); }
.ldr-badge-zero { color: var(--text-dim); }
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
/* Four-column activity card: tighten gutters so the Volume column is not clipped. */
.qc-card--activity .qc-tbl { table-layout: fixed; }
.qc-card--activity .qc-tbl th, .qc-card--activity .qc-tbl td { padding-left: 8px; padding-right: 8px; }
.qc-card--activity .qc-tbl th:first-child, .qc-card--activity .qc-tbl td:first-child { padding-left: 12px; }
.qc-card--activity .qc-tbl th:last-child, .qc-card--activity .qc-tbl td:last-child { padding-right: 12px; }
.qc-card--activity .qc-tagcell { width: 62px; }
.qc-card--activity .qc-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.qc-card--activity .qc-tbl th:nth-child(3), .qc-card--activity .qc-tbl td:nth-child(3) { width: 46px; }
.qc-card--activity .qc-tbl th:nth-child(4), .qc-card--activity .qc-tbl td:nth-child(4) { width: 62px; }
.qc-card--activity .qc-tag { font-size: 9px; padding: 2px 4px; margin-right: 2px; }
.hood-note { margin-top: 16px; font-size: 11.5px; color: var(--text-dim); line-height: 1.6; }
.hood-compare { display: grid; grid-template-columns: repeat(3, 1fr); margin-top: 40px; padding-top: 32px; border-top: 1px solid var(--rule); }
.hood-compare__item { padding-right: 40px; border-right: 1px solid var(--rule-mid); margin-right: 40px; }
.hood-compare__item:last-child { border-right: none; margin-right: 0; padding-right: 0; }
.hood-compare__pct { font-family: var(--serif); font-size: clamp(40px, 6vw, 60px); font-weight: 700; line-height: 1; color: var(--text); margin-bottom: 8px; letter-spacing: -1px; }
.hood-compare__label { font-size: 12px; color: var(--text-mid); line-height: 1.5; }
.hood-compare__context { font-size: 11px; color: var(--text-dim); margin-top: 6px; }
@media (max-width: 800px) { .hood-compare { grid-template-columns: 1fr; gap: 28px; } .hood-compare__item { border-right: none; margin-right: 0; padding-right: 0; border-bottom: 1px solid var(--rule); padding-bottom: 28px; } .hood-compare__item:last-child { border-bottom: none; } }

/* ─── SUPPLY & ABSORPTION ──────────────────────── */
.supply-strip { display: flex; margin-top: 40px; margin-bottom: 48px; flex-wrap: wrap; }
.supply-stat { flex: 1; min-width: 160px; padding-right: 48px; border-right: 1px solid var(--rule-mid); margin-right: 48px; }
.supply-stat:last-child { border-right: none; margin-right: 0; padding-right: 0; }
.supply-stat__val { font-family: var(--serif); font-size: clamp(40px, 7vw, 60px); font-weight: 700; line-height: 1; color: var(--text); letter-spacing: -1px; margin-bottom: 6px; }
.supply-stat__label { font-size: 10.5px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--text-mid); margin-bottom: 4px; }
.supply-stat__context { font-size: 11.5px; color: var(--text-dim); }
#absorption-chart { display: block; width: 100%; height: 120px; }
.absorption-label { font-size: 11px; color: var(--text-dim); margin-top: 10px; letter-spacing: 0.04em; }

/* ─── FOOTER (shared footnotes look) ─────────────── */
.page-footer { padding: 36px 64px 44px; border-top: 1px solid var(--taupe); background: var(--paper); display: flex; align-items: flex-start; justify-content: space-between; gap: 32px; flex-wrap: wrap; }
.footer-method { font-family: var(--sans); font-size: 14px; color: var(--ash); line-height: 1.85; max-width: 640px; }
.footer-method strong { color: var(--ink-mid); font-weight: 600; }
.footer-brand { text-align: right; flex-shrink: 0; }
.footer-brand__name { font-family: var(--serif); font-size: 16px; font-weight: 400; color: var(--ink); margin-bottom: 2px; }
.footer-brand__title { font-family: var(--sans); font-size: 12px; color: var(--ash); letter-spacing: .04em; }
.footer-method-list { list-style: disc; padding-left: 20px; margin: 0; font-family: var(--sans); font-size: 14px; color: var(--ash); line-height: 1.85; max-width: 720px; }
.footer-method-list li { margin-bottom: 8px; }
.footer-method-list li:last-child { margin-bottom: 0; }

/* ─── CHART BLEED ──────────────────────────────── */
.chart-bleed { margin-left: -64px; margin-right: -64px; margin-bottom: 16px; display: block; }
.chart-bleed canvas { display: block; width: 100%; }

/* ─── RESPONSIVE ───────────────────────────────── */
@media (max-width: 800px) {
  .chart-bleed { margin-left: -24px; margin-right: -24px; }
  .masthead, .week-hero, .section, .page-footer, .tw-masthead { padding-left: 24px; padding-right: 24px; }
  .week-stats__item { min-width: 120px; padding-right: 20px; margin-right: 20px; }
  .tier-grid { grid-template-columns: 1fr; gap: 0; }
  .tier-divider { display: none; }
  .tier-col { padding-right: 0; padding-top: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--rule); }
  .tier-col:last-child { border-bottom: none; }
  .tier-col__rule { width: 40px; }
  .pulse-grid { grid-template-columns: 1fr; }
  .pulse-col:not(:last-child) .pulse-col__head,
  .pulse-col:not(:last-child) .pulse-row { border-right: none; border-bottom: 1px solid var(--rule-mid); }
  .donut-grid { grid-template-columns: 1fr; gap: 40px; }
  .supply-strip { flex-direction: column; gap: 32px; }
  .supply-stat { border-right: none; margin-right: 0; padding-right: 0; border-bottom: 1px solid var(--rule); padding-bottom: 32px; }
  .supply-stat:last-child { border-bottom: none; }
  .footer-brand { text-align: left; }
  .tw-masthead { gap: 12px; padding-top: 28px; padding-bottom: 24px; }
  .tw-masthead__meta { text-align: left; }
  .report-scope > .toc .toc-items { padding: 0 24px; }
  .week-hero { padding-top: 48px; padding-bottom: 40px; }
  .week-hero__dual-metric { flex: 1 1 100%; padding-right: 0; border-right: none; margin-right: 0; padding-bottom: 24px; margin-bottom: 24px; border-bottom: 1px solid var(--rule); }
  .week-hero__dual-metric:last-child { padding-bottom: 0; margin-bottom: 0; border-bottom: none; }
  .data-key__tiers { grid-template-columns: 1fr; }
  .data-key__tier { border-right: none; border-bottom: 1px solid var(--rule); }
  .data-key__tier:last-child { border-bottom: none; }
  .hood-compare { grid-template-columns: 1fr; }
  .hood-compare__item { border-right: none; border-bottom: 1px solid var(--rule); padding-bottom: 24px; margin-bottom: 24px; }
  .hood-compare__item:last-child { border-bottom: none; padding-bottom: 0; margin-bottom: 0; }
}
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
@media (max-width: 480px) {
  .week-hero__primary { flex-direction: column; align-items: flex-start; gap: 12px; }
  .week-stats { flex-direction: column; gap: 20px; }
  .week-stats__item { border-right: none; margin-right: 0; padding-right: 0; }
  .pulse-grid { font-size: 14px; }
  .report-scope > .toc .toc-items { padding: 0 24px; }
}
@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }

/* ─── SCROLL REVEAL ANIMATIONS ─────────────────── */
.reveal { opacity: 0; transform: translateY(15px); transition: opacity 0.8s ease-out, transform 0.8s ease-out; }
.reveal.in-view { opacity: 1; transform: translateY(0); }
.reveal-d1 { transition-delay: 0.1s; }
.reveal-d2 { transition-delay: 0.25s; }
.reveal-d3 { transition-delay: 0.4s; }
.chart-holder canvas, .type-chart canvas { clip-path: inset(0 100% 0 0); transition: clip-path 1.4s cubic-bezier(0.4, 0, 0.2, 1); }
.chart-holder.in-view canvas, .type-chart.in-view canvas { clip-path: inset(0 0 0 0); }
.chart-modal canvas, .chart-modal .chart-holder canvas { clip-path: none !important; transition: none !important; }
@media (prefers-reduced-motion: reduce) {
  .reveal, .reveal.in-view { opacity: 1; transform: none; transition: none; }
  .chart-holder canvas, .type-chart canvas { clip-path: none !important; transition: none; }
}
`;

/* ─────────── body builder ─────────── */

function pulseRow(label: string, val: string, deltaHtml = ""): string {
  return `<div class="pulse-row"><span class="pulse-row__label">${label}</span><div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px"><span class="pulse-row__val">${val}</span><div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;min-height:19px">${deltaHtml}</div></div></div>`;
}

function wowPill(pct: number | null | undefined): string {
  if (!isNum(pct)) return "";
  if (pct > 0) return `<span class="ldr-badge ldr-badge-up">▲ ${pct.toFixed(0)}% WoW</span>`;
  if (pct < 0) return `<span class="ldr-badge ldr-badge-dn">▼ ${Math.abs(pct).toFixed(0)}% WoW</span>`;
  return `<span class="ldr-badge ldr-badge-zero">flat WoW</span>`;
}

function sfxPill(pct: number | null | undefined, suffix: "WoW" | "YoY"): string {
  if (!isNum(pct)) return "";
  if (pct > 0) return `<span class="ldr-badge ldr-badge-up">▲ ${pct.toFixed(0)}% ${suffix}</span>`;
  if (pct < 0) return `<span class="ldr-badge ldr-badge-dn">▼ ${Math.abs(pct).toFixed(0)}% ${suffix}</span>`;
  return `<span class="ldr-badge ldr-badge-zero">flat ${suffix}</span>`;
}

function supplyBadges(wow: number | null | undefined, yoy: number | null | undefined): string {
  const parts = [sfxPill(yoy, "YoY"), sfxPill(wow, "WoW")].filter(Boolean);
  if (!parts.length) return "";
  return `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">${parts.join("")}</div>`;
}

function smallSampleBadge(): string {
  return `<span class="ldr-badge ldr-badge-zero">small sample</span>`;
}

function buildPulseCol(
  title: string,
  row: WeeklyReportPayload["market_pulse"]["by_type"]["condo"],
): string {
  const empty = (v: number | null | undefined, fmt: (n: number) => string): string =>
    isNum(v) ? fmt(v) : `<span class="stat-empty">${EMPTY}</span>`;
  const volEmpty = `<span class="stat-empty">Unavailable</span>`;
  const thin = !isNum(row.contracts) || row.contracts < 5;
  const thinSales = !isNum(row.recorded_sales) || row.recorded_sales < 5;
  return `<div class="pulse-col">
    <div class="pulse-col__head">${title}</div>
    ${pulseRow("Signed contracts", isNum(row.contracts) ? fmtInt(row.contracts) : `<span class="stat-empty">${NONE_LINE}</span>`, thin ? smallSampleBadge() : `${sfxPill(row.contracts_yoy_pct, "YoY")}${sfxPill(row.contracts_wow_pct, "WoW")}`)}
    ${pulseRow("Contract volume", isNum(row.contracts_volume) ? fmtMoneyShort(row.contracts_volume) : volEmpty, thin ? smallSampleBadge() : `${sfxPill(row.contracts_volume_yoy_pct, "YoY")}${sfxPill(row.contracts_volume_wow_pct, "WoW")}`)}
    ${pulseRow("Recorded sales", empty(row.recorded_sales, fmtInt), thinSales ? smallSampleBadge() : `${sfxPill(row.recorded_sales_yoy_pct, "YoY")}${sfxPill(row.recorded_sales_wow_pct, "WoW")}`)}
    ${pulseRow("Avg price / sq ft", empty(row.ppsf, (n) => fmtCurrencyInt(n)), thin ? smallSampleBadge() : `${sfxPill(row.ppsf_yoy_pct, "YoY")}${sfxPill(row.ppsf_wow_pct, "WoW")}`)}
    ${pulseRow("Discount from ask", empty(row.discount_pct, (n) => `${n >= 0 ? "" : "−"}${Math.abs(n).toFixed(2)}%`), thin ? smallSampleBadge() : `${sfxPill(row.discount_pct_yoy_pct, "YoY")}${sfxPill(row.discount_pct_wow_pct, "WoW")}`)}
    ${pulseRow("Days on market", empty(row.dom, (n) => String(Math.round(n))), thin ? smallSampleBadge() : `${sfxPill(row.dom_yoy_pct, "YoY")}${sfxPill(row.dom_wow_pct, "WoW")}`)}
  </div>`;
}


function buildLeaderboardRows(rows: WeeklyReportPayload["leaderboard"]): string {
  if (!rows || rows.length === 0) {
    return `<tr><td colspan="10" style="padding:24px;text-align:center;"><span class="stat-empty">No leaderboard data this week</span></td></tr>`;
  }
  const maxPct = Math.max(...rows.map((r) => (isNum(r.pct_lux) ? r.pct_lux : 0)), 1);
  const maxVol = Math.max(...rows.map((r) => (isNum(r.vol_52wk) ? r.vol_52wk : 0)), 1);
  return rows
    .map((r, i) => {
      const gold = i < 3 ? " gold-row" : "";
      const pctPct = isNum(r.pct_lux) ? (r.pct_lux / maxPct) * 100 : 0;
      const volPct = isNum(r.vol_52wk) ? (r.vol_52wk / maxVol) * 100 : 0;
      let deltaHtml = `<span class="ldr-badge ldr-badge-zero">—</span>`;
      if (isNum(r.rank_delta)) {
        if (r.rank_delta > 0)
          deltaHtml = `<span class="ldr-badge ldr-badge-up">▲ ${r.rank_delta}</span>`;
        else if (r.rank_delta < 0)
          deltaHtml = `<span class="ldr-badge ldr-badge-dn">▼ ${Math.abs(r.rank_delta)}</span>`;
        else deltaHtml = `<span class="ldr-badge ldr-badge-zero">◆</span>`;
      }
      const nameCell =
        r.name.toLowerCase() === "tribeca"
          ? `<a href="/neighborhoods/tribeca" style="color:inherit;text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:3px;">Tribeca</a>`
          : esc(titleCaseHood(r.name));
      return `<tr class="${gold.trim()}">
        <td class="ldr-rank">${r.rank}</td>
        <td class="ldr-name">${nameCell}</td>
        <td class="ldr-vol"><div class="ldr-vol-row"><div class="ldr-vol-track"><div class="ldr-vol-bar" style="width:${volPct.toFixed(0)}%"></div></div><span class="ldr-vol-num">${fmtMoneyShort(r.vol_52wk)}</span></div></td>
        <td class="ldr-num">${fmtInt(r.contracts_52wk)}</td>
        <td class="ldr-entry">${fmtMoneyM(r.local_median, 1)}</td>
        <td class="ldr-avg">${fmtMoneyM(r.avg_sale, 1)}</td>
        <td class="ldr-pct"><div class="ldr-pct-row"><div class="ldr-pct-track"><div class="ldr-pct-bar" style="width:${pctPct.toFixed(0)}%"></div></div><span class="ldr-pct-num">${fmtPctInt(r.pct_lux)}</span></div></td>
        <td class="ldr-wkly-ct">${isNum(r.wk_contracts) ? r.wk_contracts.toFixed(1) : EMPTY}</td>
        <td class="ldr-wkly-vol">${fmtMoneyShort(r.wk_volume)}</td>
        <td class="ldr-delta">${deltaHtml}</td>
      </tr>`;
    })
    .join("");
}

function buildQCVolumeRows(rows: WeeklyReportPayload["leaderboard"]): string {
  if (!rows || rows.length === 0) return `<tr><td colspan="3" style="padding:16px;text-align:center;"><span class="stat-empty">No data</span></td></tr>`;
  return rows.slice(0, 10).map((r) => {
    const nameCell = r.name.toLowerCase() === "tribeca"
      ? `<a href="/neighborhoods/tribeca" style="color:inherit;text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:3px;">Tribeca</a>`
      : esc(titleCaseHood(r.name));
    return `<tr><td class="qc-rank">${r.rank}</td><td class="qc-name">${nameCell}</td><td class="qc-num">${fmtMoneyShort(r.vol_52wk)}</td></tr>`;
  }).join("");
}

function buildQCConcentratedRows(rows: WeeklyReportPayload["concentrated_leaderboard"]): string {
  if (!rows || rows.length === 0) return `<tr><td colspan="3" style="padding:16px;text-align:center;"><span class="stat-empty">No data</span></td></tr>`;
  const maxPct = Math.max(...rows.map((r) => (isNum(r.pct_lux) ? r.pct_lux : 0)), 1);
  return rows.slice(0, 10).map((r) => {
    const nameCell = r.name.toLowerCase() === "tribeca"
      ? `<a href="/neighborhoods/tribeca" style="color:inherit;text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:3px;">Tribeca</a>`
      : esc(titleCaseHood(r.name));
    const pctPct = isNum(r.pct_lux) ? (r.pct_lux / maxPct) * 100 : 0;
    return `<tr><td class="qc-rank">${r.rank}</td><td class="qc-name">${nameCell}<span class="qc-n-tag"> · n=${fmtInt(r.contracts_52wk)}</span></td><td class="qc-num"><div class="qc-bar-cell"><div class="qc-bar-track"><div class="qc-bar-fill" style="width:${pctPct.toFixed(0)}%"></div></div><span class="qc-bar-num">${fmtPctInt(r.pct_lux)}</span></div></td></tr>`;
  }).join("");
}

function buildQCActivityRows(rows: WeeklyReportPayload["weekly_activity_leaderboard"]): string {
  if (!rows || rows.length === 0) return `<tr><td colspan="4" style="padding:16px;text-align:center;"><span class="stat-empty">No signed contracts at or above the luxury threshold this week</span></td></tr>`;
  return rows.map((r) => {
    const nameCell = r.name.toLowerCase() === "tribeca"
      ? `<a href="/neighborhoods/tribeca" style="color:inherit;text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:3px;">Tribeca</a>`
      : esc(titleCaseHood(r.name));
    const tags: string[] = [];
    if (isNum(r.concentrated_rank)) tags.push(`<span class="qc-tag qc-tag-c">C${r.concentrated_rank}</span>`);
    if (isNum(r.largest_rank)) tags.push(`<span class="qc-tag qc-tag-l">L${r.largest_rank}</span>`);
    const tagCell = tags.length > 0 ? tags.join(" ") : `<span class="qc-tag qc-tag-new">New</span>`;
    return `<tr><td class="qc-tagcell">${tagCell}</td><td class="qc-name">${nameCell}</td><td class="qc-num">${fmtInt(r.wk_contracts)}</td><td class="qc-num">${fmtMoneyShort(r.wk_volume)}</td></tr>`;
  }).join("");
}

function buildActivityRows(rows: WeeklyReportPayload["weekly_activity_leaderboard"]): string {
  if (!rows || rows.length === 0) {
    return `<tr><td colspan="5" style="padding:24px;text-align:center;"><span class="stat-empty">No signed contracts at or above the luxury threshold this week</span></td></tr>`;
  }
  return rows
    .map((r) => {
      const nameCell =
        r.name.toLowerCase() === "tribeca"
          ? `<a href="/neighborhoods/tribeca" style="color:inherit;text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:3px;">Tribeca</a>`
          : esc(titleCaseHood(r.name));
      const tags: string[] = [];
      if (isNum(r.largest_rank)) tags.push(`<span class="ldr-tag ldr-tag-largest">Also #${r.largest_rank} Largest</span>`);
      if (isNum(r.concentrated_rank)) tags.push(`<span class="ldr-tag ldr-tag-concentrated">Also #${r.concentrated_rank} Concentrated</span>`);
      const tagCell = tags.length > 0 ? tags.join(" ") : `<span class="ldr-tag ldr-tag-new">New this week</span>`;
      return `<tr>
        <td class="ldr-rank">${r.rank}</td>
        <td class="ldr-name">${nameCell}</td>
        <td class="ldr-num">${fmtInt(r.wk_contracts)}</td>
        <td class="ldr-num">${fmtMoneyShort(r.wk_volume)}</td>
        <td class="ldr-activity-tags">${tagCell}</td>
      </tr>`;
    })
    .join("");
}

export type ReportBodyOpts = {
  titleHtml?: string;
  metaHtml?: string;
  bannerHtml?: string;
  /** Internal reconciliation notes. Off by default: these are not public facing. */
  showChecks?: boolean;
};
export function buildReportBody(row: WeeklyReportRow, opts: ReportBodyOpts = {}): string {
  summaryTagged = false;
  const p = row.payload;
  const h = p.hero;
  const sw = p.sowhat ?? null;
  // Map server-side class like "read--busy" to matching week-read--busy CSS class.
  const badgeClass = sw
    ? `week-read week-read--${sw.market_read.class.replace(/^read--/, "")}`
    : "week-read week-read--normal";
  const badgeText = sw ? sw.market_read.badge : "Normal";
  const explainerText = sw
    ? deDash(sw.lede)
    : "Within 10% of the 52-week weekly average. Contract activity is running at the typical seasonal pace.";

  const provStar = row.is_provisional ? `<sup>*</sup>` : "";
  const provNote = row.is_provisional
    ? `<div class="hero-provisional"><sup>*</sup> Provisional — signed contracts may have a short recording lag and this figure can revise upward within the week.</div>`
    : `<div style="margin-bottom:32px"></div>`;

  const luxCutoffM = fmtMoneyM(h.luxury_cutoff);
  const primeCutoffM = fmtMoneyM(h.prime_cutoff);
  const trophyCutoffM = fmtMoneyM(h.trophy_cutoff);

  const luxCountVsAvg = vsAvgPct(h.luxury_count, h.luxury_count_avg52);
  const luxVolVsAvg = vsAvgPct(h.luxury_volume, h.luxury_volume_avg52);
  const luxCountLastWk = h.luxury_count_vs_lastweek_pct;
  const luxVolLastWk = h.luxury_volume_vs_lastweek_pct;
  const luxCountYoy = h.luxury_count_yoy_pct;
  const luxVolYoy = h.luxury_volume_yoy_pct;
  const luxCountContrast = isNum(luxCountVsAvg) && isNum(luxCountLastWk) && Math.sign(luxCountVsAvg) !== Math.sign(luxCountLastWk) && luxCountVsAvg !== 0 && luxCountLastWk !== 0;
  const luxVolContrast = isNum(luxVolVsAvg) && isNum(luxVolLastWk) && Math.sign(luxVolVsAvg) !== Math.sign(luxVolLastWk) && luxVolVsAvg !== 0 && luxVolLastWk !== 0;
  const luxCountBadge = isNum(luxCountLastWk) || isNum(luxCountYoy)
    ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">${sfxPill(luxCountYoy, "YoY")}${sfxPill(luxCountLastWk, "WoW")}</div><div style="font-size:13.5px;color:var(--text-dim)">${isNum(luxCountVsAvg) ? `${luxCountContrast ? "Still, " : ""}${(luxCountVsAvg >= 0 ? "+" : "")}${luxCountVsAvg.toFixed(0)}% vs 52-week avg &nbsp;·&nbsp; ${fmtInt(h.luxury_count_avg52)} deals/week` : ""}</div>`
    : `<div class="pulse-summary__vs flat"><span class="stat-empty">Baseline unavailable</span></div>`;
  const luxVolBadge = isNum(luxVolLastWk) || isNum(luxVolYoy)
    ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">${sfxPill(luxVolYoy, "YoY")}${sfxPill(luxVolLastWk, "WoW")}</div><div style="font-size:13.5px;color:var(--text-dim)">${isNum(luxVolVsAvg) ? `${luxVolContrast ? "Still, " : ""}${(luxVolVsAvg >= 0 ? "+" : "")}${luxVolVsAvg.toFixed(0)}% vs 52-week avg &nbsp;·&nbsp; ${fmtMoneyShort(h.luxury_volume_avg52)}/week` : ""}</div>`
    : `<div class="pulse-summary__vs flat"><span class="stat-empty">Baseline unavailable</span></div>`;

  const heroCountText = isNum(h.luxury_count)
    ? String(h.luxury_count)
    : `<span class="stat-empty">${NONE_LINE}</span>`;
  const heroVolText = isNum(h.luxury_volume)
    ? fmtMoneyShort(h.luxury_volume)
    : `<span class="stat-empty">${EMPTY}</span>`;

  // Pulse (all-Manhattan)
  const mp = p.market_pulse.all;
  const mpCountVsAvg = vsAvgPct(mp.contracts, mp.contracts_avg52);
  const mpVolVsAvg = vsAvgPct(mp.volume, mp.volume_avg52);
  const mpCountBadge = isNum(mp.contracts_vs_lastweek_pct) || isNum(mp.contracts_yoy_pct)
    ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">${sfxPill(mp.contracts_yoy_pct, "YoY")}${sfxPill(mp.contracts_vs_lastweek_pct, "WoW")}</div><div style="font-size:13.5px;color:var(--text-dim)">${isNum(mpCountVsAvg) ? `${(mpCountVsAvg >= 0 ? "+" : "")}${mpCountVsAvg.toFixed(0)}% vs 52-week avg &nbsp;·&nbsp; ${fmtInt(mp.contracts_avg52)} contracts/week` : ""}</div>`
    : `<div class="pulse-summary__vs flat"><span class="stat-empty">Baseline unavailable</span></div>`;
  const mpVolBadge = isNum(mp.volume_vs_lastweek_pct) || isNum(mp.volume_yoy_pct)
    ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">${sfxPill(mp.volume_yoy_pct, "YoY")}${sfxPill(mp.volume_vs_lastweek_pct, "WoW")}</div><div style="font-size:13.5px;color:var(--text-dim)">${isNum(mpVolVsAvg) ? `${(mpVolVsAvg >= 0 ? "+" : "")}${mpVolVsAvg.toFixed(0)}% vs 52-week avg &nbsp;·&nbsp; ${fmtMoneyShort(mp.volume_avg52)}/week` : ""}</div>`
    : `<div class="pulse-summary__vs flat"><span class="stat-empty">Baseline unavailable</span></div>`;

  // Top 5 deals of the week
  const topDealsHead = `<div class="top-deals__head"><div>Address</div><div>SF</div><div>$ / SF</div><div>DOM</div><div>Type</div><div>Neighborhood</div><div>Price</div></div>`;
  const DEAL_URL_OVERRIDES: Array<{ match: RegExp; url: string }> = [
    { match: /^\s*175\s+(5th|fifth)\b.*\b(n(orth)?[\s-]*)?17(n(orth)?)?\b/i, url: "https://heatherdomi.com/property-details/175-5TH-AVENUE-17NORTH-MANHATTAN-NY-10010/RLS20109499/334/" },
    { match: /^\s*42\s+wooster\b.*\b3\b/i, url: "https://heatherdomi.com/property-details/42-WOOSTER-STREET-3-MANHATTAN-NY-10013/RLS20099180/334/" },
    { match: /^\s*470\s+columbus\b/i, url: "https://heatherdomi.com/property-details/470-COLUMBUS-AVENUE-GARDEN-MANHATTAN-NY-10024/RLS10971298/334/" },
    { match: /^\s*15\s+(e|east)\s+26(th)?\b.*\b13b\b/i, url: "https://heatherdomi.com/property-details/15-E-26TH-STREET-13B-MANHATTAN-NY-10010/RLS20099568/334/" },
    { match: /^\s*422\s+(e|east)\s+72(nd)?\b/i, url: "https://heatherdomi.com/property-details/422-E-72ND-STREET-40B-41AB-MANHATTAN-NY-10021/RLS20090425/334/" },
    { match: /^\s*760\s+madison\b.*\b9\b/i, url: "https://heatherdomi.com/property-details/760-MADISON-AVENUE-9-MANHATTAN-NY-10065/RLS20022807/334/" },
    { match: /^\s*150\s+charles\b.*\b2m\b/i, url: "https://heatherdomi.com/property-details/150-CHARLES-STREET-M2-MANHATTAN-NY-10014/RLS20099077/334/" },
    { match: /^\s*135\s+(e|east)\s+79(th)?\b.*\b9e\b/i, url: "https://heatherdomi.com/property-details/135-E-79TH-STREET-9E-MANHATTAN-NY-10075/RLS20093186/334/" },
    { match: /^\s*791\s+park\b.*\b7a\b/i, url: "https://heatherdomi.com/property-details/791-PARK-AVENUE-7A-MANHATTAN-NY-10021/RLS20095596/334/" },
    { match: /^\s*255\s+(e|east)\s+74(th)?\b.*\b25a\b/i, url: "https://heatherdomi.com/property-details/255-E-74TH-STREET-25A-MANHATTAN-NY-10021/RLS20098729/334/" },
    { match: /^\s*175\s+(5th|fifth)\b.*\bs?18\b/i, url: "https://heatherdomi.com/property-details/175-5TH-AVENUE-18SOUTH-MANHATTAN-NY-10010/RLS20106796/334/" },
    { match: /^\s*259\s+w(est)?\.?\s+11(th)?\b/i, url: "https://heatherdomi.com/property-details/259-W-11TH-STREET-MANHATTAN-NY-10014/RLS20082585/334/" },
    { match: /^\s*170\s+(5th|fifth)\b.*\bph\b/i, url: "https://heatherdomi.com/property-details/170-5TH-AVENUE-5-MANHATTAN-NY-10010/RLS20081205/334/" },
    { match: /^\s*150\s+charles\b.*\b3as\b/i, url: "https://heatherdomi.com/property-details/150-CHARLES-STREET-3AS-MANHATTAN-NY-10014/RLS20088571/334/" },
    { match: /^\s*9\s+gay\s+st/i, url: "https://heatherdomi.com/property-details/9-GAY-STREET-MANHATTAN-NY-10014/RLS20073906/334/" },
    { match: /^\s*53\s+(e|east)\s+66(th)?\b.*\bpha\b/i, url: "https://heatherdomi.com/property-details/53-E-66TH-STREET-PHA-MANHATTAN-NY-10065/RLS20095127/334/" },
    { match: /^\s*1122\s+madison\b/i, url: "https://heatherdomi.com/property-details/1122-MADISON-AVENUE-FLOOR19-MANHATTAN-NY-10028/RLS20102908/334/" },
    { match: /^\s*150\s+w(est)?\.?\s+12(th)?\b.*\b3w\b/i, url: "https://heatherdomi.com/property-details/150-W-12TH-STREET-3W-MANHATTAN-NY-10011/RLS20095164/334/" },
    { match: /^\s*500\s+w(est)?\.?\s+18(th)?\b.*\b(e(ast)?[\s-]*)?22b\b/i, url: "https://heatherdomi.com/property-details/500-W-18TH-STREET-EAST-22B-MANHATTAN-NY-10011/RLS10956751/334/" },
    { match: /^\s*500\s+w(est)?\.?\s+18(th)?\b.*\b(w(est)?[\s-]*)?22a\b/i, url: "https://heatherdomi.com/property-details/500-W-18TH-STREET-W22A-MANHATTAN-NY-10011/RLS20092780/334/" },
    { match: /^\s*2\s+(e|east)\s+70(th)?\b.*\b10a\b/i, url: "https://heatherdomi.com/property-details/2-E-70TH-STREET-10A-MANHATTAN-NY-10021/RLS20103179/334/" },
  ];
  const dealUrl = (d: any): string | null => {
    const addr = typeof d.address === "string" ? d.address : "";
    for (const o of DEAL_URL_OVERRIDES) if (o.match.test(addr)) return o.url;
    if (typeof d.idx_url === "string" && d.idx_url) return d.idx_url;
    if (d.mls_id && d.url_slug) return `https://heatherdomi.com/property-details/${d.url_slug}/${d.mls_id}/334/`;
    return null;
  };
  const topDeals =
    Array.isArray(p.top_deals) && p.top_deals.length > 0
      ? `<div class="top-deals">${topDealsHead}<div class="top-deals__list">${p.top_deals
          .slice(0, 5)
          .map((d) => {
            const url = dealUrl(d);
            const addr = esc(d.address);
            const addrCell = url
              ? `<a class="top-deal-row__address top-deal-row__address--link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${addr}<span class="top-deal-row__ext" aria-hidden="true">↗</span></a>`
              : `<div class="top-deal-row__address">${addr}</div>`;
            return `<div class="top-deal-row">${addrCell}<div class="top-deal-row__sf">${isNum(d.sf) ? fmtInt(d.sf) + ' sf' : '—'}</div><div class="top-deal-row__ppsf">${isNum(d.ppsf) ? '$' + fmtInt(d.ppsf) + '/sf' : '—'}</div><div class="top-deal-row__dom">${isNum(d.dom) ? d.dom + 'd' : '—'}</div><div class="top-deal-row__type">${d.property_type ? esc(d.property_type) : '—'}</div><div class="top-deal-row__hood">${esc(d.neighborhood)}</div><div class="top-deal-row__price">${fmtMoneyM(d.price)}</div></div>`;
          })
          .join("")}</div></div>`
      : `<div class="top-deals">${topDealsHead}<div class="top-deals--empty">No qualifying deals this week.</div></div>`;

  // Tiers
  const t = p.tiers;

  // ── Trailing 52-week detail derived from the weekly tier series ──────
  // Series values arrive in $M for median; dom is in days. Counts weight both.
  const series52 = Array.isArray(p.tier_series) ? p.tier_series.slice(-52) : [];
  const trailing52 = (key: "luxury" | "prime" | "trophy") => {
    const pts = series52
      .map((s) => s[key])
      .filter((m): m is NonNullable<typeof m> => !!m);
    const withCount = pts.filter((m) => isNum(m.count) && (m.count as number) > 0);
    // Count-weighted median of the weekly medians.
    const medRows = withCount
      .filter((m) => isNum(m.median))
      .map((m) => ({ v: (m.median as number) * 1_000_000, w: m.count as number }))
      .sort((a, b) => a.v - b.v);
    const totalW = medRows.reduce((s, r) => s + r.w, 0);
    let median: number | null = null;
    if (totalW > 0) {
      let acc = 0;
      for (const r of medRows) {
        acc += r.w;
        if (acc >= totalW / 2) { median = r.v; break; }
      }
    }
    // Count-weighted average days on market.
    const domRows = withCount.filter((m) => isNum(m.dom));
    const domW = domRows.reduce((s, m) => s + (m.count as number), 0);
    const dom = domW > 0
      ? domRows.reduce((s, m) => s + (m.dom as number) * (m.count as number), 0) / domW
      : null;
    return { median, dom };
  };
  const tierTrailing = {
    luxury: trailing52("luxury"),
    prime: trailing52("prime"),
    trophy: trailing52("trophy"),
  };

  // ── Week-of figures per tier, drawn from the exclusive-band tier series ──
  const allSeries = Array.isArray(p.tier_series) ? p.tier_series : [];
  const pctChange = (cur: number | null | undefined, prior: number | null | undefined): number | null =>
    isNum(cur) && isNum(prior) && prior !== 0 ? ((cur - prior) / Math.abs(prior)) * 100 : null;
  const weekOf = (key: "luxury" | "prime" | "trophy") => {
    const cur = allSeries.length > 0 ? allSeries[allSeries.length - 1]?.[key] ?? null : null;
    const prev = allSeries.length > 1 ? allSeries[allSeries.length - 2]?.[key] ?? null : null;
    const yr = allSeries.length >= 53 ? allSeries[allSeries.length - 53]?.[key] ?? null : null;
    return {
      count: cur?.count ?? null,
      // Series volumes arrive in $M, the same scale as the series medians.
      volume: isNum(cur?.volume) ? (cur!.volume as number) * 1_000_000 : null,
      countWow: pctChange(cur?.count, prev?.count),
      countYoy: pctChange(cur?.count, yr?.count),
      volWow: pctChange(cur?.volume, prev?.volume),
      volYoy: pctChange(cur?.volume, yr?.volume),
    };
  };
  const tierWeek = { luxury: weekOf("luxury"), prime: weekOf("prime"), trophy: weekOf("trophy") };

  // Lightweight on-page reconciliation: the three exclusive bands should add up to
  // the segment total shown above them. Never blocks, always reports plainly.
  const bandCounts = [tierWeek.luxury.count, tierWeek.prime.count, tierWeek.trophy.count];
  const bandSum = bandCounts.every((c) => isNum(c))
    ? (bandCounts as number[]).reduce((s, c) => s + c, 0)
    : null;
  const tierCheckHtml =
    bandSum === null || !isNum(h.luxury_count)
      ? ""
      : Math.round(bandSum) === Math.round(h.luxury_count)
        ? `<p class="tier-check" role="status">Checked: the three tiers are separate price bands, and they add up to the segment total of ${fmtInt(h.luxury_count)} contracts.</p>`
        : `<p class="tier-check tier-check--warn" role="status">Check flagged: the three tier bands add to ${fmtInt(bandSum)} contracts against a stated segment total of ${fmtInt(h.luxury_count)}. Figures are shown as reported by the data feed.</p>`;

  // The feed sometimes ships a stale trophy sentence that claims no trophy
  // contracts even when the week recorded some. Trust the counts, not the prose:
  // rebuild the line from this week's trophy contracts when the two disagree.
  const trophyCountWeek = isNum(h.trophy_count) ? (h.trophy_count as number) : tierWeek.trophy.count;
  const typicalMatch = /typical\s*~?\s*([\d.]+)/i.exec(sw?.trophy_read ?? "");
  const typicalTail = typicalMatch ? ` Typical week runs about ${typicalMatch[1]}.` : "";
  const feedSaysNone = /^\s*no trophy/i.test(sw?.trophy_read ?? "");
  const trophyRead =
    isNum(trophyCountWeek) && (trophyCountWeek as number) > 0 && feedSaysNone
      ? `${fmtInt(trophyCountWeek)} trophy (${trophyCutoffM}+) contract${(trophyCountWeek as number) === 1 ? "" : "s"} signed this week${
          isNum(tierWeek.trophy.volume) ? `, ${fmtMoneyShort(tierWeek.trophy.volume as number)} in volume` : ""
        }.${typicalTail}`
      : (sw?.trophy_read ?? null);

  const tierCol = (

    label: string,
    pctLabel: string,
    cutoff: number | null,
    cutoffWowPct: number | null,
    cutoffYoyPct: number | null,
    ppsf: number | null,
    ppsfWowPct: number | null,
    ppsfYoyPct: number | null,
    vol52wk: number | null,
    volWowPct: number | null,
    volYoyPct: number | null,
    cleared: number | null,
    clearedWowPct: number | null,
    clearedYoyPct: number | null,
    median52: number | null,
    dom52: number | null,
    week: { count: number | null; volume: number | null; countWow: number | null; countYoy: number | null; volWow: number | null; volYoy: number | null },
  ) => {

    const pctBadge = (pct: number | null, suffix: "WoW" | "YoY") => {
      if (!isNum(pct)) return "";
      if (pct > 0) return `<span class="ldr-badge ldr-badge-up">▲ ${pct.toFixed(0)}% ${suffix}</span>`;
      if (pct < 0) return `<span class="ldr-badge ldr-badge-dn">▼ ${Math.abs(pct).toFixed(0)}% ${suffix}</span>`;
      return `<span class="ldr-badge ldr-badge-zero">flat ${suffix}</span>`;
    };
    const valWrap = (val: string, wow: number | null, yoy: number | null) => {
      const badges = `${pctBadge(yoy, "YoY")}${pctBadge(wow, "WoW")}`;
      return `<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px"><span class="pulse-row__val">${val}</span><div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;min-height:19px">${badges}</div></div>`;
    };
    const emptyVal = `<span class="stat-empty">${EMPTY}</span>`;
    const statRow = (rowLabel: string, val: string | null, wow: number | null, yoy: number | null) =>
      `<div class="pulse-row"><span class="pulse-row__label">${rowLabel}</span>${val !== null ? valWrap(val, wow, yoy) : `<span class="pulse-row__val">${emptyVal}</span>`}</div>`;
    const tierColor = label === "Luxury" ? "#98A0A8" : label === "Prime" ? "#918C7E" : "#A37670";
    return `<div class="tier-col">
      <div class="tier-col__label">${label} &middot; ${pctLabel}</div>
      <div class="tier-col__rule" style="height:3px;width:40px;background:${tierColor};margin-bottom:16px;border-radius:1px;"></div>
      <div class="tier-col__price" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">${fmtMoneyM(cutoff)}${pctBadge(cutoffYoyPct, "YoY")}${pctBadge(cutoffWowPct, "WoW")}</div>
      <div class="tier-col__stats">
        ${statRow("Contracts", isNum(week.count) ? fmtInt(week.count) : null, week.countWow, week.countYoy)}
        ${statRow("Volume", isNum(week.volume) ? fmtMoneyShort(week.volume) : null, week.volWow, week.volYoy)}
      </div>
      <details class="tw-tier-detail">
        <summary>Trailing 52-week detail</summary>
        <div class="tw-tier-detail__body">
          ${statRow("Median price", isNum(median52) ? fmtMoneyM(median52) : null, null, null)}
          ${statRow("Avg $ / sq ft", isNum(ppsf) ? fmtCurrencyInt(ppsf) : null, ppsfWowPct, ppsfYoyPct)}
          ${statRow("Days on market", isNum(dom52) ? fmtInt(Math.round(dom52)) : null, null, null)}
          ${statRow("Volume · 52-week trailing", isNum(vol52wk) ? fmtMoneyShort(vol52wk) : null, volWowPct, volYoyPct)}
          ${statRow("Signed · 52-week trailing", isNum(cleared) ? fmtInt(cleared) : null, clearedWowPct, clearedYoyPct)}
        </div>
      </details>
    </div>`;
  };


  // Concentration (hood-compare) — computed from leaderboard vs. hero totals
  const top10 = p.leaderboard.slice(0, 10);
  const top10Contracts = top10.reduce((s, r) => s + (isNum(r.wk_contracts) ? r.wk_contracts : 0), 0);
  const top10Volume = top10.reduce((s, r) => s + (isNum(r.wk_volume) ? r.wk_volume : 0), 0);
  const contractsShare =
    isNum(h.luxury_count) && h.luxury_count > 0 ? (top10Contracts / h.luxury_count) * 100 : null;
  const volumeShare =
    isNum(h.luxury_volume) && h.luxury_volume > 0 ? (top10Volume / h.luxury_volume) * 100 : null;
  const top10AvgDeal = top10Contracts > 0 ? top10Volume / top10Contracts : null;
  const boroughAvgDeal =
    isNum(h.luxury_volume) && isNum(h.luxury_count) && h.luxury_count > 0
      ? h.luxury_volume / h.luxury_count
      : null;

  // ── Hero grid: three exclusive price bands ──────────────────────────
  // Counts and volumes arrive cumulative (at-or-above). Each band shows only
  // the contracts that cleared its own floor but not the floor above it.
  const sub = (a: number | null | undefined, b: number | null | undefined): number | null =>
    isNum(a) ? Math.max(0, a - (isNum(b) ? b : 0)) : null;
  const heroBands = [
    {
      key: "p90",
      name: "Luxury",
      floor: luxCutoffM,
      band: `${luxCutoffM} to ${primeCutoffM}`,
      count: sub(h.luxury_count, h.prime_count),
      volume: sub(h.luxury_volume, h.prime_volume),
    },
    {
      key: "p95",
      name: "Prime",
      floor: primeCutoffM,
      band: `${primeCutoffM} to ${trophyCutoffM}`,
      count: sub(h.prime_count, h.trophy_count),
      volume: sub(h.prime_volume, h.trophy_volume),
    },
    {
      key: "p99",
      name: "Trophy",
      floor: trophyCutoffM,
      band: `${trophyCutoffM} and above`,
      count: isNum(h.trophy_count) ? h.trophy_count : null,
      volume: isNum(h.trophy_volume) ? h.trophy_volume : null,
    },
  ];
  const heroTierCells = heroBands
    .map(
      (b) => `
    <div class="hero-cell">
      <div class="hero-tier ${b.key}">${b.name}</div>
      <div class="hero-floor ${b.key}">${b.floor}<span class="hero-floor-lbl">Entry price</span></div>
      <div class="hero-num">${isNum(b.count) ? fmtInt(b.count) : `<span class="stat-empty">${EMPTY}</span>`}${provStar}</div>
      <div class="hero-sub">contracts signed this week</div>
      <div class="hero-sub" style="margin-top:8px">${isNum(b.volume) && b.volume > 0 ? fmtMoneyShort(b.volume) : `<span class="stat-empty">${EMPTY}</span>`} in dollar volume</div>
      <span class="hero-band">${b.band}</span>
    </div>`,
    )
    .join("");


  const defaultTitle = `Manhattan Luxury:<br>The Week <span style="color:var(--text-dim);font-weight:400;">• Week of ${fmtWeekRange(row.week_start, row.week_end)}</span>`;
  const defaultMeta = `Updates every Monday for the prior week`;
  const titleHtml = opts.titleHtml ?? defaultTitle;
  const metaHtml = opts.metaHtml ?? defaultMeta;
  const bannerHtml = opts.bannerHtml ?? "";

  return `
<header class="tw-masthead tw-masthead--photo">
  <img class="tw-masthead__bg" src="${WEEK_HERO.url}" alt="${WEEK_HERO.caption}" />
  <div>
    <div class="tw-masthead__brand">Domi Data™ Luxury Lines</div>
    <h1 class="tw-masthead__title">${titleHtml}</h1>
  </div>
  <div class="tw-masthead__meta">${metaHtml}</div>
</header>


${bannerHtml}

<details class="toc qr-toc-sticky" open>
  <summary class="toc-summary"><span>Contents</span><span class="toc-chevron" aria-hidden="true"></span></summary>
  <span class="toc-label">Contents</span>
  <div class="toc-panel">
    <div class="toc-items">
      <a class="toc-item" href="#top-deals">1 &middot; Top 5 Deals</a>
      <a class="toc-item" href="#momentum">2 &middot; Momentum</a>
      <a class="toc-item" href="#luxury-lines">3 &middot; Luxury Lines</a>
      <a class="toc-item" href="#market-pulse">4 &middot; Market Pulse</a>
      <a class="toc-item" href="#unit-breakdown">5 &middot; Unit Breakdown</a>
      <a class="toc-item" href="#neighborhoods">6 &middot; Neighborhoods</a>
      <a class="toc-item" href="#supply-absorption">7 &middot; Supply &amp; Absorption</a>
      <a class="toc-item" href="#property-type">8 &middot; By Property Type</a>
      <a class="toc-item" href="#methodology" onclick="var b=document.querySelector('.chart-toggle__btn[data-target=&quot;methodology-panel&quot;]'); if(b&amp;&amp;b.getAttribute('aria-expanded')!=='true'){b.click();}">Methodology</a>
    </div>
  </div>
</details>


<section class="section">
  <div class="hero-grid">
    ${heroTierCells}
    <div class="hero-cell hero-wide">
      <div class="hero-wide__title">Top 10 Neighborhoods &middot; Week of ${fmtWeekRange(row.week_start, row.week_end)}</div>
      <div class="hero-wide__stats">
        <div>
          <div class="hero-wide__val">${isNum(volumeShare) ? Math.round(volumeShare) + "%" : `<span class="stat-empty">${EMPTY}</span>`}</div>
          <div class="hero-wide__cap">of this week's Luxury dollar volume</div>
        </div>
        <div>
          <div class="hero-wide__val">${top10Volume > 0 ? fmtMoneyShort(top10Volume) : `<span class="stat-empty">${EMPTY}</span>`}</div>
          <div class="hero-wide__cap">Luxury dollar volume in the top 10 neighborhoods</div>
        </div>
        <div>
          <div class="hero-wide__val">${top10Contracts > 0 ? fmtInt(top10Contracts) : `<span class="stat-empty">${EMPTY}</span>`}</div>
          <div class="hero-wide__cap">Luxury contracts signed in the top 10 neighborhoods</div>
        </div>
      </div>
    </div>
    <div class="hero-cell hero-wide">
      <div class="hero-wide__title">Manhattan Market Snapshot &middot; Week of ${fmtWeekRange(row.week_start, row.week_end)}</div>
      <div class="hero-wide__stats">
        <div>
          <div class="hero-wide__val">${isNum(h.median_price) ? fmtMoneyM(h.median_price) : `<span class="stat-empty">${NONE_LINE}</span>`}</div>
          <div class="hero-wide__cap">Median luxury deal price (Top 10%)</div>
        </div>
        <div>
          <div class="hero-wide__val">${isNum(h.median_ppsf) ? fmtCurrencyInt(h.median_ppsf) : `<span class="stat-empty">${EMPTY}</span>`}</div>
          <div class="hero-wide__cap">Median price per sq ft (Top 10%)</div>
        </div>
        <div>
          <div class="hero-wide__val">${isNum(h.avg_dom) ? Math.round(h.avg_dom) : `<span class="stat-empty">${EMPTY}</span>`}</div>
          <div class="hero-wide__cap">Avg days on market (Top 10%)</div>
        </div>
      </div>
    </div>
  </div>
  ${provNote}
  ${sw ? sowhatCallout(sw.volume_read, "Volume read") : ""}
</section>

<section class="section" id="top-deals">
  <div class="section__eyebrow">This week's headliners · Week of ${fmtWeekRange(row.week_start, row.week_end)}</div>
  <h2 class="section__title">Top 5 Deals of the Week</h2>
  <p class="section__note"><strong>The week's five highest signed-contract prices across Manhattan.</strong></p>
  ${topDeals}
</section>

${
  (p.tier_series?.length ?? 0) > 0
    ? `<!-- MOMENTUM -->
<section class="section" id="momentum">
  <div class="section__eyebrow">${p.tier_series!.length}-week momentum</div>
  <h2 class="section__title">Tier Momentum</h2>
  <p class="section__note">Luxury, Prime, and Trophy tracked week by week across five measures. Bands are exclusive: a Trophy contract is counted once, in Trophy.</p>
  <div class="tw-momentum">
    <div class="tw-momentum__toggle" role="group" aria-label="Choose a momentum measure">
      <button type="button" class="is-active" data-metric="count">Contracts</button>
      <button type="button" data-metric="volume">Dollar volume</button>
      <button type="button" data-metric="median">Median price</button>
      <button type="button" data-metric="ppsf">Price per sq ft</button>
      <button type="button" data-metric="dom">Days on market</button>
    </div>
    <p class="tw-momentum__hint" id="momentum-hint">Weekly signed contracts by tier.</p>
    <div class="tw-momentum__legend">
      <span><i style="background:#98A0A8"></i>Luxury</span>
      <span><i style="background:#918C7E"></i>Prime</span>
      <span><i style="background:#A37670"></i>Trophy</span>
      <em>Weeks with no contracts in a tier are skipped and the line continues.</em>
    </div>
    <div class="momentum-chart-holder chart-holder qr-no-wm">
      <canvas id="momentum-chart" role="img" aria-label="Weekly tier momentum chart" aria-describedby="momentum-hint"></canvas>
    </div>
    ${
      p.tier_series_methodology_note
        ? `<p class="tw-momentum__note">${esc(p.tier_series_methodology_note.replace(/\s+[–—]\s+/g, ". ").replace(/\s--\s/g, ". "))}</p>`
        : ""
    }
  </div>
</section>
`
    : ""
}

<!-- LUXURY LINES -->
<section class="section" id="luxury-lines">
  <div class="section__eyebrow">Market structure · Week of ${fmtWeekRange(row.week_start, row.week_end)}</div>
  <h2 class="section__title">The Luxury Lines</h2>
  <p class="section__note" style="max-width:none;">Three tiers measured by the trailing 52 weeks of actual Manhattan signed contracts. Entry prices update weekly as new data enters the window. Median price and days on market are 52-week trailing figures, weighted by weekly contract count.</p>
  <div class="tier-total">
    <div class="tier-total__label">
      <span class="tier-total__head">
        Luxury segment total &middot; Week of ${fmtWeekRange(row.week_start, row.week_end)}
        <span class="tier-total__chip" tabindex="0" role="note" aria-label="What counts: every Manhattan contract signed this week at or above the Luxury entry price${isNum(t.luxury.cutoff) ? ` of ${fmtCurrencyInt(t.luxury.cutoff)}` : ""}, the Top 10% line set by the trailing 52 weeks of signed contracts. The three tiers below split that total into separate price bands, so they add up to it." title="Every Manhattan contract signed this week at or above the Luxury entry price${isNum(t.luxury.cutoff) ? ` of ${fmtCurrencyInt(t.luxury.cutoff)}` : ""} (the Top 10% line, set by the trailing 52 weeks of signed contracts). The three tiers below split that total into separate price bands, so they add up to it.">What counts</span>
      </span>
      <span class="tier-total__sub">Every contract signed this week at or above the Top 10% line${isNum(t.luxury.cutoff) ? `, currently ${fmtCurrencyInt(t.luxury.cutoff)}` : ""}. The three tiers below split this total into separate price bands: Luxury, then Prime, then Trophy. They add up to it.</span>
    </div>
    <div class="tier-total__figs">
      <div class="tier-total__fig">
        <div class="tier-total__num">${isNum(h.luxury_count) ? fmtInt(h.luxury_count) : `<span class="stat-empty">${EMPTY}</span>`}</div>
        <div class="tier-total__cap">Contracts</div>
        <div class="tier-total__pills">${sfxPill(h.luxury_count_yoy_pct ?? null, "YoY")}${sfxPill(h.luxury_count_vs_lastweek_pct ?? h.luxury_count_wow_pct ?? null, "WoW")}</div>
      </div>
      <div class="tier-total__fig">
        <div class="tier-total__num">${isNum(h.luxury_volume) ? fmtMoneyShort(h.luxury_volume) : `<span class="stat-empty">${EMPTY}</span>`}</div>
        <div class="tier-total__cap">Dollar volume</div>
        <div class="tier-total__pills">${sfxPill(h.luxury_volume_yoy_pct ?? null, "YoY")}${sfxPill(h.luxury_volume_vs_lastweek_pct ?? h.luxury_volume_wow_pct ?? null, "WoW")}</div>
      </div>
    </div>
  </div>
  <div class="tier-grid">
    ${tierCol("Luxury", "Top 10%", t.luxury.cutoff, t.luxury.cutoff_wow_pct ?? null, t.luxury.cutoff_yoy_pct ?? null, t.luxury.ppsf_avg, t.luxury.ppsf_avg_wow_pct, t.luxury.ppsf_avg_yoy_pct, t.luxury.volume_52wk, t.luxury.volume_52wk_wow_pct, t.luxury.volume_52wk_yoy_pct, t.luxury.cleared_52wk, t.luxury.cleared_52wk_wow_pct, t.luxury.cleared_52wk_yoy_pct, tierTrailing.luxury.median, tierTrailing.luxury.dom, tierWeek.luxury)}
    <div class="tier-divider"></div>
    ${tierCol("Prime", "Top 5%", t.prime.cutoff, t.prime.cutoff_wow_pct ?? null, t.prime.cutoff_yoy_pct ?? null, t.prime.ppsf_avg, t.prime.ppsf_avg_wow_pct, t.prime.ppsf_avg_yoy_pct, t.prime.volume_52wk, t.prime.volume_52wk_wow_pct, t.prime.volume_52wk_yoy_pct, t.prime.cleared_52wk, t.prime.cleared_52wk_wow_pct, t.prime.cleared_52wk_yoy_pct, tierTrailing.prime.median, tierTrailing.prime.dom, tierWeek.prime)}
    <div class="tier-divider"></div>
    ${tierCol("Trophy", "Top 1%", t.trophy.cutoff, t.trophy.cutoff_wow_pct ?? null, t.trophy.cutoff_yoy_pct ?? null, t.trophy.ppsf_avg, t.trophy.ppsf_avg_wow_pct, t.trophy.ppsf_avg_yoy_pct, t.trophy.volume_52wk, t.trophy.volume_52wk_wow_pct, t.trophy.volume_52wk_yoy_pct, t.trophy.cleared_52wk, t.trophy.cleared_52wk_wow_pct, t.trophy.cleared_52wk_yoy_pct, tierTrailing.trophy.median, tierTrailing.trophy.dom, tierWeek.trophy)}
  </div>
  ${opts.showChecks ? tierCheckHtml : ""}




  ${sw ? sowhatCallout(trophyRead, "Trophy read") : ""}
</section>


<!-- MARKET PULSE -->
<section class="section" id="market-pulse">
  <div class="section__eyebrow">Full market · week of ${fmtWeekRange(row.week_start, row.week_end)}</div>
  <h2 class="section__title">Manhattan Market Pulse</h2>

  <div id="week-read-badge" class="${badgeClass}">${esc(badgeText)}</div>
  <div class="pulse-block">
  ${sw ? sowhatCallout([sw.pace_read, sw.discount_read].filter(Boolean).join(" "), "Pace & discount read") : ""}

  <div class="pulse-summary">
    <div class="pulse-summary__metric">
      <div class="pulse-summary__num">${isNum(mp.contracts) ? fmtInt(mp.contracts) : `<span class="stat-empty">${EMPTY}</span>`}</div>
      <div class="pulse-summary__label">Signed Contracts · All Manhattan Residential</div>
      ${mpCountBadge}
    </div>
    <div class="pulse-summary__metric">
      <div class="pulse-summary__num">${isNum(mp.volume) ? fmtMoneyShort(mp.volume) : `<span class="stat-empty">${EMPTY}</span>`}</div>
      <div class="pulse-summary__label">Total Dollar Volume · All Manhattan</div>
      ${mpVolBadge}
    </div>
  </div>
  </div>

  <div class="pulse-grid">
    ${buildPulseCol("Condos", p.market_pulse.by_type.condo)}
    ${buildPulseCol("Co-ops", p.market_pulse.by_type.coop)}
    ${buildPulseCol("Townhouses", p.market_pulse.by_type.townhouse)}
  </div>
</section>

<!-- BEDROOM MIX -->
<section class="section" id="unit-breakdown">
  <div class="section__eyebrow">Unit breakdown · Week of ${fmtWeekRange(row.week_start, row.week_end)}</div>
  <h2 class="section__title">Contracts and Volume by Unit Size</h2>
  <p class="section__note" style="max-width:none;">Where activity concentrates this week: by bedroom count, determined by number of deals and total dollar volume.</p>
  ${(() => {
    const bm = p.bedroom_mix;
    const hasVol =
      !!bm &&
      !!bm.volume &&
      Object.values(bm.volume).some((v) => isNum(v) && v > 0);
    const hasCount =
      !!bm &&
      !!bm.count &&
      Object.values(bm.count).some((v) => isNum(v) && v > 0);
    if (!hasVol && !hasCount) {
      return `<div class="trophy-callout"><div class="trophy-callout--empty">Bedroom mix unavailable this week.</div></div>`;
    }
    const bedroomOrder = ["studio", "1", "2", "3", "4+"];
    const bedroomLabels: Record<string, string> = { studio: "Studio", "1": "1-Bed", "2": "2-Bed", "3": "3-Bed", "4+": "4+ Beds" };
    const volBlock = hasVol
      ? `<div class="donut-wrap">
      <div class="donut-title">Dollar volume</div>
      <div class="donut-canvas-wrap"><canvas id="donut-volume" width="360" height="360" role="img" aria-label="Dollar volume by unit size" aria-describedby="donut-volume-desc"></canvas></div>
      ${srSummary(
        "donut-volume-desc",
        describeParts(
          "Donut chart of dollar volume by unit size",
          bedroomOrder.map((k) => ({ label: bedroomLabels[k], value: Number(bm!.volume![k] ?? 0) })).filter((d) => d.value > 0),
          fmtMoneyM,
        ),
      )}
      ${srTable(
        "Dollar volume by unit size",
        ["Unit size", "Dollar volume"],
        bedroomOrder
          .map((k) => [bedroomLabels[k], Number(bm!.volume![k] ?? 0)] as [string, number])
          .filter((r) => r[1] > 0),
      )}
    </div>`
      : `<div class="donut-wrap"><div class="donut-title">Dollar volume</div><div class="trophy-callout--empty">Unavailable this week.</div></div>`;
    const cntBlock = hasCount
      ? `<div class="donut-wrap">
      <div class="donut-title">Contracts signed</div>
      <div class="donut-canvas-wrap"><canvas id="donut-count" width="360" height="360" role="img" aria-label="Contracts by unit size" aria-describedby="donut-count-desc"></canvas></div>
      ${srSummary(
        "donut-count-desc",
        describeParts(
          "Donut chart of contracts signed by unit size",
          bedroomOrder.map((k) => ({ label: bedroomLabels[k], value: Number(bm!.count![k] ?? 0) })).filter((d) => d.value > 0),
        ),
      )}
      ${srTable(
        "Contracts signed by unit size",
        ["Unit size", "Contracts"],
        bedroomOrder
          .map((k) => [bedroomLabels[k], Number(bm!.count![k] ?? 0)] as [string, number])
          .filter((r) => r[1] > 0),
      )}
    </div>`
      : `<div class="donut-wrap"><div class="donut-title">Contracts signed</div><div class="trophy-callout--empty">Unavailable this week.</div></div>`;

    return `<div class="donut-grid">${volBlock}${cntBlock}</div>`;
  })()}
</section>

<section class="section" id="quick-compare">
  <div class="section__eyebrow">Three ways to read the same market · Week of ${fmtWeekRange(row.week_start, row.week_end)}</div>
  <h2 class="section__title">Quick Compare</h2>
  <p class="section__note" style="max-width:none;margin-bottom:20px;">Same underlying data, three different questions. Full details for the volume ranking is below; Most Concentrated and The Week's Activity are summarized here only.</p>
  <div class="qc-grid">
    <div class="qc-card">
      <div class="qc-card__head">
        <p class="qc-card__title">Most Concentrated</p>
        <span class="qc-card__cadence">52-week % Lux &middot; min. 11 qualifying deals &middot; updates weekly</span>
      </div>
      <table class="qc-tbl">
        <thead><tr><th><span class="sr-only">Rank</span></th><th>Neighborhood</th><th class="r">% Lux</th></tr></thead>
        <tbody>${buildQCConcentratedRows(p.concentrated_leaderboard)}</tbody>
      </table>
      <p class="qc-card__note">Where luxury deals make up the largest share of local sales.</p>
    </div>
    <div class="qc-card">
      <div class="qc-card__head">
        <p class="qc-card__title">Largest Luxury Markets</p>
        <span class="qc-card__cadence">52-week $ volume &middot; updates weekly</span>
      </div>
      <table class="qc-tbl">
        <thead><tr><th><span class="sr-only">Rank</span></th><th>Neighborhood</th><th class="r">Luxury $ Vol</th></tr></thead>
        <tbody>${buildQCVolumeRows(p.leaderboard)}</tbody>
      </table>
      <p class="qc-card__note">Where the luxury business is largest, measured by total dollar volume.</p>
    </div>
    <div class="qc-card qc-card--activity">
      <div class="qc-card__head">
        <p class="qc-card__title">The Week's Activity</p>
        <span class="qc-card__cadence">Signed contracts &middot; week of ${fmtWeekRange(row.week_start, row.week_end)}</span>
      </div>
      <table class="qc-tbl">
        <thead><tr><th><span class="sr-only">Rank</span></th><th>Neighborhood</th><th class="r">Signed</th><th class="r">Volume</th></tr></thead>
        <tbody>${buildQCActivityRows(p.weekly_activity_leaderboard)}</tbody>
      </table>
      <p class="qc-card__note">This week's most active neighborhoods by signed contracts. Tags show where a neighborhood also ranks. C = Most Concentrated, L = Largest Markets.</p>
    </div>

  </div>
</section>

<!-- LEADERBOARD -->
<section class="section" id="neighborhoods">
  <div class="section__eyebrow">Neighborhood breakdown · Week of ${fmtWeekRange(row.week_start, row.week_end)}</div>
  <h2 class="section__title">Luxury Leaderboard</h2>
  <p class="section__note" style="max-width:none;margin-bottom:4px;">Top 10 Manhattan neighborhoods ranked by 52-week luxury dollar volume above the ${luxCutoffM} borough threshold.</p>
  <p class="section__note" style="max-width:none;margin-top:0;"><b>Neighborhood (NBHB) Median</b> is the median price among that neighborhood's own contracts above the ${luxCutoffM} threshold.</p>

  <div class="hood-compare">
    <div class="hood-compare__item">
      <div class="hood-compare__pct">${isNum(contractsShare) ? Math.round(contractsShare) + "%" : `<span class="stat-empty">${EMPTY}</span>`}</div>
      <div class="hood-compare__label">of The Week's Luxury Contracts</div>
      <div class="hood-compare__context">${top10Contracts.toFixed(0)} of ${isNum(h.luxury_count) ? h.luxury_count : EMPTY} signed this week</div>
    </div>
    <div class="hood-compare__item">
      <div class="hood-compare__pct">${isNum(volumeShare) ? Math.round(volumeShare) + "%" : `<span class="stat-empty">${EMPTY}</span>`}</div>
      <div class="hood-compare__label">of The Week's Luxury Dollar Volume</div>
      <div class="hood-compare__context">${fmtMoneyShort(top10Volume)} of ${fmtMoneyShort(h.luxury_volume)} this week</div>
    </div>
    <div class="hood-compare__item">
      <div class="hood-compare__pct">${isNum(top10AvgDeal) ? fmtMoneyM(top10AvgDeal, 1) : `<span class="stat-empty">${EMPTY}</span>`}</div>
      <div class="hood-compare__label">Avg Deal Size in Top 10</div>
      <div class="hood-compare__context">borough avg ${isNum(boroughAvgDeal) ? fmtMoneyM(boroughAvgDeal, 1) : EMPTY}</div>
    </div>
  </div>

  <div class="ldr-card">
    <div class="ldr-toolbar">
      <span class="ldr-toolbar-label">Top 10 · Ranked by 52-week luxury dollar volume</span>
    </div>
    <div class="ldr-scroll">
      <table class="ldr-tbl">
        <thead>
          <tr class="ldr-grp">
            <th colspan="7" class="grp-baseline">52-week baseline</th>
            <th colspan="3" class="grp-current">this week</th>
          </tr>
          <tr>
            <th><span class="sr-only">Rank</span></th>
            <th>Neighborhood</th>
            <th>Luxury Dollar Volume</th>
            <th class="r">Contracts</th>
            <th class="r">Nbhd Median</th>
            <th class="r">Avg Sale</th>
            <th class="r">% Lux</th>
            <th class="r section-start">Contracts</th>
            <th class="r">Volume</th>
            <th class="r">Rank vs. 1yr Ago</th>
          </tr>
        </thead>
        <tbody>${buildLeaderboardRows(p.leaderboard)}</tbody>
      </table>
    </div>
    <div class="ldr-foot">
      <div class="ldr-leg"><span class="ldr-badge ldr-badge-up">▲N</span> Moved up N spots in volume rank vs. one year ago</div>
      <div class="ldr-leg"><span class="ldr-badge ldr-badge-dn">▼N</span> Moved down N spots in volume rank vs. one year ago</div>
      <div class="ldr-leg"><span class="ldr-badge ldr-badge-zero">◆</span> Same rank as one year ago</div>
    </div>
  </div>




  <p class="hood-note"><b>Nbhd Median</b> = median price among that neighborhood's own contracts above the ${luxCutoffM} threshold. <b>Avg Sale</b> = avg price of contracts above the ${luxCutoffM} borough floor. <b>% Lux</b> = share of neighborhood contracts above the ${luxCutoffM} floor.</p>
  ${sw ? sowhatCallout(sw.neighborhood_mover_read, "Neighborhood mover") : ""}
</section>

<!-- SUPPLY & ABSORPTION -->
<section class="section" id="supply-absorption">
  <div class="section__eyebrow">Inventory · Week of ${fmtWeekRange(row.week_start, row.week_end)}</div>
  <h2 class="section__title">Supply and Absorption</h2>
  <p class="section__note" style="max-width:none;">What luxury inventory exists, how fast it's moving, and what that means for buyers and sellers right now.</p>
  <div class="supply-dual">
    <div class="supply-half">
      <div class="supply-half__head">Luxury market &nbsp;·&nbsp; ${luxCutoffM}+</div>
      <div class="supply-strip" style="flex-direction:column;gap:24px;border:none;padding:0">
        <div class="supply-stat" style="border-right:none;margin-right:0;padding-right:0">
          <div class="supply-stat__label">Active listings</div>
          <div class="supply-stat__val">${isNum(p.supply.luxury.active) ? fmtInt(p.supply.luxury.active) : `<span class="stat-empty">${EMPTY}</span>`}</div>
          ${supplyBadges(p.supply.luxury.active_wow_pct, p.supply.luxury.active_yoy_pct)}
        </div>
        <div class="supply-stat" style="border-right:none;margin-right:0;padding-right:0">
          <div class="supply-stat__label">Months of supply</div>
          <div class="supply-stat__val">${isNum(p.supply.luxury.months_supply) ? p.supply.luxury.months_supply.toFixed(1) : `<span class="stat-empty">${EMPTY}</span>`}</div>
          ${supplyBadges(p.supply.luxury.months_supply_wow_pct, p.supply.luxury.months_supply_yoy_pct)}
          <div class="supply-stat__context">Above 9 months = buyer's market</div>
        </div>
        <div class="supply-stat" style="border-right:none;margin-right:0;padding-right:0">
          <div class="supply-stat__label">Monthly absorption</div>
          <div class="supply-stat__val">${isNum(p.supply.luxury.absorption_pct) ? p.supply.luxury.absorption_pct.toFixed(1) + "%" : `<span class="stat-empty">${EMPTY}</span>`}</div>
          ${supplyBadges(p.supply.luxury.absorption_pct_wow_pct, p.supply.luxury.absorption_pct_yoy_pct)}
        </div>
      </div>
    </div>
    <div class="supply-divider"></div>
    <div class="supply-half">
      <div class="supply-half__head">All Manhattan residential</div>
      <div class="supply-strip" style="flex-direction:column;gap:24px;border:none;padding:0">
        <div class="supply-stat" style="border-right:none;margin-right:0;padding-right:0">
          <div class="supply-stat__label">Active listings</div>
          <div class="supply-stat__val">${isNum(p.supply.all.active) ? fmtInt(p.supply.all.active) : `<span class="stat-empty">${EMPTY}</span>`}</div>
          ${supplyBadges(p.supply.all.active_wow_pct, p.supply.all.active_yoy_pct)}
        </div>
        <div class="supply-stat" style="border-right:none;margin-right:0;padding-right:0">
          <div class="supply-stat__label">Months of supply</div>
          <div class="supply-stat__val">${isNum(p.supply.all.months_supply) ? p.supply.all.months_supply.toFixed(1) : `<span class="stat-empty">${EMPTY}</span>`}</div>
          ${supplyBadges(p.supply.all.months_supply_wow_pct, p.supply.all.months_supply_yoy_pct)}
        </div>
        <div class="supply-stat" style="border-right:none;margin-right:0;padding-right:0">
          <div class="supply-stat__label">Monthly absorption</div>
          <div class="supply-stat__val">${isNum(p.supply.all.absorption_pct) ? p.supply.all.absorption_pct.toFixed(1) + "%" : `<span class="stat-empty">${EMPTY}</span>`}</div>
          ${supplyBadges(p.supply.all.absorption_pct_wow_pct, p.supply.all.absorption_pct_yoy_pct)}
        </div>
      </div>
    </div>
  </div>
  ${sw ? sowhatCallout(sw.supply_read, "Supply read") : ""}




  ${
    p.supply.supply_series.luxury.length > 0 || p.supply.supply_series.all.length > 0
      ? `<div class="supply-chart-group">
    <div class="section__eyebrow" style="margin-bottom:6px">Active luxury supply · 52-week trailing</div>
    <div class="chart-toggle">
      <button class="chart-toggle__btn" aria-expanded="true" data-target="supply-chart-panel">
        <span>Collapse</span>
        <span class="chart-toggle__icon">▼</span>
      </button>
      <div class="chart-toggle__panel" id="supply-chart-panel">
        <canvas id="supply-chart" role="img" aria-label="Active supply — luxury vs prime vs all Manhattan residential (shared log scale)" aria-describedby="supply-chart-desc"></canvas>
        ${srSummary(
          "supply-chart-desc",
          describeSeries(
            "Line chart of active supply on a shared logarithmic scale",
            (p.demand_trend.labels && p.demand_trend.labels.length === p.supply.supply_series.luxury.length
              ? p.demand_trend.labels
              : p.supply.supply_series.luxury.map((_, i) => `week ${i + 1} of ${p.supply.supply_series.luxury.length}`)) as string[],
            [
              { name: "Luxury active listings", values: p.supply.supply_series.luxury as Array<number | null> },
              { name: "Prime active listings", values: (p.supply.supply_series.prime ?? []) as Array<number | null> },
              { name: "All Manhattan active listings", values: p.supply.supply_series.all as Array<number | null> },
            ],
          ),
        )}
        ${srTable(
          "Active supply — luxury vs prime vs all Manhattan residential",
          ["Week", "Luxury active", "Prime active", "All Manhattan active"],
          zipSeries(
            (p.demand_trend.labels ?? p.supply.supply_series.luxury.map((_, i) => `Week ${i + 1}`)) as string[],
            [
              p.supply.supply_series.luxury as Array<number | null>,
              (p.supply.supply_series.prime ?? []) as Array<number | null>,
              p.supply.supply_series.all as Array<number | null>,
            ],
          ),
        )}

        <div class="chart-legend">
          <div class="chart-legend__item"><div class="chart-legend__mark" style="background:#98A0A8"></div>Luxury ${luxCutoffM}+ &nbsp;·&nbsp; ${fmtInt(p.supply.luxury.active)} active</div>
          <div class="chart-legend__item"><div class="chart-legend__mark" style="background:#918C7E"></div>Prime ${primeCutoffM}+ &nbsp;·&nbsp; ${fmtInt(p.supply.prime?.active ?? null)} active</div>
          <div class="chart-legend__item"><div class="chart-legend__mark" style="background:rgba(107,101,96,0.6)"></div>All Manhattan residential &nbsp;·&nbsp; ${fmtInt(p.supply.all.active)} active</div>
        </div>
      </div>
    </div>
  </div>`
      : ""
  }

  ${
    p.supply.dom_series.luxury.length > 0
      ? `<div class="supply-chart-group">
    <div class="section__eyebrow" style="margin-bottom:6px">Days on market · 52-week trailing</div>
    <div class="chart-toggle">
      <button class="chart-toggle__btn" aria-expanded="true" data-target="dom-chart-panel">
        <span>Collapse</span>
        <span class="chart-toggle__icon">▼</span>
      </button>
      <div class="chart-toggle__panel" id="dom-chart-panel">
        <canvas id="dom-chart" role="img" aria-label="Average days on market — luxury tiers vs all Manhattan" aria-describedby="dom-chart-desc"></canvas>
        ${srSummary(
          "dom-chart-desc",
          describeSeries(
            "Line chart of average days on market",
            (p.demand_trend.labels ?? p.supply.dom_series.luxury.map((_, i) => `Week ${i + 1}`)) as string[],
            [
              { name: "Luxury average days", values: p.supply.dom_series.luxury as Array<number | null>, fmt: (n) => `${Math.round(n)} days` },
              { name: "Luxury 95th percentile days", values: (p.supply.dom_series.luxury_p95 ?? []) as Array<number | null>, fmt: (n) => `${Math.round(n)} days` },
              { name: "All Manhattan average days", values: (p.supply.dom_series.all ?? []) as Array<number | null>, fmt: (n) => `${Math.round(n)} days` },
            ],
          ),
        )}
        ${srTable(
          "Average days on market — luxury tiers vs all Manhattan",
          ["Week", "Luxury (avg days)", "Luxury P95 (days)", "All Manhattan (avg days)"],
          zipSeries(
            (p.demand_trend.labels ?? p.supply.dom_series.luxury.map((_, i) => `Week ${i + 1}`)) as string[],
            [
              p.supply.dom_series.luxury as Array<number | null>,
              (p.supply.dom_series.luxury_p95 ?? []) as Array<number | null>,
              (p.supply.dom_series.all ?? []) as Array<number | null>,
            ],
          ),
        )}

        <div class="chart-legend">
          <div class="chart-legend__item"><div class="chart-legend__mark" style="background:#98A0A8"></div>Luxury ${luxCutoffM}+ &nbsp;·&nbsp; ${isNum(h.avg_dom) ? Math.round(h.avg_dom) + "-day avg" : EMPTY}</div>
          <div class="chart-legend__item"><div class="chart-legend__mark" style="background:#918C7E"></div>Prime ${primeCutoffM}+</div>
          <div class="chart-legend__item"><div class="chart-legend__mark" style="background:rgba(107,101,96,0.6)"></div>All Manhattan residential</div>
        </div>
        <div class="chart-sublabel">Average days between a listing's first ask and its signed contract, for that tier's contracts each week. Recent weeks are provisional and may revise as more contracts are recorded.</div>
      </div>
    </div>
  </div>`
      : ""
  }
  ${sw ? sowhatCallout(sw.dom_read, "Days-on-market read") : ""}
</section>

${
  p.type_trends && p.type_trends.labels && p.type_trends.labels.length > 0
    ? `<!-- BY PROPERTY TYPE -->
<section class="section" id="property-type">
  <div class="section__eyebrow">By property type · Week of ${fmtWeekRange(row.week_start, row.week_end)}</div>
  <h2 class="section__title">Condos, Co-ops, and Townhouses</h2>
  <p class="section__note" style="max-width:none;">Weekly trends across the three Manhattan residential property types over the trailing year. Signed contracts and recorded closings, each shown on a linear scale.</p>

  <div class="type-trends__group">
    <div class="type-trends__sub">Signed contracts</div>
    <div class="type-trends__grid">
      <div class="type-chart"><div class="type-chart__title">Contract count</div><canvas id="tt-contracts-count" role="img" aria-describedby="tt-contracts-count-desc" aria-label="Weekly signed contract count by property type"></canvas>${srSummary("tt-contracts-count-desc", describeSeries("Line chart of weekly signed contract count by property type", p.type_trends!.labels, [{ name: "Condo", values: p.type_trends!.contracts_count.condo as Array<number | null> }, { name: "Co-op", values: p.type_trends!.contracts_count.coop as Array<number | null> }, { name: "Townhouse", values: p.type_trends!.contracts_count.townhouse as Array<number | null> }]))}${srTable("Weekly signed contract count by property type", ["Week", "Condo", "Co-op", "Townhouse"], zipSeries(p.type_trends!.labels, [p.type_trends!.contracts_count.condo as Array<number | null>, p.type_trends!.contracts_count.coop as Array<number | null>, p.type_trends!.contracts_count.townhouse as Array<number | null>]))}</div>
      <div class="type-chart"><div class="type-chart__title">Total contract volume</div><canvas id="tt-contracts-volume" role="img" aria-describedby="tt-contracts-volume-desc" aria-label="Weekly signed contract dollar volume by property type"></canvas>${srSummary("tt-contracts-volume-desc", describeSeries("Line chart of weekly signed contract dollar volume by property type", p.type_trends!.labels, [{ name: "Condo", values: p.type_trends!.contracts_volume.condo as Array<number | null>, fmt: fmtMoneyM }, { name: "Co-op", values: p.type_trends!.contracts_volume.coop as Array<number | null>, fmt: fmtMoneyM }, { name: "Townhouse", values: p.type_trends!.contracts_volume.townhouse as Array<number | null>, fmt: fmtMoneyM }]))}${srTable("Weekly signed contract dollar volume by property type", ["Week", "Condo", "Co-op", "Townhouse"], zipSeries(p.type_trends!.labels, [p.type_trends!.contracts_volume.condo as Array<number | null>, p.type_trends!.contracts_volume.coop as Array<number | null>, p.type_trends!.contracts_volume.townhouse as Array<number | null>]))}</div>

    </div>
  </div>

  <div class="type-trends__group">
    <div class="type-trends__sub">Recorded sales</div>
    <div class="type-trends__grid type-trends__grid--three">
      <div class="type-chart"><div class="type-chart__title">Average sale price</div><canvas id="tt-sales-avgprice" role="img" aria-describedby="tt-sales-avgprice-desc" aria-label="Weekly average recorded sale price by property type"></canvas>${srSummary("tt-sales-avgprice-desc", describeSeries("Line chart of weekly average recorded sale price by property type", p.type_trends!.labels, [{ name: "Condo", values: p.type_trends!.sales_avgprice.condo as Array<number | null>, fmt: fmtMoneyM }, { name: "Co-op", values: p.type_trends!.sales_avgprice.coop as Array<number | null>, fmt: fmtMoneyM }, { name: "Townhouse", values: p.type_trends!.sales_avgprice.townhouse as Array<number | null>, fmt: fmtMoneyM }]))}${srTable("Weekly average recorded sale price by property type", ["Week", "Condo", "Co-op", "Townhouse"], zipSeries(p.type_trends!.labels, [p.type_trends!.sales_avgprice.condo as Array<number | null>, p.type_trends!.sales_avgprice.coop as Array<number | null>, p.type_trends!.sales_avgprice.townhouse as Array<number | null>]))}</div>
      <div class="type-chart"><div class="type-chart__title">Discount from first ask</div><canvas id="tt-sales-discount" role="img" aria-describedby="tt-sales-discount-desc" aria-label="Weekly average discount from first ask by property type"></canvas>${srSummary("tt-sales-discount-desc", describeSeries("Line chart of weekly average discount from first ask by property type", p.type_trends!.labels, [{ name: "Condo", values: p.type_trends!.sales_discount.condo as Array<number | null>, fmt: (n) => `${n.toFixed(1)} percent` }, { name: "Co-op", values: p.type_trends!.sales_discount.coop as Array<number | null>, fmt: (n) => `${n.toFixed(1)} percent` }, { name: "Townhouse", values: p.type_trends!.sales_discount.townhouse as Array<number | null>, fmt: (n) => `${n.toFixed(1)} percent` }]))}${srTable("Weekly average discount from first ask by property type (percent)", ["Week", "Condo", "Co-op", "Townhouse"], zipSeries(p.type_trends!.labels, [p.type_trends!.sales_discount.condo as Array<number | null>, p.type_trends!.sales_discount.coop as Array<number | null>, p.type_trends!.sales_discount.townhouse as Array<number | null>]))}</div>
      <div class="type-chart"><div class="type-chart__title">Price per square foot</div><canvas id="tt-sales-ppsf" role="img" aria-describedby="tt-sales-ppsf-desc" aria-label="Weekly recorded price per square foot by property type"></canvas>${srSummary("tt-sales-ppsf-desc", describeSeries("Line chart of weekly recorded price per square foot by property type", p.type_trends!.labels, [{ name: "Condo", values: p.type_trends!.sales_ppsf.condo as Array<number | null>, fmt: (n) => `$${Math.round(n).toLocaleString()} per square foot` }, { name: "Co-op", values: p.type_trends!.sales_ppsf.coop as Array<number | null>, fmt: (n) => `$${Math.round(n).toLocaleString()} per square foot` }, { name: "Townhouse", values: p.type_trends!.sales_ppsf.townhouse as Array<number | null>, fmt: (n) => `$${Math.round(n).toLocaleString()} per square foot` }]))}${srTable("Weekly recorded price per square foot by property type", ["Week", "Condo", "Co-op", "Townhouse"], zipSeries(p.type_trends!.labels, [p.type_trends!.sales_ppsf.condo as Array<number | null>, p.type_trends!.sales_ppsf.coop as Array<number | null>, p.type_trends!.sales_ppsf.townhouse as Array<number | null>]))}</div>
      <div class="type-chart"><div class="type-chart__title">Transaction count</div><canvas id="tt-sales-count" role="img" aria-describedby="tt-sales-count-desc" aria-label="Weekly recorded sale count by property type"></canvas>${srSummary("tt-sales-count-desc", describeSeries("Line chart of weekly recorded sale count by property type", p.type_trends!.labels, [{ name: "Condo", values: p.type_trends!.sales_count.condo as Array<number | null> }, { name: "Co-op", values: p.type_trends!.sales_count.coop as Array<number | null> }, { name: "Townhouse", values: p.type_trends!.sales_count.townhouse as Array<number | null> }]))}${srTable("Weekly recorded sale count by property type", ["Week", "Condo", "Co-op", "Townhouse"], zipSeries(p.type_trends!.labels, [p.type_trends!.sales_count.condo as Array<number | null>, p.type_trends!.sales_count.coop as Array<number | null>, p.type_trends!.sales_count.townhouse as Array<number | null>]))}</div>
      <div class="type-chart"><div class="type-chart__title">Total sales volume</div><canvas id="tt-sales-volume" role="img" aria-describedby="tt-sales-volume-desc" aria-label="Weekly recorded sales dollar volume by property type"></canvas>${srSummary("tt-sales-volume-desc", describeSeries("Line chart of weekly recorded sales dollar volume by property type", p.type_trends!.labels, [{ name: "Condo", values: p.type_trends!.sales_volume.condo as Array<number | null>, fmt: fmtMoneyM }, { name: "Co-op", values: p.type_trends!.sales_volume.coop as Array<number | null>, fmt: fmtMoneyM }, { name: "Townhouse", values: p.type_trends!.sales_volume.townhouse as Array<number | null>, fmt: fmtMoneyM }]))}${srTable("Weekly recorded sales dollar volume by property type", ["Week", "Condo", "Co-op", "Townhouse"], zipSeries(p.type_trends!.labels, [p.type_trends!.sales_volume.condo as Array<number | null>, p.type_trends!.sales_volume.coop as Array<number | null>, p.type_trends!.sales_volume.townhouse as Array<number | null>]))}</div>

    </div>
  </div>

  <div class="chart-legend" style="margin-top:24px">
    <div class="chart-legend__item"><div class="chart-legend__mark" style="background:#9E5040"></div>Condos</div>
    <div class="chart-legend__item"><div class="chart-legend__mark" style="background:#75694E"></div>Co-ops</div>
    <div class="chart-legend__item"><div class="chart-legend__mark" style="background:#98A0A8"></div>Townhouses</div>
  </div>
</section>`
    : ""
}

<footer class="page-footer" id="methodology">
  <div style="flex:1; min-width:280px;">
    <div class="footer-brand">
      <div class="footer-brand__name">Heather Domi</div>
      <div class="footer-brand__title">Heather Domi Team · Douglas Elliman</div>
    </div>
    <div class="chart-toggle" style="margin-top:20px">
      <button class="chart-toggle__btn" aria-expanded="false" data-target="methodology-panel">
        <span>Expand</span>
        <span>Methodology &amp; Notes</span>
        <span class="chart-toggle__icon">▼</span>
      </button>
      <div class="chart-toggle__panel" id="methodology-panel" hidden>
        <ul class="footer-method-list" style="margin-top:16px">
          <li>Manhattan residential signed contracts, last asking price, trailing 52 weeks.</li>
          <li>Luxury ${luxCutoffM} / Prime ${primeCutoffM} / Trophy ${trophyCutoffM} = top 10%, 5%, 1% of trailing 52-week contracts. Tier cutoffs update weekly.</li>
          <li>Week of ${fmtDateLong(row.week_end)} is the latest reporting week${row.is_provisional ? " (provisional — may revise upward)" : ""}.</li>
          ${sw ? `<li>${esc(sw.footnotes.asking_not_achieved)}</li>` : ""}
          ${sw ? `<li>${esc(sw.footnotes.count_reconciliation)}</li>` : ""}
          ${sw ? `<li>${esc(sw.footnotes.provisional)}</li>` : ""}
        </ul>
      </div>
    </div>
    <div class="chart-toggle" style="margin-top:20px">
      <button class="chart-toggle__btn" aria-expanded="false" data-target="abbreviations-panel">
        <span>Expand</span>
        <span>Abbreviations</span>
        <span class="chart-toggle__icon">▼</span>
      </button>
      <div class="chart-toggle__panel" id="abbreviations-panel" hidden>
        <ul class="footer-method-list" style="margin-top:16px">
          <li><strong>TTM</strong> · Trailing Twelve Months</li>
          <li><strong>YoY</strong> · Year over Year</li>
          <li><strong>QoQ</strong> · Quarter over Quarter</li>
          <li><strong>MoS</strong> · Months of Supply</li>
          <li><strong>DOF</strong> · Department of Finance</li>
        </ul>
      </div>
    </div>

  </div>
</footer>`;
}

/* ─────────── script builder (charts + interactivity) ─────────── */

export function buildReportScript(row: WeeklyReportRow): string {
  // Bedroom mix data prep (server-side to keep the script small)
  const p = row.payload;
  const orderKeys = ["studio", "1", "2", "3", "4+"];
  const labels: Record<string, string> = {
    studio: "Studio",
    "1": "1-Bed",
    "2": "2-Bed",
    "3": "3-Bed",
    "4+": "4+ Beds",
  };
  const bmVol = p.bedroom_mix?.volume ?? null;
  const bmCnt = p.bedroom_mix?.count ?? null;
  const volumeData = orderKeys
    .map((k) => ({ label: labels[k], value: Number((bmVol && bmVol[k]) ?? 0) }))
    .filter((d) => d.value > 0)
    .map((d) => ({ ...d, fmt: fmtMoneyShort(d.value) }));
  const countData = orderKeys
    .map((k) => ({ label: labels[k], value: Number((bmCnt && bmCnt[k]) ?? 0) }))
    .filter((d) => d.value > 0)
    .map((d) => ({ ...d, fmt: String(Math.round(d.value)) }));
  const volumeTotal = volumeData.reduce((s, d) => s + d.value, 0);
  const countTotal = countData.reduce((s, d) => s + d.value, 0);

  const payloadJson = JSON.stringify({
    counts: p.demand_trend.counts,
    rolling_avg: p.demand_trend.rolling_avg,
    demandLabels: p.demand_trend.labels ?? null,
    volumeData,
    countData,
    volumeCenter: volumeTotal > 0 ? fmtMoneyShort(volumeTotal) : "—",
    countCenter: countTotal > 0 ? String(countTotal) : "—",
    mpContracts: p.market_pulse.all.contracts,
    mpAvg52: p.market_pulse.all.contracts_avg52,
    weekDateISO: row.week_end,
    supplyLux: p.supply.supply_series.luxury,
    supplyPrime: p.supply.supply_series.prime ?? [],
    supplyAll: p.supply.supply_series.all,
    domLux: p.supply.dom_series.luxury,
    domLuxP95: (p.supply.dom_series.luxury_p95 ?? []) as number[],
    domAll: p.supply.dom_series.all || [],
    heroCount: p.hero.luxury_count,
    tierLabels: p.tiers.history_quarterly?.labels ?? p.tiers.history_annual.years.map(String),
    tierP90: p.tiers.history_quarterly?.p90 ?? p.tiers.history_annual.p90,
    tierP95: p.tiers.history_quarterly?.p95 ?? p.tiers.history_annual.p95,
    tierP99: p.tiers.history_quarterly?.p99 ?? p.tiers.history_annual.p99,
    typeTrends: p.type_trends ?? null,
    tierSeries: p.tier_series ?? null,
  });

  return `
'use strict';
var DATA = ${payloadJson};
var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ── shared canvas helpers ── */
function setupCanvas(canvas, h) {
  var dpr = window.devicePixelRatio || 1;
  var W = canvas.clientWidth;
  canvas.width = W * dpr; canvas.height = h * dpr;
  canvas.style.height = h + 'px';
  var ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
  return { ctx: ctx, W: W, H: h };
}

function niceScale(min, max, padPct) {
  padPct = padPct || 0.1;
  var range = Math.max(max - min, 1);
  return { min: min - range * padPct, max: max + range * padPct };
}

/* ── DEMAND CHART ── */
var demandCanvas = document.getElementById('demand-chart');
var weeks = (DATA.counts || []).map(function(n){ return Number(n) || 0; });
var rollAvg = (DATA.rolling_avg || []).map(function(v){ return v == null ? null : Number(v); });

function drawDemand(canvas, opts) {
  canvas = canvas || demandCanvas;
  if (!canvas || weeks.length === 0) return;
  var height = (opts && opts.height) || 200;
  var s = setupCanvas(canvas, height);
  var ctx = s.ctx, W = s.W, H = s.H;
  var pad = { top:16, right:16, bottom:28, left:36 };
  var cW = W - pad.left - pad.right;
  var cH = H - pad.top - pad.bottom;
  var maxRaw = Math.max.apply(null, weeks.concat(rollAvg.filter(function(v){return v!=null;})));
  var max = Math.ceil(maxRaw * 1.15 / 5) * 5 || 10;
  var barW = cW / weeks.length;
  var gap = barW * 0.22;
  ctx.clearRect(0, 0, W, H);
  var ticks = [Math.round(max/3), Math.round(2*max/3), max];
  ctx.strokeStyle = 'rgba(27,23,20,0.07)'; ctx.lineWidth = 1;
  ticks.forEach(function(v) {
    var y = pad.top + cH - (v / max) * cH;
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + cW, y); ctx.stroke();
    ctx.fillStyle = 'rgba(107,101,96,0.55)';
    ctx.font = '9px system-ui'; ctx.textAlign = 'right';
    ctx.fillText(String(v), pad.left - 4, y + 3);
  });
  weeks.forEach(function(count, i) {
    var x = pad.left + i * barW + gap / 2;
    var bw = barW - gap;
    var bh = (count / max) * cH;
    var y = pad.top + cH - bh;
    ctx.fillStyle = (i === weeks.length - 1) ? '#98A0A8' : 'rgba(199,185,178,0.32)';
    ctx.fillRect(x, y, bw, bh);
  });
  ctx.strokeStyle = '#918C7E'; ctx.lineWidth = 1.5;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath();
  var started = false;
  rollAvg.forEach(function(avg, i) {
    if (avg == null) return;
    var x = pad.left + i * barW + barW / 2;
    var y = pad.top + cH - (avg / max) * cH;
    if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
  });
  ctx.stroke();
  // x-axis date labels (match drawLineChart's 4-tick spacing)
  var xLabs = DATA.demandLabels;
  if (xLabs && xLabs.length) {
    ctx.fillStyle = 'rgba(107,101,96,0.6)';
    ctx.font = '9px system-ui';
    ctx.textAlign = 'center';
    var picks = 4;
    for (var p = 0; p < picks; p++) {
      var idxL = Math.round((xLabs.length - 1) * (p / (picks - 1)));
      var raw = xLabs[idxL] || '';
      var d = new Date(String(raw));
      var text = (!isNaN(d.getTime())) ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) : String(raw);
      var xLab = pad.left + idxL * barW + barW / 2;
      ctx.fillText(text, xLab, H - pad.bottom + 14);
    }
  }
  // interactivity
  var interactive = !opts || opts.interactive !== false;
  if (interactive) {
    var demandOpts = {
      title: 'Weekly luxury contracts',
      interactive: true,
      xLabels: DATA.demandLabels || null,
      series: [
        { data: weeks, color: '#98A0A8', label: 'Weekly count' },
        { data: rollAvg.map(function(v){ return v == null ? null : v; }), color: '#918C7E', label: '4-wk rolling avg' }
      ]
    };
    ensureChartHolder(canvas, demandOpts);
    canvas._chartOpts = demandOpts;
    canvas._renderFn = drawDemand;
    canvas._chartMeta = {
      pad: { l: pad.left, t: pad.top, r: pad.right, b: pad.bottom },
      cW: cW, cH: cH, W: W, H: H, n: weeks.length,
      xp: function(i){ return pad.left + i * barW + barW / 2; }
    };
    bindChartInteraction(canvas);
  }
}

/* WEEK READ is now rendered server-side from payload.sowhat — no client classification. */


drawDemand();
window.addEventListener('resize', function(){ drawDemand(); });



/* ── DONUT CHARTS ── */
var DONUT_COLORS = ['#969FA8', '#AA8B84', '#8A8179', '#9A9280', '#C0BAB0'];
function donutBedIndex(label) {
  var l = String(label || '').toLowerCase();
  if (l.indexOf('studio') === 0) return 0;
  if (l.indexOf('4') === 0) return 4;
  if (l.indexOf('3') === 0) return 3;
  if (l.indexOf('2') === 0) return 2;
  if (l.indexOf('1') === 0) return 1;
  return 5;
}
function drawDonut(canvasId, data, centerLabel) {
  var canvas = document.getElementById(canvasId);
  if (!canvas) return;
  if (!data || data.length === 0) return;
  data = data.slice().sort(function(a, b){ return donutBedIndex(a.label) - donutBedIndex(b.label); });
  var dpr = window.devicePixelRatio || 1;
  var size = 360;
  canvas.width = size * dpr; canvas.height = size * dpr;
  canvas.style.width = '100%'; canvas.style.height = 'auto';
  var ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
  var cx = size/2, cy = size/2;
  var outerR = 96, innerR = outerR * 0.58;
  var total = data.reduce(function(s,d){ return s+d.value; }, 0);
  var angle = -Math.PI/2, gap = 0.014;
  var slices = [];
  data.forEach(function(slice, i) {
    var color = DONUT_COLORS[donutBedIndex(slice.label) % DONUT_COLORS.length];
    var sweep = (slice.value/total)*(Math.PI*2) - gap;
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, angle + gap/2, angle + sweep, false);
    ctx.arc(cx, cy, innerR, angle + sweep, angle + gap/2, true);
    ctx.closePath();
    ctx.fillStyle = color; ctx.fill();
    var mid = angle + gap/2 + (sweep - gap/2)/2;
    slices.push({ mid: mid, color: color, label: slice.label, fmt: slice.fmt });
    angle += sweep + gap;
  });

  // center total
  ctx.fillStyle = '#1B1714';
  ctx.font = 'bold 18px Georgia, serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(centerLabel, cx, cy);
  // radiating labels
  var labelR = outerR + 22;
  slices.forEach(function(sl){
    var lx = cx + Math.cos(sl.mid) * labelR;
    var ly = cy + Math.sin(sl.mid) * labelR;
    var cosA = Math.cos(sl.mid);
    var align = cosA > 0.15 ? 'left' : (cosA < -0.15 ? 'right' : 'center');
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#6B6560';
    ctx.font = '11px system-ui';
    ctx.fillText(sl.label, lx, ly - 7);
    ctx.fillStyle = sl.color;
    ctx.font = 'bold 12px Georgia, serif';
    ctx.fillText(sl.fmt, lx, ly + 8);
  });
}
drawDonut('donut-volume', DATA.volumeData, DATA.volumeCenter);
drawDonut('donut-count',  DATA.countData,  DATA.countCenter);

/* ── CHART TOGGLES ── */
document.querySelectorAll('.chart-toggle__btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    var targetId = btn.getAttribute('data-target');
    var panel = document.getElementById(targetId);
    if (!panel) return;
    var expanded = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', expanded ? 'false' : 'true');
    btn.querySelector('span:first-child').textContent = expanded ? 'Expand' : 'Collapse';
    panel.hidden = expanded;
  });
});

/* ── shared line-chart helper (linear or log; bold dot + softened line) ── */
function hexToRgb(hex) {
  var m = hex.replace('#','');
  if (m.length === 3) m = m.split('').map(function(c){return c+c;}).join('');
  return { r: parseInt(m.slice(0,2),16), g: parseInt(m.slice(2,4),16), b: parseInt(m.slice(4,6),16) };
}
function softenColor(hex) {
  // blend 40% toward white
  var c = hexToRgb(hex);
  var mix = function(v){ return Math.round(v + (255 - v) * 0.4); };
  return 'rgb(' + mix(c.r) + ',' + mix(c.g) + ',' + mix(c.b) + ')';
}
function niceLog125(minV, maxV) {
  var steps = [1, 2, 5];
  function floorFor(v) {
    if (v <= 0) v = 1;
    var k = Math.floor(Math.log(v) / Math.LN10);
    var best = Math.pow(10, k);
    for (var i = 0; i < steps.length; i++) {
      var cand = steps[i] * Math.pow(10, k);
      if (cand <= v) best = cand;
    }
    return best;
  }
  function ceilFor(v) {
    if (v <= 0) v = 1;
    var k = Math.floor(Math.log(v) / Math.LN10);
    var options = [1,2,5,10];
    for (var i = 0; i < options.length; i++) {
      var cand = options[i] * Math.pow(10, k);
      if (cand >= v) return cand;
    }
    return Math.pow(10, k + 1);
  }
  var lo = floorFor(minV);
  var hi = ceilFor(maxV);
  if (hi <= lo) hi = lo * 10;
  return { min: lo, max: hi };
}
function niceLinear(minV, maxV, padPct) {
  padPct = padPct == null ? 0.1 : padPct;
  var range = Math.max(maxV - minV, Math.abs(maxV) * 0.02, 1);
  return { min: minV - range * padPct, max: maxV + range * padPct };
}
function fmtTickShort(v) {
  var a = Math.abs(v);
  if (a >= 1e9) return (v/1e9).toFixed(1) + 'B';
  if (a >= 1e6) return (v/1e6).toFixed(a >= 1e7 ? 0 : 1) + 'M';
  if (a >= 1e3) return (v/1e3).toFixed(a >= 1e4 ? 0 : 1) + 'k';
  if (a >= 10)  return Math.round(v).toString();
  if (a >= 1)   return v.toFixed(1);
  return v.toFixed(2);
}
/**
 * opts: {
 *   series: [{ data:number[], color:'#hex', label?:string }],
 *   height: number,
 *   scaleType: 'linear'|'log',
 *   pad?: {t,r,b,l},
 *   xLabels?: string[],  // used for axis + tooltip; ~4 evenly-spaced on axis
 *   yFmt?: fn,
 *   title?: string,       // for expand modal
 *   interactive?: boolean // default true; set false in modal to avoid nesting
 * }
 */

/* ── Shared chart modal (lazy) ── */
var __chartModal = null;
function getChartModal() {
  if (__chartModal) return __chartModal;
  var overlay = document.createElement('div');
  overlay.className = 'chart-modal';
  overlay.setAttribute('hidden', '');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.innerHTML =
    '<div class="chart-modal__backdrop"></div>' +
    '<div class="chart-modal__panel" tabindex="-1">' +
      '<button class="chart-modal__close" aria-label="Close">×</button>' +
      '<div class="chart-modal__title"></div>' +
      '<canvas class="chart-modal__canvas"></canvas>' +
      '<div class="chart-modal__legend"></div>' +
    '</div>';
  document.body.appendChild(overlay);
  var state = {
    overlay: overlay,
    panel: overlay.querySelector('.chart-modal__panel'),
    canvas: overlay.querySelector('.chart-modal__canvas'),
    title: overlay.querySelector('.chart-modal__title'),
    legend: overlay.querySelector('.chart-modal__legend'),
    closeBtn: overlay.querySelector('.chart-modal__close'),
    currentOpts: null,
    lastFocus: null
  };
  function focusableEls() {
    var sel = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';
    return Array.prototype.slice.call(state.panel.querySelectorAll(sel))
      .filter(function(el){ return el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement; });
  }
  function close(){
    overlay.setAttribute('hidden','');
    state.currentOpts = null;
    var toFocus = state.lastFocus;
    state.lastFocus = null;
    if (toFocus && typeof toFocus.focus === 'function') {
      try { toFocus.focus(); } catch(e) {}
    }
  }
  state.close = close;
  overlay.querySelector('.chart-modal__backdrop').addEventListener('click', close);
  state.closeBtn.addEventListener('click', close);
  document.addEventListener('keydown', function(e){
    if (overlay.hasAttribute('hidden')) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'Tab') {
      var f = focusableEls();
      if (!f.length) { e.preventDefault(); state.panel.focus(); return; }
      var first = f[0], last = f[f.length - 1];
      var active = document.activeElement;
      // If focus escaped the panel entirely, pull it back.
      if (!state.panel.contains(active)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); return; }
      if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    }
  });
  window.addEventListener('resize', function(){
    if (state.currentOpts) (state.currentRender || drawLineChart)(state.canvas, state.currentOpts);
  });
  __chartModal = state;
  return state;
}
function openChartModal(opts, title, renderFn, trigger) {
  var m = getChartModal();
  m.lastFocus = trigger || (document.activeElement instanceof HTMLElement ? document.activeElement : null);
  m.overlay.removeAttribute('hidden');
  m.title.textContent = title || '';
  var big = {};
  for (var k in opts) if (Object.prototype.hasOwnProperty.call(opts,k)) big[k] = opts[k];
  big.height = 360;
  big.interactive = true;
  big.pad = { t: 20, r: 24, b: 34, l: 60 };
  m.currentOpts = big;
  m.currentRender = renderFn || drawLineChart;
  var lg = '';
  (opts.series || []).forEach(function(s){
    if (!s.label) return;
    lg += '<span class="chart-modal__legitem"><span class="chart-modal__sw" style="background:' + s.color + '"></span>' + s.label + '</span>';
  });
  m.legend.innerHTML = lg;
  requestAnimationFrame(function(){
    m.currentRender(m.canvas, big);
    // Move focus into the dialog so keyboard users land inside it.
    try { m.closeBtn.focus(); } catch(e) {}
  });
}

/* ── Ensure chart holder wrapping + expand button + tooltip layers ── */
function ensureChartHolder(canvas, opts) {
  var parent = canvas.parentElement;
  if (!parent) return null;
  if (!parent.classList.contains('chart-holder')) {
    parent.classList.add('chart-holder');
    parent.style.position = 'relative';
  }
  if (!canvas._tipEl) {
    var tip = document.createElement('div'); tip.className = 'chart-tip';
    var cross = document.createElement('div'); cross.className = 'chart-crosshair';
    document.body.appendChild(cross); document.body.appendChild(tip);
    canvas._tipEl = tip; canvas._crossEl = cross;
    canvas._overlayRoot = parent;
  }
  if (!canvas._expandBtn && opts.interactive !== false) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chart-expand';
    btn.setAttribute('aria-label', 'Expand chart');
    btn.title = 'Expand';
    btn.innerHTML = '⤢';
    parent.appendChild(btn);
    btn.addEventListener('click', function(){
      openChartModal(canvas._chartOpts || opts, (canvas._chartOpts && canvas._chartOpts.title) || opts.title || '', canvas._renderFn || null, btn);
    });
    canvas._expandBtn = btn;
  }
  return parent;
}


function bindChartInteraction(canvas) {
  if (canvas._interactBound) return;
  canvas._interactBound = true;
  function onMove(e) {
    var meta = canvas._chartMeta; var opts = canvas._chartOpts;
    if (!meta || !opts) return;
    var rect = canvas.getBoundingClientRect();
    var liveW = rect.width || meta.W;
    var scale = (liveW > 0) ? (meta.W / liveW) : 1;
    var xAdj = (e.clientX - rect.left) * scale;
    if (xAdj < meta.pad.l || xAdj > meta.pad.l + meta.cW) { onLeave(); return; }
    var frac = (xAdj - meta.pad.l) / meta.cW;
    var idx = Math.round(frac * Math.max(meta.n - 1, 1));
    if (idx < 0) idx = 0; if (idx > meta.n - 1) idx = meta.n - 1;
    var xPix = meta.xp(idx) / scale;
    // crosshair
    var cross = canvas._crossEl;
    cross.style.display = 'block';
    cross.style.left = (rect.left + xPix) + 'px';
    cross.style.top = (rect.top + meta.pad.t) + 'px';
    cross.style.height = meta.cH + 'px';
    // tooltip
    var tip = canvas._tipEl;
    var yFmt = opts.yFmt || fmtTickShort;
    var lbl = '';
    if (opts.xLabels && opts.xLabels.length) {
      var raw = opts.xLabels[Math.min(idx, opts.xLabels.length - 1)] || '';
      var d = new Date(String(raw));
      lbl = (!isNaN(d.getTime())) ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : String(raw);
    } else {
      lbl = 'Point ' + (idx + 1);
    }
    var html = '<div class="chart-tip__date">' + lbl + '</div>';
    (opts.series || []).forEach(function(s){
      var v = s.data[idx];
      var valTxt = (typeof v === 'number' && isFinite(v)) ? yFmt(v) : '—';
      html += '<div class="chart-tip__row">' +
        '<span class="chart-tip__sw" style="background:' + s.color + '"></span>' +
        '<span class="chart-tip__lab">' + (s.label || '') + '</span>' +
        '<span class="chart-tip__val">' + valTxt + '</span>' +
        '</div>';
    });
    tip.innerHTML = html;
    tip.style.display = 'block';
    // position tooltip; keep within canvas horizontal bounds
    var tipW = tip.offsetWidth || 160;
    var leftLocal = xPix + 12;
    if (leftLocal + tipW > meta.W - 4) leftLocal = xPix - tipW - 12;
    if (leftLocal < 4) leftLocal = 4;
    tip.style.left = (rect.left + leftLocal) + 'px';
    tip.style.top = (rect.top + meta.pad.t + 4) + 'px';
  }
  function onLeave() {
    if (canvas._crossEl) canvas._crossEl.style.display = 'none';
    if (canvas._tipEl) canvas._tipEl.style.display = 'none';
  }
  canvas.addEventListener('mousemove', onMove);
  canvas.addEventListener('mouseleave', onLeave);
  // Scrolling or resizing does not fire mouseleave, so the fixed tooltip would stay pinned.
  window.addEventListener('scroll', onLeave, true);
  window.addEventListener('resize', onLeave);
  document.addEventListener('mousemove', function(e){
    var t = canvas._tipEl;
    if (!t || t.style.display === 'none') return;
    if (e.target !== canvas) onLeave();
  }, true);

}

function drawLineChart(canvas, opts) {
  if (!canvas) return;
  var series = (opts.series || []).filter(function(s){ return s.data && s.data.length; });
  if (!series.length) return;
  var n = 0;
  series.forEach(function(s){ if (s.data.length > n) n = s.data.length; });
  var pad = opts.pad || { t: 14, r: 12, b: 22, l: 40 };
  var height = opts.height || 160;
  var st = setupCanvas(canvas, height);
  var ctx = st.ctx, W = st.W, H = st.H;
  var cW = W - pad.l - pad.r, cH = H - pad.t - pad.b;
  var allV = [];
  series.forEach(function(s){ s.data.forEach(function(v){ if (typeof v === 'number' && isFinite(v)) allV.push(v); }); });
  if (!allV.length) return;
  var minV = Math.min.apply(null, allV), maxV = Math.max.apply(null, allV);
  var scale, isLog = (opts.scaleType === 'log');
  if (isLog) {
    var pos = allV.filter(function(v){return v > 0;});
    if (!pos.length) return;
    scale = niceLog125(Math.min.apply(null, pos), Math.max.apply(null, pos));
  } else {
    scale = niceLinear(minV, maxV, 0.12);
  }
  ctx.clearRect(0, 0, W, H);
  var ticks;
  if (isLog) {
    ticks = [];
    var lo = scale.min, hi = scale.max;
    var kLo = Math.floor(Math.log(lo) / Math.LN10), kHi = Math.ceil(Math.log(hi) / Math.LN10);
    for (var k = kLo; k <= kHi; k++) {
      [1,2,5].forEach(function(m){
        var val = m * Math.pow(10, k);
        if (val >= lo && val <= hi) ticks.push(val);
      });
    }
    if (ticks.length > 6) ticks = ticks.filter(function(_,idx){ return idx % 2 === 0; });
  } else {
    var span = scale.max - scale.min;
    var step = span / 4;
    ticks = [scale.min, scale.min + step, scale.min + 2*step, scale.min + 3*step, scale.max];
  }
  function xp(i) { return pad.l + (i / Math.max(n - 1, 1)) * cW; }
  function yp(v) {
    if (isLog) {
      if (v <= 0) return pad.t + cH;
      var t = (Math.log(v) - Math.log(scale.min)) / (Math.log(scale.max) - Math.log(scale.min));
      return pad.t + cH - t * cH;
    }
    return pad.t + cH - ((v - scale.min) / (scale.max - scale.min)) * cH;
  }
  ctx.strokeStyle = 'rgba(27,23,20,0.07)'; ctx.lineWidth = 1;
  ctx.font = '9px system-ui'; ctx.textAlign = 'right';
  ticks.forEach(function(v){
    var y = yp(v);
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + cW, y); ctx.stroke();
    ctx.fillStyle = 'rgba(107,101,96,0.55)';
    ctx.fillText((opts.yFmt || fmtTickShort)(v), pad.l - 4, y + 3);
  });
  if (opts.xLabels && opts.xLabels.length) {
    var labs = opts.xLabels;
    var picks = 4;
    ctx.fillStyle = 'rgba(107,101,96,0.6)'; ctx.textAlign = 'center';
    for (var p = 0; p < picks; p++) {
      var idxL = Math.round((labs.length - 1) * (p / (picks - 1)));
      var lbl = labs[idxL] || '';
      var d = new Date(String(lbl));
      var text = (!isNaN(d.getTime())) ? d.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' }) : String(lbl);
      ctx.fillText(text, xp(idxL), H - pad.b + 12);
    }
  }
  // markers step: thin to ~1 every 3-4 if long
  var markStep = 1;
  if (n > 20) markStep = Math.max(1, Math.round(n / 14));
  series.forEach(function(s){
    var soft = softenColor(s.color);
    ctx.beginPath();
    var started = false;
    var connect = opts.connectGaps === true;
    for (var i = 0; i < s.data.length; i++) {
      var v = s.data[i];
      if (typeof v !== 'number' || !isFinite(v) || (isLog && v <= 0)) { if (!connect) started = false; continue; }
      var x = xp(i), y = yp(v);
      if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = soft; ctx.lineWidth = 1.6; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.stroke();
    // markers at every (thinned) point + always first/last valid
    var firstValid = -1, lastValid = -1;
    for (var fi = 0; fi < s.data.length; fi++) {
      var fv = s.data[fi];
      if (typeof fv === 'number' && isFinite(fv) && (!isLog || fv > 0)) { if (firstValid < 0) firstValid = fi; lastValid = fi; }
    }
    for (var m2 = 0; m2 < s.data.length; m2++) {
      var mv = s.data[m2];
      if (typeof mv !== 'number' || !isFinite(mv) || (isLog && mv <= 0)) continue;
      var show = (m2 % markStep === 0) || (m2 === firstValid) || (m2 === lastValid);
      if (!show) continue;
      var isEnd = (m2 === lastValid);
      ctx.beginPath();
      ctx.arc(xp(m2), yp(mv), isEnd ? 3.5 : 2.4, 0, Math.PI * 2);
      ctx.fillStyle = s.color; ctx.fill();
    }
  });
  // cache + wire interactivity
  if (opts.interactive !== false) {
    ensureChartHolder(canvas, opts);
    canvas._chartOpts = opts;
    canvas._chartMeta = { pad: pad, cW: cW, cH: cH, W: W, H: H, n: n, isLog: isLog, scale: scale, xp: xp, yp: yp };
    bindChartInteraction(canvas);
  }
}

/* ── SUPPLY CHART (shared log scale) ── */
var supplyCanvas = document.getElementById('supply-chart');
function drawSupply() {
  var labels = (DATA.typeTrends && DATA.typeTrends.labels) ? DATA.typeTrends.labels : null;
  drawLineChart(supplyCanvas, {
    height: 200,
    scaleType: 'log',
    pad: { t: 14, r: 16, b: 26, l: 52 },
    title: 'Active luxury supply · 52-week trailing',
    xLabels: labels,
    series: [
      { data: (DATA.supplyAll || []).map(Number), color: '#6B6560', label: 'All Manhattan' },
      { data: (DATA.supplyLux || []).map(Number), color: '#98A0A8', label: 'Luxury' },
      { data: (DATA.supplyPrime || []).map(Number), color: '#918C7E', label: 'Prime' }
    ]
  });
}

/* ── DOM CHART (Top 10%+ vs Top 5%+ vs All Manhattan) ── */
var domCanvas = document.getElementById('dom-chart');
function drawDom() {
  var labels = DATA.demandLabels || null;
  drawLineChart(domCanvas, {
    height: 200,
    scaleType: 'linear',
    pad: { t: 16, r: 16, b: 26, l: 44 },
    title: 'Days on market · 52-week trailing',
    xLabels: labels,
    series: [
      { data: (DATA.domLux || []).map(Number), color: '#98A0A8', label: 'Top 10%+' },
      { data: (DATA.domLuxP95 || []).map(Number), color: '#918C7E', label: 'Top 5%+' },
      { data: (DATA.domAll || []).map(function(v){ return (v === null || v === undefined) ? null : Number(v); }), color: '#6B6560', label: 'All Manhattan' }
    ]
  });
}

/* ── TYPE TRENDS (7 charts, linear, shared helper) ── */
var TYPE_COLORS = { condo: '#9E5040', coop: '#75694E', townhouse: '#98A0A8' };
function drawTypeChart(canvasId, block, yFmt, title) {
  var tt = DATA.typeTrends;
  if (!tt || !block) return;
  var canvas = document.getElementById(canvasId);
  if (!canvas) return;
  drawLineChart(canvas, {
    height: 160,
    scaleType: 'linear',
    pad: { t: 10, r: 12, b: 22, l: 44 },
    xLabels: tt.labels,
    yFmt: yFmt,
    title: title || '',
    series: [
      { data: (block.condo || []).map(Number), color: TYPE_COLORS.condo, label: 'Condo' },
      { data: (block.coop || []).map(Number), color: TYPE_COLORS.coop, label: 'Co-op' },
      { data: (block.townhouse || []).map(Number), color: TYPE_COLORS.townhouse, label: 'Townhouse' }
    ]
  });
}
function drawAllTypeCharts() {
  var tt = DATA.typeTrends;
  if (!tt) return;
  var moneyFmt = function(v){ return '$' + fmtTickShort(v); };
  var pctFmt = function(v){ return v.toFixed(1) + '%'; };
  drawTypeChart('tt-contracts-count',  tt.contracts_count,  null,     'Signed contracts · count');
  drawTypeChart('tt-contracts-volume', tt.contracts_volume, moneyFmt, 'Signed contracts · volume');
  drawTypeChart('tt-sales-avgprice',   tt.sales_avgprice,   moneyFmt, 'Recorded sales · average price');
  drawTypeChart('tt-sales-discount',   tt.sales_discount,   pctFmt,   'Recorded sales · discount to ask');
  drawTypeChart('tt-sales-ppsf',       tt.sales_ppsf,       moneyFmt, 'Recorded sales · price per sq ft');
  drawTypeChart('tt-sales-count',      tt.sales_count,      null,     'Recorded sales · count');
  drawTypeChart('tt-sales-volume',     tt.sales_volume,     moneyFmt, 'Recorded sales · volume');
}

function drawAllCharts() {
  drawSupply();
  drawDom();
  drawAllTypeCharts();
}
drawAllCharts();
window.addEventListener('resize', function(){ drawDemand(); drawAllCharts(); drawTierHistory(); });


/* ── TIER HISTORY (quarterly, since payload's first label) ── */
var tierHistCanvas = document.getElementById('tier-history-chart');
function drawTierHistory(canvas, opts) {
  canvas = canvas || tierHistCanvas;
  if (!canvas) return;
  var years = DATA.tierLabels || DATA.tierYears || [];
  var p90 = (DATA.tierP90||[]).map(function(v){return Number(v)||0;});
  var p95 = (DATA.tierP95||[]).map(function(v){return Number(v)||0;});
  var p99 = (DATA.tierP99||[]).map(function(v){return Number(v)||0;});
  if (years.length === 0) return;
  function toM(arr){ return arr.map(function(v){ return v > 1000 ? v/1000000 : v; }); }
  p90 = toM(p90); p95 = toM(p95); p99 = toM(p99);
  var dpr = window.devicePixelRatio || 1;
  var W = canvas.clientWidth, H = (opts && opts.height) || 300;
  canvas.width = W * dpr; canvas.height = H * dpr;
  canvas.style.height = H + 'px';
  var ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
  var pad = { t: 20, r: 60, b: 32, l: 48 };
  var cW = W - pad.l - pad.r, cH = H - pad.t - pad.b;
  var n = years.length;
  var allVals = p90.concat(p95, p99).filter(function(v){return v>0;});
  var minV = Math.max(0, Math.floor(Math.min.apply(null, allVals) - 1));
  var maxV = Math.ceil(Math.max.apply(null, allVals) + 1);
  function xp(i) { return pad.l + (i / Math.max(n - 1, 1)) * cW; }
  function yp(v) { return pad.t + cH - ((v - minV) / (maxV - minV)) * cH; }
  var step = Math.max(2, Math.round((maxV - minV) / 6));
  for (var g = minV; g <= maxV; g += step) {
    var y = yp(g);
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + cW, y);
    ctx.strokeStyle = 'rgba(0,0,0,0.06)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#9E9A94'; ctx.font = '10px system-ui'; ctx.textAlign = 'right';
    ctx.fillText('$' + g + 'M', pad.l - 6, y + 3.5);
  }
  ctx.fillStyle = '#9E9A94'; ctx.font = '10px system-ui'; ctx.textAlign = 'center';
  var maxTicks = 7;
  var stride = Math.max(1, Math.ceil(n / maxTicks));
  years.forEach(function(lbl, i) {
    if (i === n - 1 || i % stride === 0) {
      if (i !== n - 1 && (n - 1 - i) < stride * 0.6) return;
      ctx.fillText(lbl, xp(i), H - pad.b + 14);
    }
  });
  var series = [
    { data: p90, color: '#98A0A8', label: 'Luxury (Top 10%)' },
    { data: p95, color: '#918C7E', label: 'Prime (Top 5%)' },
    { data: p99, color: '#A37670', label: 'Trophy (Top 1%)' }
  ];
  series.forEach(function(s) {
    if (!s.data.length) return;
    ctx.beginPath(); ctx.moveTo(xp(0), yp(s.data[0]));
    for (var i = 1; i < s.data.length; i++) ctx.lineTo(xp(i), yp(s.data[i]));
    ctx.strokeStyle = s.color; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.beginPath(); ctx.arc(xp(s.data.length - 1), yp(s.data[s.data.length - 1]), 4, 0, Math.PI * 2);
    ctx.fillStyle = s.color; ctx.fill();
    ctx.fillStyle = '#6B6560'; ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'left';
    ctx.fillText('$' + (s.data[s.data.length-1]||0).toFixed(2) + 'M', xp(s.data.length - 1) + 8, yp(s.data[s.data.length - 1]) + 3.5);
  });
  // interactivity
  var interactive = !opts || opts.interactive !== false;
  if (interactive) {
    var thOpts = {
      title: 'Luxury tier entry price · quarterly',
      interactive: true,
      yFmt: function(v){ return '$' + v.toFixed(1) + 'M'; },
      xLabels: years.map(String),
      series: series
    };
    ensureChartHolder(canvas, thOpts);
    canvas._chartOpts = thOpts;
    canvas._renderFn = drawTierHistory;
    canvas._chartMeta = { pad: pad, cW: cW, cH: cH, W: W, H: H, n: n, xp: xp };
    bindChartInteraction(canvas);
  }
}
drawTierHistory();
window.addEventListener('resize', function(){ drawTierHistory(); });
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(function(){ drawDemand(); drawAllCharts(); drawTierHistory(); });
}

/* ── MOMENTUM: three tiers, five metrics, 52 weeks ── */
(function(){
  var canvas = document.getElementById('momentum-chart');
  var series = DATA.tierSeries;
  if (!canvas || !series || !series.length) return;
  var hint = document.getElementById('momentum-hint');
  var buttons = document.querySelectorAll('.tw-momentum__toggle button');
  var META = {
    count:  { title: 'Contracts signed by tier · weekly', hint: 'Weekly signed contracts by tier.', fmt: function(v){ return String(Math.round(v)); } },
    volume: { title: 'Dollar volume by tier · weekly', hint: 'Weekly signed dollar volume by tier.', fmt: function(v){ return '$' + (v >= 100 ? Math.round(v) : v.toFixed(1)) + 'M'; } },
    median: { title: 'Median contract price by tier · weekly', hint: 'Median signed price by tier. Weeks with no contracts in a tier are skipped.', fmt: function(v){ return '$' + v.toFixed(2) + 'M'; } },
    ppsf:   { title: 'Price per sq ft by tier · weekly', hint: 'Median price per square foot by tier.', fmt: function(v){ return '$' + Math.round(v).toLocaleString('en-US'); } },
    dom:    { title: 'Days on market by tier · weekly', hint: 'Average days on market by tier.', fmt: function(v){ return Math.round(v) + 'd'; } }
  };
  // Full ISO dates so the axis and the hover tooltip show the true week.
  var labels = series.map(function(pt){ return String(pt.week_start); });
  function pick(tier, metric) {
    return series.map(function(pt){
      var band = pt[tier];
      var v = band ? band[metric] : null;
      return (v === null || v === undefined || !isFinite(Number(v))) ? null : Number(v);
    });
  }
  var current = 'count';
  function draw() {
    var meta = META[current] || META.count;
    drawLineChart(canvas, {
      height: 260,
      scaleType: 'linear',
      pad: { t: 16, r: 18, b: 26, l: 58 },
      title: meta.title,
      xLabels: labels,
      connectGaps: true,
      yFmt: meta.fmt,
      series: [
        { data: pick('luxury', current), color: '#98A0A8', label: 'Luxury' },
        { data: pick('prime', current),  color: '#918C7E', label: 'Prime' },
        { data: pick('trophy', current), color: '#A37670', label: 'Trophy' }
      ]
    });
    if (hint) hint.textContent = meta.hint;
  }
  for (var i = 0; i < buttons.length; i++) {
    (function(btn){
      btn.addEventListener('click', function(){
        current = btn.getAttribute('data-metric') || 'count';
        for (var j = 0; j < buttons.length; j++) buttons[j].classList.remove('is-active');
        btn.classList.add('is-active');
        draw();
      });
    })(buttons[i]);
  }
  draw();
  window.addEventListener('resize', draw);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
})();


/* ── SCROLL REVEAL: fade-up sections/tables/stats, wipe canvas charts ── */
(function(){
  if (typeof IntersectionObserver === 'undefined') return;
  var targets = document.querySelectorAll(
    '.report-scope .section, .report-scope .week-hero, .report-scope .supply-strip, .report-scope .supply-half, ' +
    '.report-scope .pulse-summary, .report-scope .pulse-grid, .report-scope table, .report-scope .top-deal-row, ' +
    '.report-scope .type-trends__group, .report-scope .chart-holder, .report-scope .type-chart, ' +
    '.report-scope .data-key, .report-scope .tier-col'
  );
  for (var i = 0; i < targets.length; i++) targets[i].classList.add('reveal');
  var io = new IntersectionObserver(function(entries){
    for (var j = 0; j < entries.length; j++) {
      if (entries[j].isIntersecting) {
        entries[j].target.classList.add('in-view');
        io.unobserve(entries[j].target);
      }
    }
  }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
  targets.forEach(function(el){ io.observe(el); });
})();
`;
}

/* ─────────── route ─────────── */

export const Route = createFileRoute("/this-week")({
  loader: async () => {
    const row = await getLatestWeeklyReport();
    return { row };
  },
  head: () => ({
    links: [{ rel: "canonical", href: "https://domidata.heatherdomi.com/this-week" }],
    meta: [
      { title: "The Week \u2014 Manhattan Luxury \u00b7 Domi Data" },
      { name: "description", content: "Manhattan-wide weekly luxury signed-contract read: demand trend, luxury lines, market pulse, bedroom mix, neighborhood concentration, and supply & absorption." },
      { name: "robots", content: "index, follow, noai, noimageai, max-snippet:20, max-image-preview:none" },
      { property: "og:title", content: "The Week \u2014 Manhattan Luxury \u00b7 Domi Data" },
      { property: "og:description", content: "Manhattan-wide weekly luxury signed-contract read: demand trend, luxury lines, market pulse, bedroom mix, neighborhood concentration, and supply & absorption." },
    ],
    scripts: [
      breadcrumbScript(TRAILS.thisWeek),
      {
        // Speakable points only at The Week's one summary paragraph
        // (the volume read directly under the hero metrics).
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: "The Week \u2014 Manhattan Luxury \u00b7 Domi Data",
          url: "https://domidata.heatherdomi.com/this-week",
          speakable: {
            "@type": "SpeakableSpecification",
            cssSelector: ["#week-summary .sowhat__line"],
          },
        }),
      },
    ],
  }),
  errorComponent: ({ error }) => (
    <div className="site">
      <SiteHeader />
      <div style={{ padding: "80px 56px", textAlign: "center" }}>
        <h1 style={{ fontFamily: "Georgia, serif", fontSize: 28, marginBottom: 12 }}>
          This week's report is temporarily unavailable
        </h1>
        <p style={{ color: "#6B6560" }}>{error.message}</p>
      </div>
      <SiteFooter />
    </div>
  ),
  notFoundComponent: () => (
    <div className="site">
      <SiteHeader />
      <div style={{ padding: "80px 56px", textAlign: "center" }}>
        <h1 style={{ fontFamily: "Georgia, serif", fontSize: 28 }}>Report not found</h1>
      </div>
      <SiteFooter />
    </div>
  ),
  component: ReportPage,
});

function ReportPage() {
  const { row } = Route.useLoaderData();

  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || !row || !row.payload) return;
    const script = buildReportScript(row);
    const wrapped = "(function(){" + script + "\n})();";
    try {
      // eslint-disable-next-line no-new-func
      new Function(wrapped)();
    } catch (e) {
      console.error("Report script error:", e);
    }
    // Apply The Quarterly visual language: watermarks + staggered reveal.
    try {
      // eslint-disable-next-line no-new-func
      new Function(
        buildQrDesignScript({
          scopeSelector: ".report-scope",
          wmSel: "table, canvas:not(#momentum-chart)",
          revealSel: "section.section, .tbl-wrap, .qc-card, .leaderboard, canvas",
        }),
      )();
    } catch (e) {
      console.error("QR design script error:", e);
    }
  }, [row]);

  if (!row || !row.payload) {
    return (
      <div className="site">
        <SiteHeader />
        <style dangerouslySetInnerHTML={{ __html: REPORT_CSS + QR_DESIGN_CSS }} />
        <div className="report-scope">
          <section
            className="week-hero"
            style={{ textAlign: "center", padding: "96px 24px" }}
          >
            <h2
              className="section__title"
              style={{ fontFamily: "'Ivy Mode', Georgia, serif", fontSize: 32, marginBottom: 16 }}
            >
              This week's report isn't available yet
            </h2>
            <p
              className="section__note"
              style={{ color: "#6B6560", fontSize: 15, letterSpacing: "0.01em" }}
            >
              Check back shortly.
            </p>
          </section>
        </div>
        <SiteFooter />
      </div>
    );
  }


  return (
    <div className="site">
      <SiteHeader />
      <style dangerouslySetInnerHTML={{ __html: REPORT_CSS + QR_DESIGN_CSS }} />
      <div dangerouslySetInnerHTML={{ __html: QR_MONOGRAM_SVG }} />
      <main
        id="main-content"
        ref={ref}
        className="report-scope"
        dangerouslySetInnerHTML={{ __html: buildReportBody(row) }}
      />
      <section
        className="subscribe-section"
        style={{ padding: "80px 24px", display: "flex", justifyContent: "center" }}
      >
        <SubscribeForm />
      </section>
      <SiteFooter asOf={fmtDateLong(row.week_end)} />

    </div>
  );
}


// suppress unused warning; useRouter kept available for future retry actions
void useRouter;
