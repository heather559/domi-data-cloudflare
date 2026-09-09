import { createFileRoute, notFound } from "@tanstack/react-router";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import { getBrief, formatBriefDate, type BriefBlock } from "../lib/briefs.data";

const BASE = "https://domidata.heatherdomi.com";

export const Route = createFileRoute("/briefs/$slug")({
  loader: ({ params }) => {
    const brief = getBrief(params.slug);
    if (!brief) throw notFound();
    return { brief };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Brief Unavailable · Domi Data" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const b = loaderData.brief;
    const title = `${b.title} · Domi Data Briefs`;
    const url = `${BASE}/briefs/${params.slug}`;
    return {
      links: [{ rel: "canonical", href: url }],
      meta: [
        { title },
        { name: "description", content: b.summary },
        { property: "og:title", content: title },
        { property: "og:description", content: b.summary },
        { property: "og:url", content: url },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: b.title,
            description: b.summary,
            datePublished: b.date,
            mainEntityOfPage: url,
            author: { "@type": "Person", name: "Heather Domi" },
            publisher: { "@type": "Organization", name: "Domi Data by Heather Domi" },
            articleSection: b.topic,
          }),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: `${BASE}/` },
              { "@type": "ListItem", position: 2, name: "Briefs", item: `${BASE}/briefs` },
              { "@type": "ListItem", position: 3, name: b.title, item: url },
            ],
          }),
        },
      ],
    };
  },
  notFoundComponent: BriefNotFound,
  component: BriefPage,
});

function Block({ block }: { block: BriefBlock }) {
  switch (block.kind) {
    case "lede":
      return <p className="brief-lede">{block.text}</p>;
    case "h":
      return <h2 className="brief-h">{block.text}</h2>;
    case "p":
      return <p>{block.text}</p>;
    case "note":
      return <p className="brief-note">{block.text}</p>;
    case "list":
      return (
        <ul className="brief-ul">
          {block.items.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      );
    case "link":
      return (
        <p>
          <a href={block.href}>{block.text}</a>
        </p>
      );
    case "xref":
      return (
        <p>
          {block.lead}{" "}
          <a className="xref" href={block.href}>
            {block.label}
          </a>
        </p>
      );

    case "table":
      return (
        <div className="brief-table-wrap">
          <table className="brief-table">
            <thead>
              <tr>
                {block.headers.map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {block.caption ? <figcaption className="brief-table__caption">{block.caption}</figcaption> : null}
        </div>
      );
    case "figure":
      return (
        <figure className="brief-figure">
          <span className="brief-figure__label">{block.label}</span>
          <span className="brief-figure__value">{block.value}</span>
          <figcaption>{block.caption}</figcaption>
        </figure>
      );
  }
}

function BriefPage() {
  const { brief } = Route.useLoaderData();

  return (
    <div className="site">
      <SiteHeader />
      <main id="main-content" className="page-shell">
        <div className="page-eyebrow">Domi Data Briefs</div>
        <h1 className="page-title">{brief.title}</h1>
        <p className="brief-meta">
          {formatBriefDate(brief.date)} · {brief.topic} · {brief.readMinutes} min read
        </p>
        <article className="page-body brief-body">
          {brief.body.map((block: BriefBlock, i: number) => (
            <Block key={i} block={block} />
          ))}
        </article>

        {brief.method ? <p className="brief-method">Method. {brief.method}</p> : null}

        <p className="page-footlink">
          <a href="/briefs">All briefs</a>
        </p>

        <p style={{ fontSize: "10.5px", color: "var(--mid)", marginTop: "20px", lineHeight: "1.7" }}>
          Data Source: Marketproof
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}

function BriefNotFound() {
  return (
    <div className="site">
      <SiteHeader />
      <main id="main-content" className="page-shell">
        <div className="page-eyebrow">Domi Data Briefs</div>
        <h1 className="page-title">Brief Not Found.</h1>
        <div className="page-body">
          <p>That brief is not published, or its address has changed.</p>
        </div>
        <p className="page-footlink">
          <a href="/briefs">See all briefs</a>
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
