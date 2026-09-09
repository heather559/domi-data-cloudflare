import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { HOME_HERO } from "../lib/site-images";
const heroImg = HOME_HERO.url;
import domiDataLockupAsset from "../assets/hd-dd-lockup-v2.png.asset.json";
const domiDataLockup = domiDataLockupAsset.url;
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import { SubscribeForm } from "../components/subscribe-form";


export const Route = createFileRoute("/")({
  head: () => ({
    links: [{ rel: "canonical", href: "https://domidata.heatherdomi.com/" }],
    meta: [
      { title: "Domi Data: A new lens on Manhattan luxury." },
      {
        name: "description",
        content:
          "Domi Data tracks Manhattan luxury real estate at four scales: weekly, by neighborhood, quarterly, and structurally, all built on one consistent method.",
      },
      { property: "og:title", content: "Domi Data: A new lens on Manhattan luxury." },
      {
        property: "og:description",
        content:
          "Domi Data tracks Manhattan luxury real estate at four scales: weekly, by neighborhood, quarterly, and structurally, all built on one consistent method.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Domi Data: A new lens on Manhattan luxury." },
      {
        name: "twitter:description",
        content:
          "Domi Data tracks Manhattan luxury real estate at four scales: weekly, by neighborhood, quarterly, and structurally, all built on one consistent method.",
      },
    ],
  }),
  component: Home,
});

type Part = { href: string; eyebrow: string; title: string; deck: string };

const PARTS: Part[] = [
  { href: "/report.html#part-i", eyebrow: "Part I", title: "Measurement", deck: "A new way to look at the luxury market — three tiers instead of one arbitrary floor." },
  { href: "/report.html#part-ii", eyebrow: "Part II", title: "The Lost Decade", deck: "How the top of the Manhattan market actually moved from 2016 to 2026 — and where it didn't." },
  { href: "/report.html#part-iii", eyebrow: "Part III", title: "Five-Year Cycles", deck: "Three tiers, three cycles — quarterly contracts, volume, and medians from Q2 2021 through Q2 2026." },
  { href: "/report.html#part-iv", eyebrow: "Part IV", title: "Geography", deck: "Where the capital flows — the ten-of-twelve neighborhoods carrying the luxury market." },
  { href: "/report.html#part-v", eyebrow: "Part V", title: "Supply & Demand", deck: "Supply against velocity — months of supply and the balance-of-power spectrum, tier by tier." },
  { href: "/report.html#part-vi", eyebrow: "Part VI", title: "Cost Inflection", deck: "A new annual cost, starting today — pied-à-terre surcharge and the July 2026 tax change at each tier." },
  { href: "/report.html#appendix", eyebrow: "Appendix", title: "The Data", deck: "The full 21-quarter dataset — counts, volume, medians, and PPSF for every tier." },
  { href: "/report.html", eyebrow: "Full Report", title: "Read End-to-End", deck: "The complete Domi Data™ Luxury Lines foundational report, sourcing and methodology included." },
];

type Hub = { href: string; eyebrow: string; title: string; deck: string; cta: string };

const HUB: Hub[] = [
  {
    href: "/this-week",
    eyebrow: "The Week",
    title: "Manhattan, Every Monday",
    deck: "The week's signed contracts across every luxury tier: demand trend, market pulse, bedroom mix, and supply.",
    cta: "Read The Week",
  },
  {
    href: "/monthly",
    eyebrow: "The Month",
    title: "Manhattan, Month Over Month",
    deck: "The month's signed contracts once figures close and verify: tier cutoffs, momentum against trailing averages, supply and absorption, and neighborhood concentration.",
    cta: "Read The Month",
  },
  {
    href: "/quarterly-brief.html",
    eyebrow: "The Quarterly",
    title: "Q2 2026, By the Numbers",
    deck: "This quarter's signed contracts across every luxury tier, current and reconciled against the public record.",
    cta: "Read the Report",
  },
  {
    href: "/neighborhoods",
    eyebrow: "Neighborhoods",
    title: "Ten Neighborhoods, and Growing",
    deck: "The same three tiers, tracked neighborhood by neighborhood. Ten neighborhoods are live today, with more coming online as each one's data mapping is built.",
    cta: "Explore Neighborhoods",
  },
];

