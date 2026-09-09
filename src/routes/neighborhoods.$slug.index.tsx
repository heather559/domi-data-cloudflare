import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import {
  getNeighborhoodReportBySlug,
  formatPeriodEndDate,
  type NeighborhoodReport,
} from "../lib/neighborhood-report.functions";
import { NeighborhoodReportPage } from "../components/NeighborhoodReportPage";
import { breadcrumbScript, neighborhoodTrail } from "../lib/breadcrumbs";

export const Route = createFileRoute("/neighborhoods/$slug/")({
  loader: async ({ params }) => {
    const report = await getNeighborhoodReportBySlug({ data: { slug: params.slug } });
    return { report, slug: params.slug };
  },
  head: ({ loaderData }) => {
    const p = loaderData?.report?.payload;
    const geo = p?.geo ? String(p.geo) : "Neighborhood";
    const period = p?.periodLabel ? String(p.periodLabel) : "";
    const title = p ? `${geo} — Domi Data · Heather Domi Team` : "Neighborhood — Domi Data";
    const desc = p
      ? `${geo} luxury signed-contract report${period ? ` · ${period}` : ""} — demand, luxury tiers, market pulse, supply and absorption.`
      : "Neighborhood report not yet available.";
    const canonical = `https://domidata.heatherdomi.com/neighborhoods/${loaderData?.slug ?? ""}`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { name: "robots", content: (p ? "index, follow" : "noindex") + ", noai, noimageai, max-snippet:20, max-image-preview:none" },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:url", content: canonical },
        { property: "og:type", content: "article" },
      ],
      links: p ? [{ rel: "canonical", href: canonical }] : [],
      scripts: p
        ? [
            {
              type: "application/ld+json",
              children: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Article",
                headline: `${geo} luxury signed contracts${period ? ` — ${period}` : ""}`,
                description: desc,
                url: canonical,
                mainEntityOfPage: canonical,
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
            breadcrumbScript(neighborhoodTrail(geo, loaderData?.slug ?? "")),

          ]
        : [],
    };
  },
  component: NeighborhoodPage,
});

function NeighborhoodPage() {
  const { report, slug } = Route.useLoaderData() as {
    report: NeighborhoodReport | null;
    slug: string;
  };

  if (!report || !report.payload) {
    const pretty = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    return (
      <div className="site">
        <SiteHeader />
        <div style={{ padding: "96px 56px", textAlign: "center" }}>
          <h1 style={{ fontFamily: "'Ivy Mode', Georgia, serif", fontSize: 32, marginBottom: 16 }}>
            {pretty} report not available
          </h1>
          <p style={{ color: "#6B6560", marginBottom: 20 }}>
            No neighborhood report has been published for this area yet.
          </p>
          <Link to="/neighborhoods" style={{ color: "#9E5040", fontWeight: 600 }}>
            ← Browse neighborhoods
          </Link>
        </div>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="site">
      <SiteHeader />
      <main id="main-content">
        <NeighborhoodReportPage report={report} slug={slug} />
      </main>

      <SiteFooter asOf={formatPeriodEndDate(report.period, String(report.payload.periodLabel ?? report.period ?? ""))} />
    </div>
  );
}
