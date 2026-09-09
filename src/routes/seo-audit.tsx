import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";

export const Route = createFileRoute("/seo-audit")({
  head: () => ({
    meta: [
      { title: "SEO Audit · Domi Data" },
      { name: "description", content: "Internal audit of JSON-LD, sitemap, RSS, meta tags, robots directives, analytics, and AEO bot access for domidata.heatherdomi.com." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "SEO Audit · Domi Data" },
      { property: "og:description", content: "Internal SEO and AEO readiness audit." },
    ],
    links: [{ rel: "canonical", href: "https://domidata.heatherdomi.com/seo-audit" }],
  }),
  component: SeoAudit,
});

type Status = "pass" | "warn" | "fail";
type Check = { label: string; status: Status; detail: string };
type Section = { title: string; eyebrow: string; checks: Check[] };

const sections: Section[] = [
  {
    eyebrow: "Structured Data",
    title: "JSON-LD",
    checks: [
      { label: "Organization schema on root", status: "pass", detail: "Organization + Person entities emitted from src/routes/__root.tsx across every page." },
      { label: "Dataset schema on The Week", status: "pass", detail: "Weekly report page emits Dataset JSON-LD with dateModified." },
      { label: "Article schema on neighborhood pages", status: "pass", detail: "Each /neighborhoods/[slug] emits Article JSON-LD with author reference." },
      { label: "Archive report schema", status: "pass", detail: "archive.$weekStart emits Article/Dataset JSON-LD." },
      { label: "FAQPage schema on evergreen pages", status: "fail", detail: "Not yet added to /about, /buy-sell, or neighborhood pages. Highest-impact AEO gap." },
      { label: "BreadcrumbList JSON-LD", status: "pass", detail: "Emitted from a shared trail source (src/lib/breadcrumbs.ts) on /this-week, /monthly, /neighborhoods, each neighborhood page, /report.html and /quarterly-brief.html." },
      { label: "SpeakableSpecification", status: "pass", detail: "WebPage node on The Week carries speakable.cssSelector targeting the summary read (#week-summary .sowhat__line)." },
    ],
  },
  {
    eyebrow: "Discoverability",
    title: "Sitemap",
    checks: [
      { label: "Dynamic sitemap route", status: "pass", detail: "src/routes/sitemap[.]xml.ts serves live XML from route enumeration." },
      { label: "Sitemap referenced in robots.txt", status: "pass", detail: "Sitemap directive points at https://domidata.heatherdomi.com/sitemap.xml." },
      { label: "Image sitemap entries", status: "pass", detail: "urlset declares the image namespace. Homepage hero and every neighborhood masthead emit <image:image> with the page's own alt text as caption, sourced from src/lib/neighborhood-banners.ts and src/lib/site-images.ts, so new photos are picked up automatically." },
      { label: "lastmod on dynamic entries", status: "pass", detail: "The Week and homepage carry the week_end date, The Month its month_end, each neighborhood page its report period, archive weeks their own week_start. Evergreen pages omit lastmod rather than claim a build stamp." },
    ],
  },
  {
    eyebrow: "Syndication",
    title: "RSS",
    checks: [
      { label: "RSS feed served at /rss.xml", status: "pass", detail: "src/routes/rss[.]xml.ts emits weekly report items." },
      { label: "Feed autodiscovery link", status: "pass", detail: "<link rel=\"alternate\" type=\"application/rss+xml\"> present in __root.tsx head." },
      { label: "Full-content items", status: "warn", detail: "Feed carries summaries only. Fine for AEO, but consider content:encoded for readers." },
    ],
  },
  {
    eyebrow: "Head Tags",
    title: "Meta",
    checks: [
      { label: "Unique title per route", status: "pass", detail: "Every leaf route sets its own <title> via head()." },
      { label: "Unique meta description per route", status: "pass", detail: "Descriptions differentiated across all public routes." },
      { label: "Canonical link per route", status: "pass", detail: "Absolute canonical URLs set per route." },
      { label: "og:title / og:description", status: "pass", detail: "Open Graph tags present on all indexable routes." },
      { label: "og:image / twitter:image", status: "pass", detail: "Branded 1200x630 share card (skyline hero, hd lockup, homepage headline) set as the sitewide default in __root.tsx with og:image, og:image:width/height, og:image:alt and twitter:image. Per-route cards would override it and are a worthwhile future enhancement, not shipped." },
      { label: "twitter:card", status: "pass", detail: "Set to summary_large_image at the root." },
    ],
  },
  {
    eyebrow: "Crawler Directives",
    title: "Robots",
    checks: [
      { label: "public/robots.txt served", status: "pass", detail: "File present and reachable at /robots.txt." },
      { label: "Wildcard Allow: /", status: "pass", detail: "User-agent: * gets Allow: / for baseline indexing." },
      { label: "AEO answer engines allowed", status: "pass", detail: "PerplexityBot, OAI-SearchBot, ClaudeBot, Claude-SearchBot, Applebot-Extended, Google-Extended all Allow: /." },
      { label: "Bulk scrapers blocked", status: "pass", detail: "GPTBot, CCBot, anthropic-ai, Bytespider, Meta-ExternalAgent, Diffbot, Amazonbot, YouBot, cohere-ai, Timpibot, ImagesiftBot, FacebookBot, omgili(bot) disallowed." },
      { label: "noindex on internal routes", status: "pass", detail: "/seo-dashboard and /seo-audit carry noindex, nofollow." },
    ],
  },
  {
    eyebrow: "Measurement",
    title: "Analytics",
    checks: [
      { label: "Google Analytics 4", status: "pass", detail: "G-B4RM7TNM38 loaded from __root.tsx and static reports." },
      { label: "Microsoft Clarity", status: "pass", detail: "Project xts9izdd10 installed sitewide." },
      { label: "HubSpot tracking", status: "pass", detail: "Portal 50792006 pixel installed sitewide." },
      { label: "Ahrefs Web Analytics", status: "pass", detail: "Key b39Bu5dQeMCvEb3rHwXGXg installed sitewide." },
      { label: "Semrush integration", status: "pass", detail: "Live via Standard Connectors gateway. Dashboard at /seo-dashboard." },
      { label: "Consent gating", status: "warn", detail: "No cookie-consent gate on analytics scripts. Fine in US; revisit if EU traffic grows." },
    ],
  },
  {
    eyebrow: "Answer Engines",
    title: "AEO Access",
    checks: [
      { label: "llms.txt at site root", status: "pass", detail: "public/llms.txt served. Perplexity and Anthropic read this map." },
      { label: "PerplexityBot", status: "pass", detail: "Explicitly allowed in robots.txt." },
      { label: "OAI-SearchBot (ChatGPT Search)", status: "pass", detail: "Explicitly allowed." },
      { label: "ClaudeBot / Claude-SearchBot", status: "pass", detail: "Both allowed for answer surfacing; Claude-Web (bulk training) blocked." },
      { label: "Google-Extended (AI Overviews)", status: "pass", detail: "Allowed. Google can use Domi Data pages in Gemini and AI Overviews." },
      { label: "Applebot-Extended", status: "pass", detail: "Allowed for Apple Intelligence surfaces." },
      { label: "Structured summaries for AEO", status: "warn", detail: "BreadcrumbList and SpeakableSpecification now shipped. FAQPage and HowTo schemas still missing on evergreen pages." },
    ],
  },
];

