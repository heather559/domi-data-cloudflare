import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import { listBriefs, formatBriefDate } from "../lib/briefs.data";

const TITLE = "Domi Data Briefs · Special Reports on Manhattan Luxury";
const DESC =
  "Special reports from Domi Data. Long-form studies on Manhattan luxury contract activity, published when a single question deserves its own analysis.";
const URL = "https://domidata.heatherdomi.com/briefs";

export const Route = createFileRoute("/briefs/")({
  head: () => ({
    links: [{ rel: "canonical", href: URL }],
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:url", content: URL },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: "https://domidata.heatherdomi.com/" },
            { "@type": "ListItem", position: 2, name: "Briefs", item: URL },
          ],
        }),
      },
    ],
  }),
  component: BriefsIndex,
});

function BriefsIndex() {
  const briefs = listBriefs();

  return (
    <div className="site">
      <SiteHeader />
      <main id="main-content" className="page-shell">
        <div className="page-eyebrow">Domi Data Briefs</div>
        <h1 className="page-title">Special Reports.</h1>
        <div className="page-body">
          <p>
            The recurring reports run on a schedule. Briefs do not. A brief is published when a
            single question deserves its own study, a tax change, a new development wave, a shift in
            one segment that the weekly and quarterly cadence would flatten out.
          </p>
        </div>

        {briefs.length > 0 ? (
          <ul className="brief-list">
            {briefs.map((b) => (
              <li key={b.slug} className="brief-list__item">
                <a href={`/briefs/${b.slug}`}>
                  <span className="brief-list__date">
                    {formatBriefDate(b.date)} · {b.topic} · {b.readMinutes} min read
                  </span>
                  <span className="brief-list__title">{b.title}</span>
                  <span className="brief-list__summary">{b.summary}</span>
                </a>
              </li>
            ))}
            {/* PLACEHOLDER_BRIEFS rows hidden until each piece ships. */}
          </ul>
        ) : (

          <p className="page-footlink">
            The first brief is in preparation. In the meantime, see{" "}
            <a href="/this-week">The Week</a> for current activity, or the{" "}
            <a href="/quarterly-brief.html">The Quarterly</a> for the structural view.
          </p>
        )}

        <p style={{ fontSize: "10.5px", color: "var(--mid)", marginTop: "20px", lineHeight: "1.7" }}>
          Data Source: Marketproof
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
