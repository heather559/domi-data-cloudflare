import { useState, type FormEvent } from "react";
import headshotAsset from "../assets/heather-domi-headshot.png.asset.json";
const headshot = headshotAsset.url;

type Variant = "buy-sell" | "contact";

const NEIGHBORHOOD_GROUPS: { group: string; items: { slug: string; label: string }[] }[] = [
  {
    group: "Downtown",
    items: [
      { slug: "battery-park-city", label: "Battery Park City" },
      { slug: "financial-district", label: "Financial District" },
      { slug: "seaport", label: "Seaport" },
      { slug: "tribeca", label: "Tribeca" },
      { slug: "soho", label: "SoHo" },
      { slug: "hudson-square", label: "Hudson Square" },
      { slug: "noho", label: "NoHo" },
      { slug: "nolita", label: "Nolita" },
      { slug: "little-italy", label: "Little Italy" },
      { slug: "chinatown", label: "Chinatown" },
      { slug: "two-bridges", label: "Two Bridges" },
      { slug: "lower-east-side", label: "Lower East Side" },
      { slug: "east-village", label: "East Village" },
      { slug: "greenwich-village", label: "Greenwich Village" },
      { slug: "west-village", label: "West Village" },
      { slug: "meatpacking", label: "Meatpacking District" },
    ],
  },
  {
    group: "Chelsea, Flatiron and Gramercy",
    items: [
      { slug: "chelsea", label: "Chelsea" },
      { slug: "west-chelsea", label: "West Chelsea" },
      { slug: "flatiron", label: "Flatiron" },
      { slug: "union-square", label: "Union Square" },
      { slug: "gramercy-park", label: "Gramercy Park" },
      { slug: "stuyvesant-town", label: "Stuyvesant Town / Peter Cooper" },
      { slug: "kips-bay", label: "Kips Bay" },
      { slug: "murray-hill", label: "Murray Hill" },
      { slug: "nomad", label: "NoMad" },
    ],
  },
  {
    group: "Midtown",
    items: [
      { slug: "midtown", label: "Midtown" },
      { slug: "midtown-east", label: "Midtown East" },
      { slug: "midtown-west", label: "Midtown West" },
      { slug: "hudson-yards", label: "Hudson Yards" },
      { slug: "hells-kitchen", label: "Hell's Kitchen / Clinton" },
      { slug: "theater-district", label: "Theater District" },
      { slug: "columbus-circle", label: "Columbus Circle" },
      { slug: "turtle-bay", label: "Turtle Bay" },
      { slug: "sutton-place", label: "Sutton Place" },
      { slug: "beekman", label: "Beekman" },
      { slug: "tudor-city", label: "Tudor City" },
    ],
  },
  {
    group: "Upper East Side",
    items: [
      { slug: "lenox-hill", label: "Lenox Hill" },
      { slug: "ues-met", label: "UES / Museum Mile" },
      { slug: "carnegie-hill", label: "Carnegie Hill" },
      { slug: "yorkville", label: "Yorkville" },
      { slug: "roosevelt-island", label: "Roosevelt Island" },
    ],
  },
  {
    group: "Upper West Side",
    items: [
      { slug: "lincoln-square", label: "Lincoln Square" },
      { slug: "upper-west-side", label: "Upper West Side" },
      { slug: "manhattan-valley", label: "Manhattan Valley" },
      { slug: "morningside-heights", label: "Morningside Heights" },
    ],
  },
  {
    group: "Upper Manhattan",
    items: [
      { slug: "central-harlem", label: "Central Harlem" },
      { slug: "east-harlem", label: "East Harlem" },
      { slug: "west-harlem", label: "West Harlem" },
      { slug: "hamilton-heights", label: "Hamilton Heights" },
      { slug: "sugar-hill", label: "Sugar Hill" },
      { slug: "washington-heights", label: "Washington Heights" },
      { slug: "hudson-heights", label: "Hudson Heights" },
      { slug: "inwood", label: "Inwood" },
    ],
  },
];

const NEIGHBORHOOD_LABELS: Record<string, string> = Object.fromEntries(
  NEIGHBORHOOD_GROUPS.flatMap((g) => g.items.map((i) => [i.slug, i.label])),
);


