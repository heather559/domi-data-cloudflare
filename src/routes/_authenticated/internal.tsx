import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAdminRole } from "@/hooks/use-admin-role";
import { getReconciliationFlags } from "@/lib/weekly-reconciliation.functions";

// Internal, non-public site index. Not linked from any public page, excluded
// from the sitemap, and marked noindex/nofollow. It exists so the team can
// always find every route, tool, and job endpoint in one place.

export const Route = createFileRoute("/_authenticated/internal")({
  head: () => ({
    meta: [
      { title: "Site index · internal" },
      {
        name: "description",
        content: "Internal index of every page, tool, and job endpoint on Domi Data.",
      },
      { name: "robots", content: "noindex, nofollow, noai, noimageai" },
    ],
  }),
  component: InternalIndexPage,
});

const NEIGHBORHOODS: { name: string; slug: string }[] = [
  { name: "Tribeca", slug: "tribeca" },
  { name: "Upper East Side", slug: "upper-east-side" },
  { name: "West Village", slug: "west-village" },
  { name: "Upper West Side", slug: "upper-west-side" },
  { name: "Lenox Hill", slug: "lenox-hill" },
  { name: "Midtown", slug: "midtown" },
  { name: "Lincoln Square", slug: "lincoln-square" },
  { name: "Greenwich Village", slug: "greenwich-village" },
  { name: "West Chelsea", slug: "west-chelsea" },
  { name: "SoHo", slug: "soho" },
];

type Entry = { path: string; label: string; note?: string };

const PUBLIC_PAGES: Entry[] = [
  { path: "/", label: "Home", note: "Report hub" },
  { path: "/this-week", label: "The Week", note: "Live weekly report" },
  { path: "/monthly", label: "The Month", note: "Gated. Append ?preview=1" },
  { path: "/archive", label: "Weekly archive index" },
  { path: "/neighborhoods", label: "Neighborhoods index" },
  { path: "/briefs", label: "Briefs index" },
  { path: "/buy-sell", label: "Buy / Sell" },
  { path: "/about", label: "About" },
  { path: "/contact", label: "Contact" },
  { path: "/accessibility", label: "Accessibility statement" },
];

const INTERNAL_TOOLS: Entry[] = [
  { path: "/monthly-archive", label: "The Month archive", note: "Frozen editions of the monthly report. Snapshot the current month here." },
  { path: "/lux-registry", label: "Luxury registry", note: "All neighborhoods with 11+ trailing luxury contracts" },
  { path: "/sowhat-debug", label: "So What debugger", note: "Contradiction audit, review notes, CSV and XLSX export" },
  { path: "/pipeline-runs", label: "Pipeline runs", note: "Agent run status, filters, CSV export" },
  { path: "/seo-dashboard", label: "SEO dashboard", note: "Semrush figures for heatherdomi.com" },
  { path: "/seo-audit", label: "SEO audit" },
];

const FEEDS: Entry[] = [
  { path: "/sitemap.xml", label: "Sitemap" },
  { path: "/rss.xml", label: "RSS feed" },
  { path: "/report.html", label: "Foundational report (static)" },
  { path: "/quarterly-brief.html", label: "The Quarter brief (static)" },
];

const JOBS: Entry[] = [
  {
    path: "/api/public/archive-resnapshot",
    label: "Archive resnapshot",
    note: "POST ?month=YYYY-MM-DD with the shared export secret. Optional slugs list. Writes an audit row.",
  },
  {
    path: "/api/public/weekly-reconciliation",
    label: "Weekly reconciliation",
    note: "POST ?weeks=8 with the shared export secret. Compares hero totals against the activity leaderboard and flags mismatches. Runs hourly.",
  },
];

