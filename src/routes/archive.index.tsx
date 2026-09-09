import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "../components/site-header";
import { SiteFooter, MP_PATH } from "../components/site-footer";
import domiDataLockupAsset from "../assets/hd-dd-lockup-v2.png.asset.json";
import { listWeeklyArchive, type ArchiveIndexEntry } from "../lib/weekly-archive.functions";
import { fmtDateLong, fmtWeekRange, REPORT_CSS } from "./this-week";

const domiDataLockup = domiDataLockupAsset.url;

const EMPTY = "—";
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
function fmtMoneyShort(n: number | null | undefined): string {
  if (!isNum(n)) return EMPTY;
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${Math.round(n / 1_000_000)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${Math.round(n)}`;
}
function fmtInt(n: number | null | undefined): string {
  return isNum(n) ? Math.round(n).toLocaleString() : EMPTY;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type MonthGroup = { year: number; month: number; entries: ArchiveIndexEntry[] };
type YearGroup = { year: number; months: MonthGroup[]; count: number };

function group(entries: ArchiveIndexEntry[]): YearGroup[] {
  const byYear = new Map<number, Map<number, ArchiveIndexEntry[]>>();
  for (const e of entries) {
    const d = new Date(e.week_start + "T00:00:00Z");
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();
    if (!byYear.has(y)) byYear.set(y, new Map());
    const monthMap = byYear.get(y)!;
    if (!monthMap.has(m)) monthMap.set(m, []);
    monthMap.get(m)!.push(e);
  }
  const years: YearGroup[] = [];
  const yearKeys = [...byYear.keys()].sort((a, b) => b - a);
  for (const y of yearKeys) {
    const monthMap = byYear.get(y)!;
    const monthKeys = [...monthMap.keys()].sort((a, b) => b - a);
    const months: MonthGroup[] = monthKeys.map((m) => ({
      year: y,
      month: m,
      entries: monthMap.get(m)!.sort((a, b) => (a.week_start < b.week_start ? 1 : -1)),
    }));
    years.push({ year: y, months, count: months.reduce((s, mm) => s + mm.entries.length, 0) });
  }
  return years;
}

const ARCHIVE_CSS = `
.archive-scope { background: var(--ground, #F5F0E8); color: var(--text, #1B1714); font-family: system-ui,-apple-system,'Helvetica Neue',Arial,sans-serif; padding-bottom: 96px; }
.archive-intro { max-width: 720px; padding: 32px 56px 8px; font-size: 14px; line-height: 1.7; color: var(--text-mid,#6B6560); }
.archive-wrap { padding: 24px 56px 0; }
.archive-year { border-top: 1px solid var(--rule,#DDD5C8); }
.archive-year:last-child { border-bottom: 1px solid var(--rule,#DDD5C8); }
.archive-year > summary, .archive-month > summary {
  list-style: none; cursor: pointer; padding: 18px 4px; display: flex; align-items: baseline; justify-content: space-between; gap: 16px;
  font-family: Georgia, 'Times New Roman', serif; color: var(--text,#1B1714);
}
.archive-year > summary::-webkit-details-marker, .archive-month > summary::-webkit-details-marker { display: none; }
.archive-year > summary::before, .archive-month > summary::before {
  content: '+'; display: inline-block; width: 14px; margin-right: 10px; color: var(--text-dim,#9E9A94); font-family: system-ui; font-weight: 400;
}
.archive-year[open] > summary::before, .archive-month[open] > summary::before { content: '−'; }
.archive-year__label { font-size: 22px; letter-spacing: 0.02em; }
.archive-year__count { font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--text-dim,#9E9A94); font-family: system-ui; }
.archive-month { margin-left: 8px; border-top: 1px dashed var(--rule,#DDD5C8); }
.archive-year > .archive-month:first-of-type { border-top: none; }
.archive-month__label { font-size: 16px; }
.archive-month__count { font-size: 10.5px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--text-dim,#9E9A94); font-family: system-ui; }
.archive-weeks { padding: 4px 0 12px 24px; }
.archive-week {
  display: grid; grid-template-columns: 1fr auto auto auto; align-items: baseline; gap: 24px;
  padding: 14px 4px; border-top: 1px solid var(--rule,#DDD5C8);
}
.archive-week:first-child { border-top: none; }
.archive-week__range { font-family: Georgia, serif; font-size: 15px; color: var(--text,#1B1714); }
.archive-week__stat { font-size: 12px; color: var(--text-mid,#6B6560); }
.archive-week__stat b { font-family: Georgia, serif; font-weight: 400; color: var(--text,#1B1714); font-size: 14px; margin-right: 4px; }
.archive-week__stat span { display: block; font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-dim,#9E9A94); margin-top: 2px; }
.archive-week__link { font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--rust,#9E5040); text-decoration: none; font-weight: 600; }
.archive-week__link:hover { text-decoration: underline; }
.archive-empty { padding: 48px 56px; color: var(--text-mid,#6B6560); font-style: italic; }
@media (max-width: 640px) {
  .archive-intro, .archive-wrap { padding-left: 24px; padding-right: 24px; }
  .archive-week { grid-template-columns: 1fr; gap: 6px; }
}
`;

export const Route = createFileRoute("/archive/")({
  loader: async () => {
    const entries = await listWeeklyArchive();
    return { entries };
  },
  head: () => ({
    links: [{ rel: "canonical", href: "https://domidata.heatherdomi.com/archive" }],
    meta: [
      { title: "Weekly Archive — Manhattan Luxury · Domi Data" },
      { name: "description", content: "Every locked weekly snapshot of Manhattan luxury signed-contract activity, newest to oldest." },
      { name: "robots", content: "index, follow, noai, noimageai, max-snippet:20, max-image-preview:none" },
      { property: "og:title", content: "Weekly Archive — Manhattan Luxury · Domi Data" },
      { property: "og:description", content: "Every locked weekly snapshot of Manhattan luxury signed-contract activity, newest to oldest." },
    ],
  }),

  component: ArchiveIndex,
});

function ArchiveIndex() {
  const { entries } = Route.useLoaderData();
  const years = group(entries);
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth();
  const total = entries.length;

  return (
    <div className="site">
      <SiteHeader />
      <style dangerouslySetInnerHTML={{ __html: REPORT_CSS }} />
      <style dangerouslySetInnerHTML={{ __html: ARCHIVE_CSS }} />
      <main id="main-content" className="report-scope archive-scope">
        <header className="tw-masthead">
          <div>
            <div className="tw-masthead__brand">Domi Data™ Luxury Lines</div>
            <h1 className="tw-masthead__title">Manhattan Luxury:<br />Archive</h1>
          </div>
          <div className="tw-masthead__meta">
            <strong>{total} week{total === 1 ? "" : "s"} recorded · Every locked weekly snapshot, newest to oldest</strong>
          </div>
        </header>

        <p className="archive-intro">
          Each week locks permanently 24 hours after publication, once confirmed clean. A locked week's figures never change afterward — even if the live <Link to="/this-week">The Week</Link> page is later corrected. Use this archive to compare any two weeks apples-to-apples, or to cite a specific snapshot.
        </p>

        <div className="archive-wrap">
          {years.length === 0 && <div className="archive-empty">No archived weeks yet.</div>}
          {years.map((yg) => {
            const isCurrentYear = yg.year === currentYear;
            return (
              <details key={yg.year} className="archive-year" open={isCurrentYear}>
                <summary>
                  <span className="archive-year__label">{yg.year}</span>
                  <span className="archive-year__count">{yg.count} week{yg.count === 1 ? "" : "s"}</span>
                </summary>
                {yg.months.map((mg) => {
                  const isCurrentMonth = isCurrentYear && mg.month === currentMonth;
                  return (
                    <details key={mg.month} className="archive-month" open={isCurrentMonth}>
                      <summary>
                        <span className="archive-month__label">{MONTH_NAMES[mg.month]}</span>
                        <span className="archive-month__count">{mg.entries.length} week{mg.entries.length === 1 ? "" : "s"}</span>
                      </summary>
                      <div className="archive-weeks">
                        {mg.entries.map((e) => (
                          <div key={e.week_start} className="archive-week">
                            <div className="archive-week__range">{fmtWeekRange(e.week_start, e.week_end)}</div>
                            <div className="archive-week__stat"><b>{fmtInt(e.luxury_count)}</b><span>Luxury contracts</span></div>
                            <div className="archive-week__stat"><b>{fmtMoneyShort(e.luxury_volume)}</b><span>Luxury volume</span></div>
                            <Link to="/archive/$weekStart" params={{ weekStart: e.week_start }} className="archive-week__link">View →</Link>
                          </div>
                        ))}
                      </div>
                    </details>
                  );
                })}
              </details>
            );
          })}
        </div>

        <details style={{ margin: "48px 56px 0", paddingTop: "24px", borderTop: "1px solid var(--rule,#DDD5C8)" }}>
          <summary style={{ fontSize: "10px", fontWeight: 700, letterSpacing: ".18em", textTransform: "uppercase", color: "var(--text-mid,#6B6560)", cursor: "pointer", fontFamily: "system-ui,-apple-system,'Helvetica Neue',Arial,sans-serif" }}>Abbreviations</summary>
          <ul style={{ marginTop: "12px", paddingLeft: "20px", fontSize: "13px", lineHeight: 1.8, color: "var(--text-mid,#6B6560)" }}>
            <li><strong>TTM</strong> · Trailing Twelve Months</li>
            <li><strong>YoY</strong> · Year over Year</li>
            <li><strong>QoQ</strong> · Quarter over Quarter</li>
            <li><strong>MoS</strong> · Months of Supply</li>
            <li><strong>DOF</strong> · Department of Finance</li>
          </ul>
        </details>
      </main>

      <SiteFooter />

    </div>
  );
}
