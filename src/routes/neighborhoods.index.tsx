import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import { getNeighborhoodRanks } from "../lib/neighborhood-report.functions";
import { breadcrumbScript, TRAILS } from "../lib/breadcrumbs";
import uesMet from "../assets/neighborhoods/ues-met.jpg.asset.json";
import westVillage from "../assets/neighborhoods/west-village.jpg.asset.json";
import midtown from "../assets/neighborhoods/midtown.jpg.asset.json";
import upperWestSide from "../assets/neighborhoods/upper-west-side.jpg.asset.json";
import lenoxHill from "../assets/neighborhoods/lenox-hill.jpg.asset.json";
import lincolnSquare from "../assets/neighborhoods/lincoln-square.jpg.asset.json";
import tribeca from "../assets/neighborhoods/tribeca.jpg.asset.json";
import greenwichVillage from "../assets/neighborhoods/greenwich-village.jpg.asset.json";
import westChelsea from "../assets/neighborhoods/west-chelsea.jpg.asset.json";
import soho from "../assets/neighborhoods/soho.jpg.asset.json";

const PHOTOS: Record<string, string> = {
  "upper-east-side": uesMet.url,
  "west-village": westVillage.url,
  "midtown": midtown.url,
  "upper-west-side": upperWestSide.url,
  "lenox-hill": lenoxHill.url,
  "lincoln-square": lincolnSquare.url,
  "tribeca": tribeca.url,
  "greenwich-village": greenwichVillage.url,
  "west-chelsea": westChelsea.url,
  "soho": soho.url,
};

export const Route = createFileRoute("/neighborhoods/")({
  loader: async () => ({ ranks: await getNeighborhoodRanks() }),
  head: () => ({
    links: [{ rel: "canonical", href: "https://domidata.heatherdomi.com/neighborhoods" }],
    meta: [
      { title: "Neighborhoods — Domi Data · Heather Domi Team" },
      { name: "description", content: "Neighborhood-level Domi Data reports on Manhattan luxury signed contracts." },
      { property: "og:title", content: "Neighborhoods — Domi Data · Heather Domi Team" },
      { property: "og:description", content: "Neighborhood-level Domi Data reports on Manhattan luxury signed contracts." },
    ],
    scripts: [breadcrumbScript(TRAILS.neighborhoods)],
  }),
  component: NeighborhoodsPage,
});

type Nbhd = { name: string; slug: string };

const NEIGHBORHOODS: Nbhd[] = [
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

const PALETTE = ["#ECE8E2", "#98A0A8", "#AC6260", "#918C7E", "#A37670"];

function NeighborhoodsPage() {
  const { ranks } = Route.useLoaderData() as { ranks: Record<string, number> };

  const enriched = NEIGHBORHOODS.map((n, staticIdx) => ({
    ...n,
    staticIdx,
    live: ranks[n.slug] != null,
  }));

  return (
    <div className="site">
      <SiteHeader />
      <main id="main-content" className="page-shell nbhd-shell">
        <div className="page-eyebrow">Domi Data · Neighborhoods</div>
        <h1 className="page-title">Neighborhood Reports.</h1>
        <p className="page-deck">
          Our launch set of ten Manhattan neighborhoods, ranked by luxury signed-contract
          activity. Each neighborhood gets its own live read — demand trend, tier splits,
          trophy deals, market pulse, bedroom mix, and supply. More coming online over the
          next week.
        </p>

        <div className="nbhd-grid">
          {enriched.map((n, i) => {
            const color = PALETTE[i % PALETTE.length];
            const rankStr = String(i + 1).padStart(2, "0");
            const isLight = color === "#ECE8E2" || color === "#98A0A8";

            const inner = (
              <>
                <div
                  className="nbhd-tile__photo"
                  data-photo-slot={n.slug}
                  style={
                    PHOTOS[n.slug]
                      ? { backgroundImage: `url(${PHOTOS[n.slug]})`, backgroundColor: color }
                      : { backgroundColor: color }
                  }
                  aria-hidden="true"
                />
                <div className="nbhd-tile__banner">
                  <span className="nbhd-tile__rank">{rankStr}</span>
                  <span className="nbhd-tile__name">{n.name}</span>
                </div>
                {!n.live && (
                  <span className={`nbhd-tile__pill ${isLight ? "on-light" : "on-dark"}`}>
                    Coming Soon
                  </span>
                )}
              </>
            );
            if (n.live) {
              return (
                <Link
                  key={n.slug}
                  to="/neighborhoods/$slug"
                  params={{ slug: n.slug }}
                  className="nbhd-tile nbhd-tile--live"
                >
                  {inner}
                </Link>
              );
            }
            return (
              <div key={n.slug} className="nbhd-tile nbhd-tile--soon" aria-disabled="true">
                {inner}
              </div>
            );
          })}
        </div>

        <p className="page-footlink">
          Looking for the market overview? <a href="/report.html#part-iv">See the Foundational Report's Geography section →</a>
        </p>
      </main>


      <style>{`
        .nbhd-shell { max-width: 1360px; }
        .nbhd-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 28px;
          margin-top: 12px;
        }
        .nbhd-tile {
          position: relative;
          display: block;
          aspect-ratio: 4 / 5;
          overflow: hidden;
          text-decoration: none;
          color: inherit;
          background: var(--paper-2);
        }
        .nbhd-tile__photo {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          background-size: cover;
          background-position: center;
          transition: transform .6s ease;
        }
        .nbhd-tile--live:hover .nbhd-tile__photo { transform: scale(1.03); }
        .nbhd-tile__banner {
          position: absolute;
          left: 0;
          bottom: 28px;
          background: var(--ink);
          color: #fff;
          padding: 14px 22px 14px 20px;
          display: flex;
          align-items: baseline;
          gap: 14px;
          max-width: 88%;
        }
        .nbhd-tile__rank {
          font-family: var(--serif);
          font-weight: 300;
          font-style: italic;
          font-size: 20px;
          color: #c6a15e;
          letter-spacing: .02em;
        }
        .nbhd-tile__name {
          font-family: var(--serif);
          font-weight: 300;
          font-size: 22px;
          line-height: 1.05;
          letter-spacing: .04em;
          text-transform: uppercase;
          color: #fff;
        }
        .nbhd-tile__pill {
          position: absolute;
          top: 16px;
          right: 16px;
          font-family: var(--sans);
          font-size: 9.5px;
          letter-spacing: .24em;
          text-transform: uppercase;
          padding: 6px 10px;
          border: 1px solid currentColor;
        }
        .nbhd-tile__pill.on-light { color: var(--ink); background: rgba(255,255,255,.55); }
        .nbhd-tile__pill.on-dark { color: #fff; background: rgba(0,0,0,.18); }
        .nbhd-tile--soon { cursor: default; }

        @media (max-width: 960px) {
          .nbhd-grid { grid-template-columns: repeat(2, 1fr); gap: 20px; }
          .nbhd-tile__name { font-size: 18px; }
        }
        @media (max-width: 560px) {
          .nbhd-grid { grid-template-columns: 1fr; gap: 18px; }
          .nbhd-tile { aspect-ratio: 5 / 4; }
        }
      `}</style>


      <SiteFooter />

    </div>
  );
}
