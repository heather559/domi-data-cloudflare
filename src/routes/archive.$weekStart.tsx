import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { SiteHeader } from "../components/site-header";
import { SiteFooter, MP_PATH } from "../components/site-footer";
import domiDataLockupAsset from "../assets/hd-dd-lockup-v2.png.asset.json";
import { getArchivedWeek } from "../lib/weekly-archive.functions";
import {
  buildReportBody,
  buildReportScript,
  fmtDateLong,
  REPORT_CSS,
} from "./this-week";

const domiDataLockup = domiDataLockupAsset.url;

const BANNER_CSS = `
.archive-banner {
  display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
  margin: 0 56px 0; padding: 14px 20px;
  background: var(--ground-hi,#FAF8F4); border-left: 3px solid var(--rust,#9E5040);
  font-size: 13px; color: var(--text,#1B1714);
}
.archive-banner__icon { font-size: 15px; color: var(--rust,#9E5040); flex-shrink: 0; }
.archive-banner__text { flex: 1; min-width: 240px; line-height: 1.55; }
.archive-banner__link { font-weight: 600; color: var(--rust,#9E5040); text-decoration: none; letter-spacing: 0.04em; text-transform: uppercase; font-size: 11.5px; }
.archive-banner__link:hover { text-decoration: underline; }
@media (max-width: 640px) { .archive-banner { margin-left: 24px; margin-right: 24px; } }
`;

export const Route = createFileRoute("/archive/$weekStart")({
  loader: async ({ params }) => {
    const row = await getArchivedWeek({ data: { weekStart: params.weekStart } });
    return { row };
  },
  head: ({ params, loaderData }) => {
    const label = loaderData?.row ? fmtDateLong(loaderData.row.week_start) : "Archived Week";
    const canonical = `https://domidata.heatherdomi.com/archive/${params.weekStart}`;
    const title = `Week of ${label} — Manhattan Luxury Archive · Domi Data`;
    const desc = `Locked snapshot of Manhattan luxury signed-contract activity for the week of ${label}.`;
    const row = loaderData?.row;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { name: "robots", content: (row ? "index, follow" : "noindex") + ", noai, noimageai, max-snippet:20, max-image-preview:none" },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:url", content: canonical },
        { property: "og:type", content: "article" },
      ],
      links: row ? [{ rel: "canonical", href: canonical }] : [],
      scripts: row
        ? [
            {
              type: "application/ld+json",
              children: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Article",
                headline: `Manhattan Luxury Signed Contracts — Week of ${label}`,
                description: desc,
                url: canonical,
                mainEntityOfPage: canonical,
                datePublished: (row as { archived_at?: string })?.archived_at ?? row.week_start,
                dateModified: (row as { archived_at?: string })?.archived_at ?? row.week_start,
                author: { "@type": "Person", name: "Heather Domi", url: "https://heatherdomi.com" },
                publisher: {
                  "@type": "Organization",
                  name: "Domi Data",
                  logo: { "@type": "ImageObject", url: "https://domidata.heatherdomi.com/favicon-512.png" },
                },
                isPartOf: { "@type": "WebSite", name: "Domi Data", url: "https://domidata.heatherdomi.com" },
              }),
            },
            {
              type: "application/ld+json",
              children: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                itemListElement: [
                  { "@type": "ListItem", position: 1, name: "Home", item: "https://domidata.heatherdomi.com/" },
                  { "@type": "ListItem", position: 2, name: "Archive", item: "https://domidata.heatherdomi.com/archive" },
                  { "@type": "ListItem", position: 3, name: `Week of ${label}`, item: canonical },
                ],
              }),
            },
          ]
        : [],
    };
  },
  component: ArchivedWeekPage,
});

function ArchivedWeekPage() {
  const { row } = Route.useLoaderData();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || !row || !row.payload) return;
    const script = buildReportScript(row);
    try {
      // eslint-disable-next-line no-new-func
      new Function("(function(){" + script + "\n})();")();
    } catch (e) {
      console.error("Archive script error:", e);
    }
  }, [row]);

  if (!row || !row.payload) {
    return (
      <div className="site">
        <SiteHeader />
        <div style={{ padding: "96px 56px", textAlign: "center" }}>
          <h1 style={{ fontFamily: "'Ivy Mode', Georgia, serif", fontSize: 32, marginBottom: 16 }}>
            Snapshot not found
          </h1>
          <p style={{ color: "#6B6560", marginBottom: 20 }}>
            No archived snapshot exists for that week.
          </p>
          <Link to="/archive" style={{ color: "#9E5040", fontWeight: 600 }}>← Back to Archive</Link>
        </div>
        <SiteFooter />
      </div>
    );
  }

  const titleHtml = `Manhattan Luxury:<br>Week of ${fmtDateLong(row.week_start)}`;
  const metaHtml = `<strong>${fmtDateLong(row.week_end)} · Archived Snapshot · Locked ${fmtDateLong(row.archived_at.slice(0, 10))}</strong>`;
  const bannerHtml = `
    <div class="archive-banner">
      <span class="archive-banner__icon" aria-hidden="true">🔒</span>
      <span class="archive-banner__text">This is a locked historical snapshot. These figures are permanent and will not change, even if later corrections are made to the live report.</span>
      <a href="/archive" class="archive-banner__link">← Back to Archive</a>
    </div>`;

  return (
    <div className="site">
      <SiteHeader />
      <style dangerouslySetInnerHTML={{ __html: REPORT_CSS }} />
      <style dangerouslySetInnerHTML={{ __html: BANNER_CSS }} />
      <main
        id="main-content"
        ref={ref}
        className="report-scope"
        dangerouslySetInnerHTML={{ __html: buildReportBody(row, { titleHtml, metaHtml, bannerHtml }) }}
      />

      <SiteFooter asOf={fmtDateLong(row.week_end)} />
    </div>
  );
}

