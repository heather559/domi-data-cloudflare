import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import { getArchivedNeighborhoodMonth } from "../lib/neighborhood-archive.functions";
import { NeighborhoodReportPage } from "../components/NeighborhoodReportPage";
import { fmtDateLong } from "./this-week";

const BANNER_CSS = `
.archive-banner {
  display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
  margin: 24px 56px 0; padding: 14px 20px;
  background: var(--ground-hi,#FAF8F4); border-left: 3px solid var(--rust,#9E5040);
  font-size: 13px; color: var(--text,#1B1714);
  font-family: system-ui,-apple-system,'Helvetica Neue',Arial,sans-serif;
}
.archive-banner__icon { font-size: 15px; color: var(--rust,#9E5040); flex-shrink: 0; }
.archive-banner__text { flex: 1; min-width: 240px; line-height: 1.55; }
.archive-banner__link { font-weight: 600; color: var(--rust,#9E5040); text-decoration: none; letter-spacing: 0.04em; text-transform: uppercase; font-size: 11.5px; }
.archive-banner__link:hover { text-decoration: underline; }
@media (max-width: 640px) { .archive-banner { margin-left: 24px; margin-right: 24px; } }
`;

export const Route = createFileRoute("/neighborhoods/$slug/archive/$monthStart")({
  loader: async ({ params }) => {
    let report = null;
    try {
      report = await getArchivedNeighborhoodMonth({
        data: { slug: params.slug, monthStart: params.monthStart },
      });
    } catch (err) {
      // Malformed slug/month in the URL (e.g. /archive/2026-06): render the
      // "snapshot not available" view instead of a 500.
      console.error("[neighborhood archive] lookup failed:", err);
    }
    return { report, slug: params.slug, monthStart: params.monthStart };
  },

  head: ({ params, loaderData }) => {
    const p = loaderData?.report?.payload;
    const geo = p?.geo ? String(p.geo) : params.slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const label = fmtDateLong(params.monthStart) || params.monthStart;
    const canonical = `https://domidata.heatherdomi.com/neighborhoods/${params.slug}/archive/${params.monthStart}`;
    const title = `${geo} — ${label} — Locked Snapshot · Domi Data`;
    const desc = `Locked historical snapshot of ${geo}'s luxury signed-contract activity for ${label}.`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { name: "robots", content: (loaderData?.report ? "index, follow" : "noindex") + ", noai, noimageai, max-snippet:20, max-image-preview:none" },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:url", content: canonical },
        { property: "og:type", content: "article" },
      ],
      links: loaderData?.report ? [{ rel: "canonical", href: canonical }] : [],
      scripts: loaderData?.report
        ? [
            {
              type: "application/ld+json",
              children: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Article",
                headline: `${geo} luxury signed contracts — ${label}`,
                description: desc,
                url: canonical,
                mainEntityOfPage: canonical,
                datePublished: loaderData.report.archived_at,
                dateModified: loaderData.report.archived_at,
                author: { "@type": "Person", name: "Heather Domi", url: "https://heatherdomi.com" },
                publisher: {
                  "@type": "Organization",
                  name: "Domi Data",
                  logo: { "@type": "ImageObject", url: "https://domidata.heatherdomi.com/favicon-512.png" },
                },
                isPartOf: { "@type": "WebSite", name: "Domi Data", url: "https://domidata.heatherdomi.com" },
                about: { "@type": "Place", name: `${geo}, Manhattan, NY` },
              }),
            },
            {
              type: "application/ld+json",
              children: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                itemListElement: [
                  { "@type": "ListItem", position: 1, name: "Home", item: "https://domidata.heatherdomi.com/" },
                  { "@type": "ListItem", position: 2, name: "Neighborhoods", item: "https://domidata.heatherdomi.com/neighborhoods" },
                  { "@type": "ListItem", position: 3, name: geo, item: `https://domidata.heatherdomi.com/neighborhoods/${params.slug}` },
                  { "@type": "ListItem", position: 4, name: "Archive", item: `https://domidata.heatherdomi.com/neighborhoods/${params.slug}/archive` },
                  { "@type": "ListItem", position: 5, name: label, item: canonical },
                ],
              }),
            },
          ]
        : [],
    };
  },
  component: ArchivedNeighborhoodMonthPage,
});

function ArchivedNeighborhoodMonthPage() {
  const { report, slug, monthStart } = Route.useLoaderData();
  const pretty = slug.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());

  if (!report || !report.payload) {
    return (
      <div className="site">
        <SiteHeader />
        <div style={{ padding: "96px 56px", textAlign: "center" }}>
          <h1 style={{ fontFamily: "'Ivy Mode', Georgia, serif", fontSize: 32, marginBottom: 16 }}>
            Snapshot not found
          </h1>
          <p style={{ color: "#6B6560", marginBottom: 20 }}>
            No locked snapshot exists for {pretty} in that month.
          </p>
          <Link to="/neighborhoods/$slug/archive" params={{ slug }} style={{ color: "#9E5040", fontWeight: 600 }}>
            ← Back to {pretty} Archive
          </Link>
        </div>
        <SiteFooter />
      </div>
    );
  }

  const geo = String(report.payload.geo ?? pretty);
  const lockedLabel = fmtDateLong(report.archived_at.slice(0, 10)) || report.archived_at.slice(0, 10);

  return (
    <div className="site">
      <SiteHeader />
      <style dangerouslySetInnerHTML={{ __html: BANNER_CSS }} />
      <div className="archive-banner">
        <span className="archive-banner__icon" aria-hidden="true">🔒</span>
        <span className="archive-banner__text">
          This is a locked historical snapshot for {geo}. These figures are permanent and will not change, even if later corrections are made to the live report. Locked {lockedLabel}.
        </span>
        <Link to="/neighborhoods/$slug/archive" params={{ slug }} className="archive-banner__link">
          ← Back to Archive
        </Link>
      </div>
      <main id="main-content">
        <NeighborhoodReportPage report={report} slug={slug} />
      </main>

      <SiteFooter asOf={fmtDateLong(monthStart) || monthStart} />
    </div>
  );
}
