import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import { listNeighborhoodArchive, type NeighborhoodArchiveIndexEntry } from "../lib/neighborhood-archive.functions";
import { REPORT_CSS } from "./this-week";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function fmtMonthLabel(monthStart: string): string {
  const d = new Date(monthStart + "T00:00:00Z");
  return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function fmtLockedAgo(archivedAt: string): string {
  const then = new Date(archivedAt);
  const now = new Date();
  const days = Math.max(0, Math.floor((now.getTime() - then.getTime()) / 86400000));
  if (days < 1) return "locked today";
  if (days < 30) return `locked ${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `locked ${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(months / 12);
  return `locked ${years} year${years === 1 ? "" : "s"} ago`;
}

type YearGroup = { year: number; entries: NeighborhoodArchiveIndexEntry[] };

function group(entries: NeighborhoodArchiveIndexEntry[]): YearGroup[] {
  const byYear = new Map<number, NeighborhoodArchiveIndexEntry[]>();
  for (const e of entries) {
    const y = new Date(e.month_start + "T00:00:00Z").getUTCFullYear();
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y)!.push(e);
  }
  const years: YearGroup[] = [];
  const yearKeys = [...byYear.keys()].sort((a, b) => b - a);
  for (const y of yearKeys) {
    years.push({
      year: y,
      entries: byYear.get(y)!.sort((a, b) => (a.month_start < b.month_start ? 1 : -1)),
    });
  }
  return years;
}

const NEIGH_ARCHIVE_CSS = `
.neigh-archive-scope { background: var(--ground, #F5F0E8); color: var(--text, #1B1714); font-family: system-ui,-apple-system,'Helvetica Neue',Arial,sans-serif; padding-bottom: 96px; }
.neigh-archive-intro { max-width: 720px; padding: 32px 56px 8px; font-size: 14px; line-height: 1.7; color: var(--text-mid,#6B6560); }
.neigh-archive-wrap { padding: 24px 56px 0; }
.neigh-archive-year { border-top: 1px solid var(--rule,#DDD5C8); }
.neigh-archive-year:last-child { border-bottom: 1px solid var(--rule,#DDD5C8); }
.neigh-archive-year > summary {
  list-style: none; cursor: pointer; padding: 18px 4px; display: flex; align-items: baseline; justify-content: space-between; gap: 16px;
  font-family: Georgia, 'Times New Roman', serif; color: var(--text,#1B1714);
}
.neigh-archive-year > summary::-webkit-details-marker { display: none; }
.neigh-archive-year > summary::before {
  content: '+'; display: inline-block; width: 14px; margin-right: 10px; color: var(--text-dim,#9E9A94); font-family: system-ui; font-weight: 400;
}
.neigh-archive-year[open] > summary::before { content: '−'; }
.neigh-archive-year__label { font-size: 22px; letter-spacing: 0.02em; }
.neigh-archive-year__count { font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--text-dim,#9E9A94); font-family: system-ui; }
.neigh-archive-months { padding: 4px 0 12px 24px; }
.neigh-archive-month {
  display: grid; grid-template-columns: 1fr auto auto auto; align-items: baseline; gap: 24px;
  padding: 14px 4px; border-top: 1px solid var(--rule,#DDD5C8);
}
.neigh-archive-month:first-child { border-top: none; }
.neigh-archive-month__label { font-family: Georgia, serif; font-size: 15px; color: var(--text,#1B1714); }
.neigh-archive-month__stat { font-size: 12px; color: var(--text-mid,#6B6560); }
.neigh-archive-month__stat b { font-family: Georgia, serif; font-weight: 400; color: var(--text,#1B1714); font-size: 14px; margin-right: 4px; }
.neigh-archive-month__stat span { display: block; font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-dim,#9E9A94); margin-top: 2px; }
.neigh-archive-month__locked { font-size: 11px; font-style: italic; color: var(--text-dim,#9E9A94); }
.neigh-archive-month__link { font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--rust,#9E5040); text-decoration: none; font-weight: 600; }
.neigh-archive-month__link:hover { text-decoration: underline; }
.neigh-archive-empty { padding: 48px 56px; color: var(--text-mid,#6B6560); font-style: italic; }
@media (max-width: 640px) {
  .neigh-archive-intro, .neigh-archive-wrap { padding-left: 24px; padding-right: 24px; }
  .neigh-archive-month { grid-template-columns: 1fr; gap: 6px; }
}
`;

export const Route = createFileRoute("/neighborhoods/$slug/archive/")({
  loader: async ({ params }) => {
    const entries = await listNeighborhoodArchive({ data: { slug: params.slug } });
    return { entries, slug: params.slug };
  },
  head: ({ params, loaderData }) => {
    const geo = loaderData?.entries?.[0]?.geo ?? params.slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const canonical = `https://domidata.heatherdomi.com/neighborhoods/${params.slug}/archive`;
    const title = `${geo} Archive — Manhattan Luxury · Domi Data`;
    const desc = `Every locked monthly snapshot of ${geo}'s luxury signed-contract activity, newest to oldest.`;
    return {
      links: [{ rel: "canonical", href: canonical }],
      meta: [
        { title },
        { name: "description", content: desc },
        { name: "robots", content: "index, follow, noai, noimageai, max-snippet:20, max-image-preview:none" },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
      ],
    };
  },
  component: NeighborhoodArchiveIndex,
});

function NeighborhoodArchiveIndex() {
  const { entries, slug } = Route.useLoaderData();
  const years = group(entries);
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const total = entries.length;
  const geo = entries[0]?.geo ?? slug.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());

  return (
    <div className="site">
      <SiteHeader />
      <style dangerouslySetInnerHTML={{ __html: REPORT_CSS }} />
      <style dangerouslySetInnerHTML={{ __html: NEIGH_ARCHIVE_CSS }} />
      <main id="main-content" className="report-scope neigh-archive-scope">
        <header className="tw-masthead">
          <div>
            <div className="tw-masthead__brand">Domi Data™ Luxury Lines</div>
            <h1 className="tw-masthead__title">{geo}:<br />Archive</h1>
          </div>
          <div className="tw-masthead__meta">
            <strong>{total} month{total === 1 ? "" : "s"} recorded · Every locked monthly snapshot, newest to oldest</strong>
          </div>
        </header>

        <p className="neigh-archive-intro">
          Each month locks permanently 24 hours after publication, once confirmed clean. A locked month's figures never change afterward — even if the live{" "}
          <Link to="/neighborhoods/$slug" params={{ slug }}>{geo}</Link> page is later corrected. Use this archive to compare any two months for {geo} apples-to-apples, or to cite a specific snapshot.
        </p>

        <div className="neigh-archive-wrap">
          {years.length === 0 && <div className="neigh-archive-empty">No archived months yet for {geo}.</div>}
          {years.map((yg) => {
            const isCurrentYear = yg.year === currentYear;
            return (
              <details key={yg.year} className="neigh-archive-year" open={isCurrentYear}>
                <summary>
                  <span className="neigh-archive-year__label">{yg.year}</span>
                  <span className="neigh-archive-year__count">{yg.entries.length} month{yg.entries.length === 1 ? "" : "s"}</span>
                </summary>
                <div className="neigh-archive-months">
                  {yg.entries.map((e) => (
                    <div key={e.month_start} className="neigh-archive-month">
                      <div className="neigh-archive-month__label">{fmtMonthLabel(e.month_start)}</div>
                      <div className="neigh-archive-month__stat">
                        <b>{e.luxury_count != null ? e.luxury_count.toLocaleString() : "—"}</b>
                        <span>Luxury contracts</span>
                      </div>
                      <div className="neigh-archive-month__locked">{fmtLockedAgo(e.archived_at)}, permanent</div>
                      <Link to="/neighborhoods/$slug/archive/$monthStart" params={{ slug, monthStart: e.month_start }} className="neigh-archive-month__link">
                        View →
                      </Link>
                    </div>
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
