import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import { AffiliationsConnect } from "../components/affiliations-connect";
import heatherLifestyle from "../assets/heather-domi-lifestyle.jpg.asset.json";
import teamPhoto from "../assets/heather-domi-team.jpg.asset.json";

const TEAM_PHOTO_ALT =
  "The Heather Domi Team standing together on a Tribeca cobblestone street in front of a red-brick building, from left, a man in a black suit and three women in black tailored suits, all smiling.";

const ABOUT_CSS = `
.about-hero-banner{position:relative;isolation:isolate;overflow:hidden;width:100vw;max-width:100vw;left:50%;margin-left:-50vw;margin-right:-50vw;min-height:420px;display:flex;flex-direction:column;justify-content:flex-end;padding:140px 0 40px;margin-top:-110px;margin-bottom:44px;}
.about-hero-banner__inner{width:100%;max-width:820px;margin:0 auto;padding:0 44px;}
.about-hero-banner__bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 34%;z-index:-2;}
.about-hero-banner::after{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(180deg,rgba(20,15,12,0.28) 0%,rgba(20,15,12,0.50) 45%,rgba(20,15,12,0.82) 100%);}
.about-hero-banner .page-eyebrow{color:#F2E4DF;text-shadow:0 1px 6px rgba(0,0,0,0.55);}
.about-hero-banner .page-title{color:#FFFFFF;text-shadow:0 2px 14px rgba(0,0,0,0.6);margin-bottom:0;}
.about-intro{display:grid;grid-template-columns:minmax(0,320px) minmax(0,1fr);gap:36px;align-items:start;margin-top:8px;}
.about-portrait{margin:0;}
.about-portrait img{width:100%;aspect-ratio:4/5;object-fit:cover;object-position:center 20%;display:block;border-radius:3px;}
.about-portrait figcaption{font-family:var(--sans);font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--mid);margin-top:10px;}
.about-intro .page-body{margin-top:0;}
@media (max-width:820px){
  .about-intro{grid-template-columns:1fr;gap:24px;}
  .about-portrait img{aspect-ratio:3/2;object-position:center 22%;}
}
@media (max-width:640px){
  .about-hero-banner{min-height:300px;padding:90px 0 26px;margin-top:-90px;}
  .about-hero-banner__inner{padding:0 22px;}
  .about-hero-banner__bg{object-position:50% 32%;}
}
`;




export const Route = createFileRoute("/about")({
  head: () => ({
    links: [{ rel: "canonical", href: "https://domidata.heatherdomi.com/about" }],
    meta: [
      { title: "About — Domi Data · Heather Domi Team" },
      { name: "description", content: "Twenty years watching the top of Manhattan real estate. The story behind Domi Data." },
      { property: "og:title", content: "About — Domi Data · Heather Domi Team" },
      { property: "og:description", content: "Twenty years watching the top of Manhattan real estate. The story behind Domi Data." },
      { property: "og:url", content: "https://domidata.heatherdomi.com/about" },
      { property: "og:type", content: "profile" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Person",
          name: "Heather Domi",
          jobTitle: "Licensed Real Estate Salesperson",
          worksFor: { "@type": "Organization", name: "Douglas Elliman" },
          url: "https://heatherdomi.com",
          sameAs: ["https://heatherdomi.com", "https://domidata.heatherdomi.com"],
          description: "Ranked in the top 1% nationally by RealTrends since 2014. Over $2 billion in career sales across 25 years in Manhattan luxury real estate.",
          award: "Top 1% nationally, RealTrends (since 2014)",
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: "https://domidata.heatherdomi.com/" },
            { "@type": "ListItem", position: 2, name: "About", item: "https://domidata.heatherdomi.com/about" },
          ],
        }),
      },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="site">
      <SiteHeader />
      <main id="main-content" className="page-shell">
        <style dangerouslySetInnerHTML={{ __html: ABOUT_CSS }} />
        <div className="about-hero-banner">
          <img className="about-hero-banner__bg" src={teamPhoto.url} alt={TEAM_PHOTO_ALT} />
          <div className="about-hero-banner__inner">
            <div className="page-eyebrow">About Domi Data and the Heather Domi Team</div>
            <h1 className="page-title">Twenty Years of Watching This Market.</h1>
          </div>
        </div>
        <div className="about-intro">
          <figure className="about-portrait">
            <img src={heatherLifestyle.url} alt="Heather Domi, Douglas Elliman luxury real estate agent and founder of Domi Data, at home in Manhattan." loading="lazy" />
            <figcaption>Heather Domi &middot; Douglas Elliman</figcaption>
          </figure>
          <div className="page-body">
            <p>In the 20 years since relocating from Miami to Manhattan in 2006, Heather Domi has built more than $2 billion in career sales across 25 years in real estate. She consistently represents ultra-high-net-worth individuals and some of the country's most celebrated developers, both of whom need specialized advisory services. After years of advanced market analysis, she saw an opportunity to bring something sharper to a market too often covered in generalized terms. She founded the Heather Domi Team on a simple mission: to deliver exceptional outcomes for clients by listening closely and honing in on the details they might not even realize matter. She built Domi Data around her clients' needs to answer the questions they ask most, and bring transparency to the luxury segment.</p>
            <p>Domi Data follows every signed contract across three tiers: Luxury, the top 10%, Prime, the top 5%, and Trophy, the top 1%. Each has its own buyer profile and pattern. It tracks every Manhattan neighborhood, with the closest focus on the ten that have carried 76 to 85% of luxury volume over the last five years. That tracking matters more now, as a new pied-à-terre tax puts fresh pressure on the luxury segment. The Foundational Report explains the method. The Quarterly keeps it current. A weekly Manhattan market report and monthly neighborhood-level data round out what Domi Data delivers.</p>
            <p>Heather Domi, Douglas Elliman. Ranked in the top 1% nationally by RealTrends since 2014.</p>
          </div>
        </div>

        <p className="page-footlink"><a href="/report.html#part-i">Read the Methodology →</a> · <a href="/contact">Press &amp; Data Inquiries →</a></p>
        <p style={{fontSize:'10.5px',color:'var(--mid)',marginTop:'20px',lineHeight:'1.7'}}>Data Source: Marketproof</p>

        <AffiliationsConnect />

      </main>


      <SiteFooter />
    </div>
  );
}
