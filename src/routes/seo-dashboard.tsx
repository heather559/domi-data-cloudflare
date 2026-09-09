import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import { getSemrushDashboard, type SemrushDashboard } from "../lib/semrush.functions";

export const Route = createFileRoute("/seo-dashboard")({
  head: () => ({
    meta: [
      { title: "SEO Dashboard · Domi Data" },
      { name: "description", content: "Search visibility, backlinks, and referring-domain profile for domidata.heatherdomi.com. Powered by Semrush." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "SEO Dashboard · Domi Data" },
      { property: "og:description", content: "Internal SEO dashboard for Domi Data." },
    ],
    links: [{ rel: "canonical", href: "https://domidata.heatherdomi.com/seo-dashboard" }],
  }),
  loader: async () => await getSemrushDashboard(),
  component: SeoDashboard,
});

const fmtInt = (n: number | null | undefined) =>
  typeof n === "number" && Number.isFinite(n) ? Math.round(n).toLocaleString() : "—";
const fmtMoney = (n: number | null | undefined) =>
  typeof n === "number" && Number.isFinite(n) ? `$${Math.round(n).toLocaleString()}` : "—";
const fmtPct = (n: number | null | undefined) =>
  typeof n === "number" && Number.isFinite(n) ? `${Math.round(n * 100)}%` : "—";
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// Semrush returns history dates as YYYYMMDD strings.
const fmtMonth = (raw: string) => {
  const m = /^(\d{4})(\d{2})/.exec(raw ?? "");
  if (!m) return raw ?? "";
  const idx = Number(m[2]) - 1;
  const name = MONTH_NAMES[idx] ?? m[2];
  return `${name} ${m[1].slice(2)}`;
};
// Fixed UTC output so server and client render the same timestamp.
const fmtFetched = (raw: string) => {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw ?? "";
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}, ${hh}:${mm} UTC`;
};



function SeoDashboard() {
  const data = Route.useLoaderData() as SemrushDashboard;
  const { overview, backlinks, trend, topRefDomains, topAnchors, competitors, errors, quotaExhausted } = data;

  const trendPeak = Math.max(1, ...trend.map((t) => t.traffic || 0));

  return (
    <div className="site">
      <SiteHeader />
      <main id="main-content" className="page-shell">
        <div className="page-eyebrow">Search Visibility</div>
        <h1 className="page-title">SEO Dashboard.</h1>
        <p className="page-body" style={{ maxWidth: "62ch" }}>
          Live search-performance signals for <strong>heatherdomi.com</strong>, the root domain. Semrush currently rolls this report site into the root domain rather than indexing it separately, so these figures cover both. Numbers reflect Google's organic index only. Your real visitor count sits higher, since direct, social, and email visits are not counted here. Refreshed on page load.
        </p>


        {quotaExhausted && (
          <div style={{ margin: "24px 0", padding: "14px 18px", background: "#F6EEEA", border: "1px solid #AB736E", color: "#6B3E39", fontSize: 13 }}>
            Semrush quota exhausted. Some panels below may be empty until the daily reset or a plan upgrade.
          </div>
        )}

        {/* Overview cards */}
        <section style={{ marginTop: 40 }}>
          <h2 className="section-eyebrow" style={{ marginBottom: 16 }}>Overview</h2>
          <div style={grid4}>
            <Stat label="Organic Keywords" value={fmtInt(overview?.organicKeywords ?? null)} sub="Terms ranking in Google top 100" />
            <Stat label="Est. Monthly Visits" value={fmtInt(overview?.organicTraffic ?? null)} sub="From Google organic only" />
            <Stat label="Est. Traffic Value" value={fmtMoney(overview?.organicCost ?? null)} sub="What this traffic would cost in ads" />
            <Stat label="Global Domain Rank" value={fmtInt(overview?.rank ?? null)} sub="Lower is better" />
          </div>
        </section>

        {/* Trend */}
        <section style={{ marginTop: 56 }}>
          <h2 className="section-eyebrow" style={{ marginBottom: 16 }}>12-Month Trend</h2>
          {trend.length === 0 ? (
            <p style={muted}>No historical data available for this domain yet. Trend fills in as Semrush indexes more months.</p>
          ) : (
            <div style={{ border: "1px solid #E5E1DC", padding: "24px 28px 20px", background: "#FBFAF8" }}>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${trend.length}, 1fr)`, gap: 6, height: 160, alignItems: "end" }}>
                {trend.map((t) => {
                  const h = Math.max(2, Math.round((t.traffic / trendPeak) * 150));
                  return (
                    <div key={t.month} title={`${t.month}: ${fmtInt(t.traffic)} visits · ${fmtInt(t.keywords)} keywords`} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                      <div style={{ width: "100%", height: h, background: "#918C7E" }} />
                      <div style={{ fontSize: 10, color: "#797467", whiteSpace: "nowrap" }}>{fmtMonth(t.month)}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: 14, fontSize: 12, color: "#797467" }}>
                Bars show estimated monthly organic visits. Hover for exact keyword and visit counts.
              </div>
            </div>
          )}
        </section>

        {/* Backlinks */}
        <section style={{ marginTop: 56 }}>
          <h2 className="section-eyebrow" style={{ marginBottom: 16 }}>Backlink Profile</h2>
          <div style={grid4}>
            <Stat label="Authority Score" value={fmtInt(backlinks?.authorityScore ?? null)} sub="0 to 100. Trust and link strength." />
            <Stat label="Referring Domains" value={fmtInt(backlinks?.referringDomains ?? null)} sub="Unique sites linking in" />
            <Stat label="Total Backlinks" value={fmtInt(backlinks?.total ?? null)} sub="All inbound links counted" />
            <Stat label="Follow Ratio" value={fmtPct(backlinks?.followRatio ?? null)} sub="Share passing SEO authority" />
          </div>
        </section>

        {/* Competitors */}
        <section style={{ marginTop: 56 }}>
          <h2 className="section-eyebrow" style={{ marginBottom: 16 }}>Competitive Benchmark</h2>
          <p style={{ ...muted, marginBottom: 16, maxWidth: "62ch" }}>
            Side by side against the two established Manhattan contract reports. Numbers are Google organic estimates from Semrush, so real readership sits higher for all three.
          </p>
          {competitors.length === 0 ? (
            <p style={muted}>No competitor data returned.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={th}>Publisher</th>
                    <th style={th}>Domain</th>
                    <th style={{ ...th, textAlign: "right" }}>Keywords</th>
                    <th style={{ ...th, textAlign: "right" }}>Est. Visits</th>
                    <th style={{ ...th, textAlign: "right" }}>Traffic Value</th>
                    <th style={{ ...th, textAlign: "right" }}>Authority</th>
                    <th style={{ ...th, textAlign: "right" }}>Ref. Domains</th>
                  </tr>
                </thead>
                <tbody>
                  {competitors.map((c) => (
                    <tr key={c.domain}>
                      <td style={td}>{c.label}</td>
                      <td style={{ ...td, color: "#797467" }}>{c.domain}</td>
                      <td style={{ ...td, textAlign: "right" }}>{fmtInt(c.organicKeywords)}</td>
                      <td style={{ ...td, textAlign: "right" }}>{fmtInt(c.organicTraffic)}</td>
                      <td style={{ ...td, textAlign: "right" }}>{fmtMoney(c.organicCost)}</td>
                      <td style={{ ...td, textAlign: "right" }}>{fmtInt(c.authorityScore)}</td>
                      <td style={{ ...td, textAlign: "right" }}>{fmtInt(c.referringDomains)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Top Referring Domains */}
        <section style={{ marginTop: 56 }}>
          <h2 className="section-eyebrow" style={{ marginBottom: 16 }}>Top Referring Domains</h2>
          {topRefDomains.length === 0 ? (
            <p style={muted}>No referring domains yet.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={th}>Domain</th>
                    <th style={{ ...th, textAlign: "right" }}>Authority</th>
                    <th style={{ ...th, textAlign: "right" }}>Backlinks</th>
                  </tr>
                </thead>
                <tbody>
                  {topRefDomains.map((r) => (
                    <tr key={r.domain}>
                      <td style={td}>{r.domain}</td>
                      <td style={{ ...td, textAlign: "right" }}>{fmtInt(r.score)}</td>
                      <td style={{ ...td, textAlign: "right" }}>{fmtInt(r.backlinks)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Top Anchors */}
        <section style={{ marginTop: 56 }}>
          <h2 className="section-eyebrow" style={{ marginBottom: 16 }}>Top Anchor Text</h2>
          {topAnchors.length === 0 ? (
            <p style={muted}>No anchor data yet.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={th}>Anchor</th>
                    <th style={{ ...th, textAlign: "right" }}>Backlinks</th>
                    <th style={{ ...th, textAlign: "right" }}>Domains</th>
                  </tr>
                </thead>
                <tbody>
                  {topAnchors.map((a) => (
                    <tr key={a.anchor}>
                      <td style={td}>{a.anchor}</td>
                      <td style={{ ...td, textAlign: "right" }}>{fmtInt(a.backlinks)}</td>
                      <td style={{ ...td, textAlign: "right" }}>{fmtInt(a.domains)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p style={{ marginTop: 48, fontSize: 11, color: "#797467" }}>
          Fetched {fmtFetched(data.fetchedAt)}. Data source: Semrush.

          {errors.length > 0 && (
            <> · {errors.length} panel{errors.length === 1 ? "" : "s"} reported an error.</>
          )}
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div style={{ border: "1px solid #E5E1DC", padding: "20px 22px", background: "#FBFAF8" }}>
      <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#797467" }}>{label}</div>
      <div style={{ fontFamily: "'Ivy Mode', 'Cormorant Garamond', serif", fontSize: 34, marginTop: 8, color: "#1A1A1A" }}>{value}</div>
      <div style={{ fontSize: 11.5, color: "#797467", marginTop: 6, lineHeight: 1.5 }}>{sub}</div>
    </div>
  );
}

const grid4: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: 14,
};
const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,
};
const th: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  borderBottom: "1px solid #918C7E",
  fontSize: 11,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "#797467",
  fontWeight: 500,
};
const td: React.CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid #EDE9E7",
  color: "#1A1A1A",
};
const muted: React.CSSProperties = { color: "#797467", fontSize: 13 };