export default function InternalIndexPage() {
  const { state, email } = useAdminRole();
  const navigate = useNavigate();

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { redirect: undefined }, replace: true });
  }

  if (state === "loading") {
    return (
      <main className="internal-index">
        <p className="lede">Checking access…</p>
        <style>{css}</style>
      </main>
    );
  }

  if (state === "denied") {
    return (
      <main className="internal-index">
        <p className="eyebrow">Internal</p>
        <h1>Access restricted</h1>
        <p className="lede">
          {email ? `${email} is signed in but does not have admin access.` : "No admin access."}{" "}
          Ask Heather to grant your account the admin role, then reload this page.
        </p>
        <p>
          <button type="button" className="linklike" onClick={signOut}>
            Sign out
          </button>
        </p>
        <style>{css}</style>
      </main>
    );
  }

  return (
    <main className="internal-index">
      <header>
        <p className="eyebrow">Internal</p>
        <h1>Site index</h1>
        <p className="lede signed-in">
          Signed in as {email}.{" "}
          <button type="button" className="linklike" onClick={signOut}>
            Sign out
          </button>
        </p>
        <p className="lede">
          Every page, tool, and job endpoint in one place. This page is not linked publicly,
          is excluded from the sitemap, and carries a noindex directive.
        </p>
      </header>

      <Section title="Public pages" entries={PUBLIC_PAGES} />
      <Section title="Internal tools" entries={INTERNAL_TOOLS} />

      <section>
        <h2>Neighborhood pages and archives</h2>
        <table>
          <thead>
            <tr>
              <th scope="col">Neighborhood</th>
              <th scope="col">Live page</th>
              <th scope="col">Archive</th>
            </tr>
          </thead>
          <tbody>
            {NEIGHBORHOODS.map((n) => (
              <tr key={n.slug}>
                <th scope="row">{n.name}</th>
                <td>
                  <Link to="/neighborhoods/$slug" params={{ slug: n.slug }}>
                    /neighborhoods/{n.slug}
                  </Link>
                </td>
                <td>
                  <Link to="/neighborhoods/$slug/archive" params={{ slug: n.slug }}>
                    /neighborhoods/{n.slug}/archive
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="note">
          A frozen month sits at /neighborhoods/{"{slug}"}/archive/{"{YYYY-MM-DD}"}, for example
          /neighborhoods/tribeca/archive/2026-06-01.
        </p>
      </section>
      <ReconciliationSection />

      <Section title="Feeds and static files" entries={FEEDS} external />
      <Section title="Job endpoints" entries={JOBS} external />

      <style>{css}</style>
    </main>
  );
}

// Signed-contract reconciliation: the hero totals on The Week must equal the
// sum of the neighborhood activity leaderboard. Open flags mean the upstream
// payload disagrees with itself and needs a data-side correction.
function ReconciliationSection() {
  const fetchFlags = useServerFn(getReconciliationFlags);
  const { data, isLoading } = useQuery({
    queryKey: ["reconciliation-flags"],
    queryFn: () => fetchFlags(),
  });

  const flags = data ?? [];
  const open = flags.filter((f) => f.status === "open");

  return (
    <section>
      <h2>Signed contract reconciliation</h2>
      {isLoading ? (
        <p className="note">Loading checks…</p>
      ) : open.length === 0 ? (
        <p className="note">
          No open mismatches. Hero totals and the activity leaderboard agree on every checked week.
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">Week</th>
              <th scope="col">Check</th>
              <th scope="col">Hero</th>
              <th scope="col">Leaderboard</th>
              <th scope="col">Difference</th>
              <th scope="col">Severity</th>
            </tr>
          </thead>
          <tbody>
            {open.map((f) => (
              <tr key={f.id}>
                <th scope="row">{f.week_start}</th>
                <td>{f.check_name.replace(/_/g, " ")}</td>
                <td>{f.hero_value ?? "n/a"}</td>
                <td>{f.table_value ?? "n/a"}</td>
                <td>{f.delta ?? "n/a"}</td>
                <td>{f.severity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="note">
        Checks run hourly. A flag closes on its own once the corrected payload lands.
      </p>
    </section>
  );
}


function Section({
  title,
  entries,
  external,
}: {
  title: string;
  entries: Entry[];
  external?: boolean;
}) {
  return (
    <section>
      <h2>{title}</h2>
      <ul>
        {entries.map((e) => (
          <li key={e.path}>
            {external ? (
              <a href={e.path}>{e.label}</a>
            ) : (
              <Link to={e.path}>{e.label}</Link>
            )}
            <code>{e.path}</code>
            {e.note ? <span className="note">{e.note}</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

const css = `
.internal-index {
  max-width: 900px;
  margin: 0 auto;
  padding: 56px 24px 96px;
  font-family: "Jost", system-ui, sans-serif;
  color: #2b2b2b;
}
.internal-index .eyebrow {
  font-size: 11px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #918c7e;
  margin: 0 0 8px;
}
.internal-index h1 {
  font-family: "Ivy Mode", "Cormorant Garamond", serif;
  font-weight: 300;
  font-size: 40px;
  margin: 0 0 12px;
}
.internal-index .lede { max-width: 60ch; color: #5a5a5a; margin: 0 0 8px; }
.internal-index h2 {
  font-family: "Ivy Mode", "Cormorant Garamond", serif;
  font-weight: 400;
  font-size: 22px;
  margin: 40px 0 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e5e2dc;
}
.internal-index ul { list-style: none; margin: 0; padding: 0; }
.internal-index li {
  display: grid;
  grid-template-columns: 220px 260px 1fr;
  gap: 12px;
  align-items: baseline;
  padding: 8px 0;
  border-bottom: 1px solid #f1efea;
}
.internal-index a { color: #2b2b2b; text-decoration: underline; text-underline-offset: 3px; }
.internal-index a:hover { color: #a37670; }
.internal-index code { font-size: 12px; color: #7a766c; }
.internal-index .note { font-size: 13px; color: #7a766c; }
.internal-index .signed-in { font-size: 13px; color: #7a766c; }
.internal-index .linklike {
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  color: #a37670;
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}
.internal-index table { width: 100%; border-collapse: collapse; font-size: 14px; }
.internal-index th, .internal-index td {
  text-align: left;
  padding: 8px 12px 8px 0;
  border-bottom: 1px solid #f1efea;
  font-weight: 400;
}
.internal-index thead th {
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #918c7e;
}
@media (max-width: 720px) {
  .internal-index li { grid-template-columns: 1fr; gap: 2px; }
}
`;
