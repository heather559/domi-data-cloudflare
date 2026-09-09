/**
 * Screen-reader-only chart data tables.
 *
 * Shared between `src/routes/this-week.tsx` and
 * `src/components/NeighborhoodReportPage.tsx` so that every canvas-drawn
 * chart on the site is paired with an accessible table exposing the same
 * series values. Visually hidden via inline styles (not `display:none`)
 * so the table remains in the accessibility tree.
 */

export const SR_ONLY_STYLE =
  "position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0;padding:0;margin:-1px;";

function escHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!),
  );
}

export function srCell(v: unknown, fmt?: (n: number) => string): string {
  if (v === null || v === undefined || (typeof v === "number" && !Number.isFinite(v))) return "—";
  if (typeof v === "number") return escHtml(fmt ? fmt(v) : v.toLocaleString());
  return escHtml(String(v));
}

export function srTable(
  caption: string,
  headers: string[],
  rows: Array<Array<unknown>>,
  fmts?: Array<((n: number) => string) | null>,
): string {
  if (!rows.length) return "";
  const thead = headers.map((h) => `<th scope="col">${escHtml(h)}</th>`).join("");
  const body = rows
    .map((r) => {
      const cells = r
        .map((c, i) => {
          const fmt = fmts && fmts[i] ? fmts[i]! : undefined;
          if (i === 0) return `<th scope="row">${srCell(c, fmt)}</th>`;
          return `<td>${srCell(c, fmt)}</td>`;
        })
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");
  return `<table style="${SR_ONLY_STYLE}"><caption>${escHtml(caption)}</caption><thead><tr>${thead}</tr></thead><tbody>${body}</tbody></table>`;
}

/** Zip a labels array with N parallel numeric series into row-wise data. */
export function zipSeries(
  labels: Array<string | number | null | undefined>,
  series: Array<Array<number | null | undefined>>,
): Array<Array<unknown>> {
  const n = labels.length;
  const rows: Array<Array<unknown>> = [];
  for (let i = 0; i < n; i++) {
    const row: Array<unknown> = [labels[i] ?? `#${i + 1}`];
    for (const s of series) row.push(s?.[i] ?? null);
    rows.push(row);
  }
  return rows;
}

/* ------------------------------------------------------------------ *
 * Chart trend summaries (aria-describedby targets)
 *
 * A data table gives a screen-reader user every figure, but reading 21
 * rows aloud does not convey shape. These helpers emit one short,
 * plain-English paragraph per chart stating direction, endpoints, net
 * change, and the high and low points, so the trend is available
 * without stepping through the table.
 * ------------------------------------------------------------------ */

export type SrSeries = {
  /** Series name as spoken, e.g. "Luxury (Top 10%)". */
  name: string;
  values: Array<number | null | undefined>;
  /** Formatter for figures in the sentence. Defaults to locale integer. */
  fmt?: (n: number) => string;
};

/** Visually hidden paragraph carrying a chart summary. Pair with aria-describedby. */
export function srSummary(id: string, text: string): string {
  if (!text) return "";
  return `<p id="${escHtml(id)}" style="${SR_ONLY_STYLE}">${escHtml(text)}</p>`;
}

function finite(vs: Array<number | null | undefined> | null | undefined): Array<{ v: number; i: number }> {
  const out: Array<{ v: number; i: number }> = [];
  if (!Array.isArray(vs)) return out;
  vs.forEach((v, i) => {
    if (typeof v === "number" && Number.isFinite(v)) out.push({ v, i });
  });
  return out;
}

function label(labels: Array<string | number | null | undefined>, i: number): string {
  const l = labels[i];
  return l === null || l === undefined || l === "" ? `period ${i + 1}` : String(l);
}

function pctPhrase(from: number, to: number): string {
  if (from === 0) return to === 0 ? "with no change" : "from a base of zero";
  const pct = ((to - from) / Math.abs(from)) * 100;
  const mag = Math.abs(pct);
  if (mag < 1) return "essentially unchanged";
  const dir = pct > 0 ? "up" : "down";
  return `${dir} ${mag >= 10 ? Math.round(mag) : mag.toFixed(1)} percent`;
}

function direction(from: number, to: number): string {
  if (from === 0) return "moves";
  const pct = Math.abs(((to - from) / Math.abs(from)) * 100);
  if (pct < 1) return "holds roughly flat";
  return to > from ? "rises" : "falls";
}

/**
 * Summarize one or more numeric series plotted against shared labels.
 * Produces: overall span, then one clause per series with endpoints,
 * net change, and high/low.
 */
export function describeSeries(
  chartKind: string,
  labels: Array<string | number | null | undefined>,
  series: SrSeries[],
): string {
  const usable = series.filter((s) => finite(s.values).length >= 2);
  if (!usable.length) return `${chartKind}. Figures are listed in the table that follows.`;

  const span = finite(usable[0].values);
  const head = `${chartKind} covering ${span.length} periods from ${label(labels, span[0].i)} to ${label(
    labels,
    span[span.length - 1].i,
  )}.`;

  const parts = usable.map((s) => {
    const pts = finite(s.values);
    const f = s.fmt ?? ((n: number) => n.toLocaleString());
    const first = pts[0];
    const last = pts[pts.length - 1];
    let hi = pts[0];
    let lo = pts[0];
    for (const p of pts) {
      if (p.v > hi.v) hi = p;
      if (p.v < lo.v) lo = p;
    }
    const verb = direction(first.v, last.v);
    const change = pctPhrase(first.v, last.v);
    const base = `${s.name} ${verb} from ${f(first.v)} in ${label(labels, first.i)} to ${f(last.v)} in ${label(
      labels,
      last.i,
    )}, ${change}`;
    // Only mention extremes when they sit away from the endpoints.
    const hiInteresting = hi.i !== first.i && hi.i !== last.i;
    const loInteresting = lo.i !== first.i && lo.i !== last.i;
    if (hiInteresting && loInteresting) {
      return `${base}, peaking at ${f(hi.v)} in ${label(labels, hi.i)} and bottoming at ${f(lo.v)} in ${label(labels, lo.i)}.`;
    }
    if (hiInteresting) return `${base}, peaking at ${f(hi.v)} in ${label(labels, hi.i)}.`;
    if (loInteresting) return `${base}, with a low of ${f(lo.v)} in ${label(labels, lo.i)}.`;
    return `${base}.`;
  });

  return `${head} ${parts.join(" ")}`;
}

/**
 * Summarize a categorical breakdown such as a donut: total, largest and
 * smallest slice, and each slice's share.
 */
export function describeParts(
  chartKind: string,
  parts: Array<{ label: string; value: number | null | undefined }>,
  fmt?: (n: number) => string,
): string {
  const pts = parts.filter(
    (p): p is { label: string; value: number } => typeof p.value === "number" && Number.isFinite(p.value),
  );
  if (!pts.length) return `${chartKind}. Figures are listed in the table that follows.`;
  const f = fmt ?? ((n: number) => n.toLocaleString());
  const total = pts.reduce((a, b) => a + b.value, 0);
  const share = (v: number) => (total > 0 ? `${Math.round((v / total) * 100)} percent` : "no measurable share");
  const sorted = [...pts].sort((a, b) => b.value - a.value);
  const top = sorted[0];
  const bottom = sorted[sorted.length - 1];
  const head = `${chartKind} across ${pts.length} categories totalling ${f(total)}.`;
  if (pts.length === 1) return `${head} All of it is ${top.label}.`;
  const breakdown = sorted.map((p) => `${p.label} ${f(p.value)}, ${share(p.value)}`).join("; ");
  return `${head} Largest is ${top.label} at ${f(top.value)}, ${share(top.value)} of the total. Smallest is ${bottom.label} at ${f(bottom.value)}, ${share(bottom.value)}. Full breakdown: ${breakdown}.`;
}
