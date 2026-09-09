// Server-only helpers shared by the weekly and monthly Excel builders.
import * as XLSX from "xlsx";

export type Cell = string | number | null;

/** Plain number, or blank when the source had nothing usable. */
export function n(v: unknown): Cell {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Payload percentages arrive as 12.4 meaning 12.4%. Excel wants 0.124. */
export function pct(v: unknown): Cell {
  return typeof v === "number" && Number.isFinite(v) ? v / 100 : null;
}

/** A ratio that is already a fraction (0.124 = 12.4%). */
export function frac(v: unknown): Cell {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Delta of a value against a baseline, as a fraction. */
export function delta(value: unknown, baseline: unknown): Cell {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (typeof baseline !== "number" || !Number.isFinite(baseline) || baseline === 0) return null;
  return value / baseline - 1;
}

/** Mean of the `count` entries ending just before `index`. Null when short. */
export function trailingAvg(series: (number | null)[], index: number, count: number): number | null {
  const start = index - count;
  if (start < 0) return null;
  const window = series.slice(start, index).filter((v): v is number => typeof v === "number");
  if (window.length < count) return null;
  return window.reduce((a, b) => a + b, 0) / count;
}

export const FMT = {
  int: "#,##0",
  dec: "#,##0.0",
  money: "$#,##0",
  money2: "$#,##0.00",
  pct: "0.0%",
} as const;

const PCT_HEADER = /%|\bWoW\b|\bYoY\b|\bMoM\b|\bvs\b|share|discount|absorption|\brate\b/i;
const MONEY_HEADER = /\(\$\)|\$\s*\/|\bcutoff\b|\bvolume\b|\bmedian\b|\bprice\b|\bsale\b|\bdollar volume\b/i;
const DEC_HEADER = /months of supply|\bavg\b|average|rolling/i;

/** True when a header or row label describes a dollar figure. */
export function isMoneyLabel(label: unknown): boolean {
  const t = String(label ?? "");
  return !!t && !PCT_HEADER.test(t) && MONEY_HEADER.test(t);
}

/**
 * Number formats inferred from the header row, so a dollar column always gets a
 * dollar sign and a percentage column always gets a percent sign. Overrides win.
 */
export function autoFormats(
  header: Cell[],
  overrides: Record<number, string> = {},
): Record<number, string> {
  const out: Record<number, string> = {};
  header.forEach((h, i) => {
    const t = String(h ?? "");
    if (!t) return;
    if (PCT_HEADER.test(t)) out[i] = FMT.pct;
    else if (MONEY_HEADER.test(t)) out[i] = FMT.money;
    else if (DEC_HEADER.test(t)) out[i] = FMT.dec;
    else out[i] = FMT.int;
  });
  return { ...out, ...overrides };
}

/** "$62M" / "$8.60M" / "$1.2B" / "$450K" -> a real number. */
export function parseMoneyDisplay(v: unknown): Cell {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v !== "string") return null;
  const m = v.replace(/,/g, "").match(/-?\$?\s*(\d+(?:\.\d+)?)\s*([KMB])?/i);
  if (!m) return null;
  const base = Number(m[1]);
  if (!Number.isFinite(base)) return null;
  const mult = { k: 1e3, m: 1e6, b: 1e9 }[(m[2] ?? "").toLowerCase()] ?? 1;
  return (v.trim().startsWith("-") ? -base : base) * mult;
}

/** "+12.3%" / "-5%" -> 0.123 / -0.05. */
export function parsePctDisplay(v: unknown): Cell {
  if (typeof v !== "string") return null;
  const m = v.replace(/,/g, "").match(/([+-]?\d+(?:\.\d+)?)\s*%/);
  if (!m) return null;
  const num = Number(m[1].replace("+", ""));
  if (!Number.isFinite(num)) return null;
  return num / 100;
}

export interface RowRule {
  /** Column holding the row label on vertical, metric-per-row sheets. */
  labelCol: number;
  /** Columns that carry the metric's own units and follow the label. */
  valueCols: number[];
}

export function sheet(
  wb: XLSX.WorkBook,
  name: string,
  aoa: Cell[][],
  widths: number[],
  formats: Record<number, string> = {},
  rowRule?: RowRule,
) {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = widths.map((w) => ({ wch: w }));
  ws["!freeze"] = { xSplit: 0, ySplit: 1 };

  // A row of only text in more than one column starts a new sub-table, so the
  // columns below it are formatted from that sub-header rather than the top one.
  const isHeaderRow = (row: Cell[] | undefined) => {
    if (!row || row.length < 2) return false;
    const filled = row.filter((c) => c !== null && c !== "" && c !== undefined);
    return filled.length > 1 && filled.every((c) => typeof c === "string");
  };

  let active = formats;
  for (let r = 1; r < aoa.length; r += 1) {
    const row = aoa[r];
    if (isHeaderRow(row)) {
      active = autoFormats(row);
      continue;
    }
    for (const [colStr, fmt] of Object.entries(active)) {
      const cell = ws[XLSX.utils.encode_cell({ r, c: Number(colStr) })];
      if (cell && cell.t === "n") cell.z = fmt;
    }
    if (rowRule && isMoneyLabel(row?.[rowRule.labelCol])) {
      for (const col of rowRule.valueCols) {
        const cell = ws[XLSX.utils.encode_cell({ r, c: col })];
        if (cell && cell.t === "n") cell.z = FMT.money;
      }
    }
  }
  XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
}