function Home() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>("[data-reveal], [data-reveal-stagger]");
    if (!("IntersectionObserver" in window) || els.length === 0) {
      els.forEach((el) => el.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="site">
      <SiteHeader variant="solid" />


      {/* ============ HERO ============ */}
      <main id="main-content">
      <section className="hero">

        <img src={heroImg} alt={HOME_HERO.caption} className="hero-img" width={1920} height={1200} fetchPriority="high" />
        <div className="hero-scrim" />
        <div className="hero-inner">
          
          <h1 className="hero-title">A new lens on Manhattan luxury.</h1>
          <p className="hero-subhead"><em>Where it happens, how it moves, updated every week.</em></p>
          <p className="hero-deck">
            Ten neighborhoods hold roughly eighty percent of Manhattan's luxury dollar volume,
            and they don't get there the same way. This is the first consistent read on exactly
            how, rebuilt every week and reconciled every quarter.
          </p>
          <div className="hero-ctas">
            <a href="/this-week" className="btn">The Week</a>
            <a href="/monthly" className="btn">The Month</a>
            <a href="/quarterly-brief.html" className="btn">The Quarterly</a>
            <a href="/neighborhoods" className="btn">Neighborhoods</a>
            <a href="/report.html" className="btn">The Foundational Report</a>
          </div>
        </div>
      </section>

      {/* ============ STATS ============ */}
      <section className="stats" data-reveal-stagger>
        <div className="stat">
          <div className="stat-num"><span className="s">$</span>2B<span className="s">+</span></div>
          <div className="stat-label">In Career Sales</div>
        </div>
        <div className="stat">
          <div className="stat-num">Top 1%</div>
          <div className="stat-label">Nationally Ranked by<br />The Wall Street Journal</div>
        </div>
        <div className="stat">
          <div className="stat-num">25+ Yrs</div>
          <div className="stat-label">in Manhattan Real Estate</div>
        </div>
      </section>

      {/* ============ REPORT INTRO ============ */}
      <section id="report" className="intro" data-reveal>
        <img src={domiDataLockup} alt="Heather Domi and Domi Data logo lockup: an interlocking hd monogram above the words Heather Domi and Domi Data." className="intro-lockup" style={{height:144,width:"auto",display:"block",margin:"0 auto 24px",filter:"brightness(0)"}} />
        <div className="intro-eyebrow">Four Ways to Read the Market</div>
        <h2 className="intro-title">
          One method.
          <br />
          <em>Four ways to see it.</em>
        </h2>
        <p className="intro-deck">
          The Week tracks Manhattan's signed contracts every week. The Month tracks that
          same activity Manhattan-wide, once the month closes and the figures verify. The
          Quarterly tracks this quarter's verified signed contracts. Neighborhoods tracks
          the same three tiers, neighborhood by neighborhood. Start wherever your question
          starts.
        </p>
      </section>

      {/* ============ TOP-LEVEL HUB ============ */}
      <section className="hub hub-4" data-reveal-stagger>
        {HUB.map((h) => (
          <a key={h.href} href={h.href} className="hub-card">
            <div className="card-eyebrow">{h.eyebrow}</div>
            <h3 className="hub-title">{h.title}</h3>
            <p className="hub-deck">{h.deck}</p>
            <span className="card-cta">{h.cta}</span>
          </a>
        ))}
      </section>

      {/* ============ SUBSCRIBE ============ */}
      <section
        className="subscribe-section"
        style={{ padding: "80px 24px", display: "flex", justifyContent: "center" }}
      >
        <SubscribeForm />
      </section>

      {/* ============ FOUNDATIONAL REPORT INTRO ============ */}
      <section id="foundational-report" className="intro" data-reveal>
        <div className="intro-eyebrow">The Foundational Report</div>
        <h2 className="intro-title">The Method Behind the Data</h2>
        <p className="intro-deck">
          Five years of contracts, twenty-one quarters, three tiers. The full structural
          read on Manhattan luxury.
        </p>
        <a href="/report.html" className="btn-dark" style={{ marginTop: 8 }}>Read the Report</a>
      </section>

      {/* ============ FOUNDATIONAL CHAPTERS (carousel) ============ */}
      <div className="chapters-label" data-reveal>
        <span>Foundational Report · Chapters</span>
      </div>
      <div data-reveal>
        <ChaptersCarousel parts={PARTS} />
      </div>
      {/* ============ SUBSCRIBE ============ */}
      <section style={{ padding: "80px 24px", display: "flex", justifyContent: "center" }}>
        <SubscribeForm />
      </section>
      </main>

      <SiteFooter />

    </div>
  );
}


function ChaptersCarousel({ parts }: { parts: Part[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  const updateProgress = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setProgress(max <= 0 ? 1 : Math.min(1, Math.max(0, el.scrollLeft / max)));
  }, []);

  useEffect(() => {
    updateProgress();
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);
    return () => {
      el.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
    };
  }, [updateProgress]);

  const scrollBy = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>(".card");
    const step = card ? card.offsetWidth + 24 : el.clientWidth * 0.8;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  return (
    <section className="chapters-carousel">
      <div className="chapters-carousel__head">
        <div className="chapters-carousel__nav">
          <button
            type="button"
            aria-label="Previous chapter"
            onClick={() => scrollBy(-1)}
            disabled={progress <= 0.001}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Next chapter"
            onClick={() => scrollBy(1)}
            disabled={progress >= 0.999}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <div className="chapters-track" ref={trackRef}>
        {parts.map((p) => (
          <a key={p.href} href={p.href} className="card chapter-card">
            <div className="card-eyebrow">{p.eyebrow}</div>
            <h3 className="card-title">{p.title}</h3>
            <p className="card-deck">{p.deck}</p>
            <span className="card-cta">Read Section</span>
          </a>
        ))}
        <div className="chapters-track__end" aria-hidden />
      </div>

      <div className="chapters-progress" aria-hidden>
        <div
          className="chapters-progress__bar"
          style={{ transform: `scaleX(${Math.max(0.08, progress || 0.08)})` }}
        />
      </div>
    </section>
  );
}

