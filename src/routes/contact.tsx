import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import { LeadForm } from "../components/lead-form";
import { AffiliationsConnect } from "../components/affiliations-connect";
import armchairPhoto from "../assets/heather-domi-contact-armchair.jpg.asset.json";

const ARMCHAIR_PHOTO_ALT =
  "Heather Domi seated in a blue velvet armchair, smiling, holding her small poodle, wearing a black-and-cream floral silk dress, in a softly styled living room with framed art and a marble side table.";


const CONTACT_CSS = `
.contact-hero-banner{position:relative;isolation:isolate;overflow:hidden;width:100vw;max-width:100vw;left:50%;margin-left:-50vw;margin-right:-50vw;min-height:420px;display:flex;flex-direction:column;justify-content:flex-end;padding:140px 0 40px;margin-top:-110px;margin-bottom:44px;}
.contact-hero-banner__inner{width:100%;max-width:820px;margin:0 auto;padding:0 44px;}
.contact-hero-banner__bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 43%;z-index:-2;}
.contact-hero-banner::after{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(180deg,rgba(20,15,12,0.28) 0%,rgba(20,15,12,0.50) 45%,rgba(20,15,12,0.82) 100%);}
.contact-hero-banner .page-eyebrow{color:#F2E4DF;text-shadow:0 1px 6px rgba(0,0,0,0.55);}
.contact-hero-banner .page-title{color:#FFFFFF;text-shadow:0 2px 14px rgba(0,0,0,0.6);margin-bottom:0;}
@media (max-width:640px){
  .contact-hero-banner{min-height:300px;padding:90px 0 26px;margin-top:-90px;}
  .contact-hero-banner__inner{padding:0 22px;}
  .contact-hero-banner__bg{object-position:50% 48%;}
}
`;




export const Route = createFileRoute("/contact")({
  head: () => ({
    links: [{ rel: "canonical", href: "https://domidata.heatherdomi.com/contact" }],
    meta: [
      { title: "Contact — Domi Data · Heather Domi Team" },
      { name: "description", content: "Press inquiries, consulting, and methodology questions for Domi Data." },
      { property: "og:title", content: "Contact — Domi Data · Heather Domi Team" },
      { property: "og:description", content: "Press inquiries, consulting, and methodology questions for Domi Data." },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  return (
    <div className="site">
      <SiteHeader />
      <main id="main-content" className="page-shell">
        <style dangerouslySetInnerHTML={{ __html: CONTACT_CSS }} />
        <div className="contact-hero-banner">
          <img className="contact-hero-banner__bg" src={armchairPhoto.url} alt={ARMCHAIR_PHOTO_ALT} />
          <div className="contact-hero-banner__inner">
            <div className="page-eyebrow">Press &amp; Data Inquiries</div>
            <h1 className="page-title">Questions About the Data?</h1>
          </div>
        </div>
        <p className="page-deck">For press, consulting, or methodology questions, send a short note. Heather replies personally.</p>

        <div className="lead-form-wrap">
          <LeadForm variant="contact" sourcePath="/contact" />
        </div>
        <p className="page-footlink">Buying or selling? <a href="/buy-sell">Start here →</a></p>

        <AffiliationsConnect />
      </main>

      <SiteFooter />
    </div>
  );
}