const overall = (() => {
  let pass = 0, warn = 0, fail = 0;
  for (const s of sections) for (const c of s.checks) {
    if (c.status === "pass") pass++;
    else if (c.status === "warn") warn++;
    else fail++;
  }
  return { pass, warn, fail, total: pass + warn + fail };
})();

const statusStyle: Record<Status, React.CSSProperties> = {
  pass: { background: "#EAF1EA", color: "#3E5A3E", border: "1px solid #B4C7B4" },
  warn: { background: "#F6EFE1", color: "#6B5626", border: "1px solid #D9C58E" },
  fail: { background: "#F6EEEA", color: "#6B3E39", border: "1px solid #AB736E" },
};
const statusLabel: Record<Status, string> = { pass: "Pass", warn: "Watch", fail: "Fail" };

function Pill({ status }: { status: Status }) {
  return (
    <span
      aria-label={`Status: ${statusLabel[status]}`}
      style={{
        display: "inline-block",
        padding: "3px 10px",
        fontSize: 11,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        fontWeight: 600,
        borderRadius: 999,
        whiteSpace: "nowrap",
        ...statusStyle[status],
      }}
    >
      {statusLabel[status]}
    </span>
  );
}

function SeoAudit() {
  return (
    <div className="site">
      <SiteHeader />
      <main id="main-content" className="page-shell">
        <div className="page-eyebrow">Internal</div>
        <h1 className="page-title">SEO &amp; AEO Audit.</h1>
        <p className="page-body" style={{ maxWidth: "62ch" }}>
          A snapshot of what's shipped and what's still open across structured data, sitemap, RSS, meta tags, robots directives, analytics, and answer-engine accessibility. This page is noindexed and not linked in the public navigation.
        </p>

        <section aria-label="Summary" style={{ marginTop: 32, display: "flex", gap: 16, flexWrap: "wrap" }}>
          <SummaryCard label="Pass" value={overall.pass} status="pass" />
          <SummaryCard label="Watch" value={overall.warn} status="warn" />
          <SummaryCard label="Fail" value={overall.fail} status="fail" />
          <SummaryCard label="Total checks" value={overall.total} />
        </section>

        {sections.map((section) => (
          <section key={section.title} style={{ marginTop: 48 }} aria-labelledby={`h-${section.title}`}>
            <div className="section-eyebrow" style={{ marginBottom: 8 }}>{section.eyebrow}</div>
            <h2 id={`h-${section.title}`} style={{ fontFamily: "'Ivy Mode', serif", fontWeight: 300, fontSize: 32, margin: "0 0 20px" }}>
              {section.title}
            </h2>
            <div style={{ border: "1px solid #E5E1DC", background: "#fff" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <caption className="sr-only">{section.title} audit checks</caption>
                <thead>
                  <tr style={{ background: "#F6F3EF", textAlign: "left" }}>
                    <th scope="col" style={th}>Check</th>
                    <th scope="col" style={{ ...th, width: 110 }}>Status</th>
                    <th scope="col" style={th}>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {section.checks.map((c) => (
                    <tr key={c.label} style={{ borderTop: "1px solid #EFEBE6" }}>
                      <td style={td}><strong style={{ fontWeight: 500 }}>{c.label}</strong></td>
                      <td style={td}><Pill status={c.status} /></td>
                      <td style={{ ...td, color: "#4A4640" }}>{c.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}

        <p className="page-body" style={{ marginTop: 48, fontSize: 13, color: "#6B665F", maxWidth: "70ch" }}>
          Statuses are maintained manually in <code>src/routes/seo-audit.tsx</code>. Update entries when infrastructure changes. For live crawl-side verification, trigger a scan from the SEO tab.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}

function SummaryCard({ label, value, status }: { label: string; value: number; status?: Status }) {
  return (
    <div
      style={{
        flex: "1 1 160px",
        padding: "18px 20px",
        border: "1px solid #E5E1DC",
        background: status ? statusStyle[status].background : "#fff",
        color: status ? statusStyle[status].color : "#1a1a1a",
      }}
    >
      <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600, opacity: 0.75 }}>{label}</div>
      <div style={{ fontFamily: "'Ivy Mode', serif", fontWeight: 300, fontSize: 40, marginTop: 4 }}>{value}</div>
    </div>
  );
}

const th: React.CSSProperties = {
  padding: "12px 16px",
  fontSize: 11,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  fontWeight: 600,
  color: "#4A4640",
  borderBottom: "1px solid #E5E1DC",
};
const td: React.CSSProperties = { padding: "14px 16px", verticalAlign: "top" };
