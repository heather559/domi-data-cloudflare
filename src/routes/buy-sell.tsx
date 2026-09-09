import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import { LeadForm } from "../components/lead-form";
import { AffiliationsConnect } from "../components/affiliations-connect";
import stoopPhoto from "../assets/heather-domi-contact-stoop-v2.jpg.asset.json";

const STOOP_PHOTO_ALT =
  "Heather Domi standing on a Manhattan brownstone stoop railing, arms crossed and smiling, in a light blue linen vest and wide-leg trousers, with brick townhouses and ivy in the background.";

const BUYSELL_CSS = `
.buysell-hero-banner{position:relative;isolation:isolate;overflow:hidden;width:100vw;max-width:100vw;left:50%;margin-left:-50vw;margin-right:-50vw;min-height:420px;display:flex;flex-direction:column;justify-content:flex-end;padding:140px 0 40px;margin-top:-110px;margin-bottom:44px;}
.buysell-hero-banner__inner{width:100%;max-width:820px;margin:0 auto;padding:0 44px;}
.buysell-hero-banner__bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 55%;z-index:-2;}
.buysell-hero-banner::after{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(180deg,rgba(20,15,12,0.28) 0%,rgba(20,15,12,0.50) 45%,rgba(20,15,12,0.82) 100%);}
.buysell-hero-banner .page-eyebrow{color:#F2E4DF;text-shadow:0 1px 6px rgba(0,0,0,0.55);}
.buysell-hero-banner .page-title{color:#FFFFFF;text-shadow:0 2px 14px rgba(0,0,0,0.6);margin-bottom:0;}
@media (max-width:640px){
  .buysell-hero-banner{min-height:300px;padding:90px 0 26px;margin-top:-90px;}
  .buysell-hero-banner__inner{padding:0 22px;}
  .buysell-hero-banner__bg{object-position:50% 85%;}
}

`;


type Search = { intent?: "buying" | "selling" | "both"; neighborhood?: string };


export const Route = createFileRoute("/buy-sell")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    intent:
      s.intent === "buying" || s.intent === "selling" || s.intent === "both"
        ? s.intent
        : undefined,
    neighborhood: typeof s.neighborhood === "string" ? s.neighborhood : undefined,
  }),
  head: () => ({
    links: [{ rel: "canonical", href: "https://domidata.heatherdomi.com/buy-sell" }],
    meta: [
      { title: "Buy or Sell — Domi Data · Heather Domi Team" },
      { name: "description", content: "Buying or selling in Manhattan luxury? Reach the person who built the Domi Data reports." },
      { property: "og:title", content: "Buy or Sell — Domi Data · Heather Domi Team" },
      { property: "og:description", content: "Buying or selling in Manhattan luxury? Reach the person who built the Domi Data reports." },
    ],
  }),
  component: BuySellPage,
});

function BuySellPage() {
  const { intent, neighborhood } = Route.useSearch();
  return (
    <div className="site">
      <SiteHeader />
      <main id="main-content" className="page-shell">
        <style dangerouslySetInnerHTML={{ __html: BUYSELL_CSS }} />
        <div className="buysell-hero-banner">
          <img className="buysell-hero-banner__bg" src={stoopPhoto.url} alt={STOOP_PHOTO_ALT} />
          <div className="buysell-hero-banner__inner">
            <div className="page-eyebrow">Buy or Sell</div>
            <h1 className="page-title">Buying or Selling in Manhattan Luxury?</h1>
          </div>
        </div>
        <p className="page-deck">You have seen the data. Now talk to the person who built it. Tell Heather a bit about what you are looking for, and she will follow up personally.</p>
        <div className="lead-form-wrap">
          <LeadForm variant="buy-sell" initialIntent={intent} initialNeighborhood={neighborhood} sourcePath="/buy-sell" />
        </div>
        <p className="page-footlink">Prefer email or phone? <a href="mailto:hdomi@heatherdomi.com">hdomi@heatherdomi.com</a> · <a href="tel:+19172678012">(917) 267-8012</a></p>

        <AffiliationsConnect />
      </main>


      <SiteFooter />
    </div>
  );
}