const PRICE_RANGES = [
  { value: "under-3m", label: "Under $3M" },
  { value: "3-5m", label: "$3M – $5M" },
  { value: "5-10m", label: "$5M – $10M" },
  { value: "10-20m", label: "$10M – $20M" },
  { value: "20m-plus", label: "$20M+" },
];

const TIMELINES = [
  { value: "now", label: "Actively looking now" },
  { value: "3-months", label: "Next 3 months" },
  { value: "6-12-months", label: "6 to 12 months" },
  { value: "exploring", label: "Just exploring" },
];

const CONTACT_REASONS = [
  { value: "press", label: "Press inquiry" },
  { value: "consulting", label: "Consulting" },
  { value: "methodology", label: "Methodology question" },
  { value: "other", label: "Other" },
];

export function LeadForm({
  variant,
  initialIntent,
  initialNeighborhood,
  sourcePath,
}: {
  variant: Variant;
  initialIntent?: "buying" | "selling" | "both";
  initialNeighborhood?: string;
  sourcePath?: string;
}) {
  const [intent, setIntent] = useState<"buying" | "selling" | "both">(
    initialIntent || "buying",
  );
  const [reason, setReason] = useState<string>("press");
  const [neighborhoods, setNeighborhoods] = useState<string[]>(
    initialNeighborhood ? [initialNeighborhood] : [],
  );
  const [showMore, setShowMore] = useState(false);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");

  const toggleNeighborhood = (slug: string) => {
    setNeighborhoods((prev) =>
      prev.includes(slug) ? prev.filter((n) => n !== slug) : [...prev, slug],
    );
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (status === "submitting") return;
    setStatus("submitting");
    setErrorMsg("");
    const form = new FormData(e.currentTarget);
    const payload = {
      intent: variant === "buy-sell" ? intent : reason,
      name: String(form.get("name") || ""),
      email: String(form.get("email") || ""),
      phone: String(form.get("phone") || ""),
      neighborhoods,
      price_range: String(form.get("price_range") || ""),
      timeline: String(form.get("timeline") || ""),
      reason: variant === "contact" ? reason : "",
      message: String(form.get("message") || ""),
      source_path: sourcePath || (typeof window !== "undefined" ? window.location.pathname : ""),
      source: variant,
      company: String(form.get("company") || ""),
    };
    try {
      const res = await fetch("/api/public/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setErrorMsg(
          data.error === "rate_limited"
            ? "Too many attempts. Try again in a minute."
            : "Something did not go through. Please try again or email hdomi@heatherdomi.com.",
        );
        setStatus("error");
        return;
      }
      setStatus("success");
    } catch {
      setErrorMsg("Network issue. Please try again or email hdomi@heatherdomi.com.");
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <div className="lead-success">
        <img src={headshot} alt="Heather Domi, smiling headshot against a neutral studio background." className="lead-success__photo" />
        <h3 className="lead-success__title">Got it. Thank you.</h3>
        <p className="lead-success__body">
          Heather replies personally, typically within one business day. For anything urgent,
          call <a href="tel:+19172678012">(917) 267-8012</a>.
        </p>
      </div>
    );
  }

  return (
    <form className="lead-form" onSubmit={onSubmit} noValidate>
      <div className="lead-agent">
        <img
          src={headshot}
          alt="Heather Domi, smiling headshot against a neutral studio background."
          className="lead-agent__photo"
          loading="lazy"
          width={72}
          height={72}
        />
        <div className="lead-agent__meta">
          <span className="lead-agent__name">Heather Domi, Douglas Elliman</span>
          <span className="lead-agent__title">Licensed Associate Real Estate Broker</span>
        </div>
      </div>

      {variant === "buy-sell" ? (
        <div className="lead-field">
          <label className="lead-label" id="lead-intent-label">I am</label>
          <div className="lead-segmented" role="radiogroup" aria-labelledby="lead-intent-label">


            {(["buying", "selling", "both"] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={intent === v}
                className={`lead-segmented__btn${intent === v ? " is-active" : ""}`}
                onClick={() => setIntent(v)}
              >
                {v === "buying" ? "Buying" : v === "selling" ? "Selling" : "Both"}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="lead-field">
          <label className="lead-label" htmlFor="reason">Reason</label>
          <select
            id="reason"
            className="lead-input lead-select"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          >
            {CONTACT_REASONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
      )}

      <div className="lead-row">
        <div className="lead-field">
          <label className="lead-label" htmlFor="name">Name</label>
          <input id="name" name="name" type="text" required maxLength={200} className="lead-input" autoComplete="name" />
        </div>
        <div className="lead-field">
          <label className="lead-label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required maxLength={320} className="lead-input" autoComplete="email" />
        </div>
      </div>

      <div className="lead-field">
        <label className="lead-label" htmlFor="phone">
          Phone
        </label>
        <span className="lead-hint lead-hint--block">Optional. Fastest reply.</span>
        <input id="phone" name="phone" type="tel" maxLength={40} className="lead-input" autoComplete="tel" />
      </div>

      {variant === "buy-sell" && (
        <>
          <div className="lead-field">
            <label className="lead-label" htmlFor="neighborhood_select">
              Neighborhoods of interest
            </label>
            <span className="lead-hint lead-hint--block">Optional. Add as many as you like.</span>
            <select
              id="neighborhood_select"
              className="lead-input lead-select"
              value=""
              onChange={(e) => {
                if (e.target.value) toggleNeighborhood(e.target.value);
              }}
            >
              <option value="">Select a neighborhood</option>
              {NEIGHBORHOOD_GROUPS.map((g) => (
                <optgroup key={g.group} label={g.group}>
                  {g.items
                    .filter((i) => !neighborhoods.includes(i.slug))
                    .map((i) => (
                      <option key={i.slug} value={i.slug}>{i.label}</option>
                    ))}
                </optgroup>
              ))}
            </select>
            {neighborhoods.length > 0 && (
              <div className="lead-chips">
                {neighborhoods.map((slug) => (
                  <button
                    key={slug}
                    type="button"
                    className="lead-chip is-active"
                    aria-label={`Remove ${NEIGHBORHOOD_LABELS[slug] ?? slug}`}
                    onClick={() => toggleNeighborhood(slug)}
                  >
                    {NEIGHBORHOOD_LABELS[slug] ?? slug}
                    <span className="lead-chip__x" aria-hidden="true">×</span>
                  </button>
                ))}
              </div>
            )}
          </div>


          <div className="lead-row">
            <div className="lead-field">
              <label className="lead-label" htmlFor="price_range">
                Price range
              </label>
              <select id="price_range" name="price_range" className="lead-input lead-select" defaultValue="">
                <option value="">Prefer not to say</option>
                {PRICE_RANGES.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            <div className="lead-field">
              <label className="lead-label" htmlFor="timeline">
                Timeline
              </label>
              <select id="timeline" name="timeline" className="lead-input lead-select" defaultValue="">
                <option value="">Not sure yet</option>
                {TIMELINES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>
        </>
      )}

      {variant === "buy-sell" && !showMore && (
        <button type="button" className="lead-more" onClick={() => setShowMore(true)}>
          Add a note (optional)
        </button>
      )}

      {(variant === "contact" || showMore) && (
        <div className="lead-field">
          <label className="lead-label" htmlFor="message">
            {variant === "contact" ? "Message" : "Anything else"}
            {variant === "buy-sell" && <span className="lead-hint"> Optional.</span>}
          </label>
          <textarea
            id="message"
            name="message"
            maxLength={4000}
            className="lead-input lead-textarea"
            rows={4}
            required={variant === "contact"}
          />
        </div>
      )}

      {/* Honeypot */}
      <div className="lead-hp" aria-hidden="true">
        <label>Company<input type="text" name="company" tabIndex={-1} autoComplete="off" /></label>
      </div>

      {status === "error" && <p className="lead-error">{errorMsg}</p>}

      <div className="lead-submit-row">
        <button type="submit" className="btn-dark lead-submit" disabled={status === "submitting"}>
          {status === "submitting" ? "Sending..." : variant === "contact" ? "Send Message" : "Send to Heather"}
        </button>
        <p className="lead-trust">Heather replies personally within one business day. Your details are never shared.</p>
      </div>
    </form>
  );
}
