/**
 * Domi Data Briefs.
 *
 * A brief is a long-form study on one question. Longer and more sourced than a
 * blog post, shorter and more focused than the Quarterly.
 *
 * To publish a brief: add an entry to BRIEFS below. It appears at /briefs, at
 * /briefs/<slug>, in the Briefs menu, and in the sitemap automatically.
 * Newest first is not required; the index sorts by date.
 */

export type BriefBlock =
  | { kind: "p"; text: string }
  | { kind: "h"; text: string }
  | { kind: "lede"; text: string }
  | { kind: "note"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "link"; text: string; href: string }
  | { kind: "xref"; lead: string; label: string; href: string }
  | { kind: "table"; headers: string[]; rows: string[][]; caption?: string }
  | { kind: "figure"; label: string; value: string; caption: string };

export type Brief = {
  slug: string;
  title: string;
  /** ISO date, YYYY-MM-DD. Publication date. */
  date: string;
  /** One sentence. Used in the index, meta description, and menu descriptor. */
  summary: string;
  /** Short category label shown as the eyebrow, e.g. "Tax Policy". */
  topic: string;
  /** Estimated reading time in minutes. */
  readMinutes: number;
  /** Body of the brief, in order. */
  body: BriefBlock[];
  /** Optional method or sample caveat, printed above the data source line. */
  method?: string;
};

export const BRIEFS: Brief[] = [
  {
    slug: "pied-a-terre-tax",
    title: "Pied-à-Terre Tax: What Non-Primary Owners Need to Know",
    date: "2026-07-30",
    summary: "New York's new annual surcharge on second homes, and what it means for the decision to hold, buy, or sell.",
    topic: "Tax Policy",
    readMinutes: 9,
    body: [
      { kind: "lede", text: "New York City has a pied-à-terre tax for the first time. It took effect July 1, 2026. The Department of Finance (DOF) published a supplemental market value roll on July 24th, naming properties that may owe the surcharge, and letters are already going out." },
      { kind: "p", text: "If you own a non-primary New York City property, this may apply to you depending on the property's estimated market value, whether or not DOF has contacted you yet. If you've already received a letter, the deadline to respond is quickly approaching: August 21, 2026 for homes and condos, August 24, 2026 for co-ops." },
      { kind: "p", text: "This guide details who it applies to, how to claim an exemption if you qualify, and what to do if a letter is already in your mailbox. It is not tax or legal advice, and the numbers involved can run well into six figures a year. Consult your accountant or tax attorney before you file for exemption, to avoid a costly mistake." },

      { kind: "h", text: "Who it applies to" },
      { kind: "p", text: "For tax years 2026-27 and 2027-28, the surcharge can apply to:" },
      { kind: "list", items: [
        "One-, two-, and three-family homes DOF values above $5 million.",
        "Condo and co-op units DOF values at $1 million or more.",
      ] },
      { kind: "p", text: "DOF's own market value decides the bracket, independent of the price you paid or what the property would sell for today." },

      { kind: "h", text: "How much" },
      { kind: "table", headers: ["Property type", "DOF market value", "Rate"], rows: [
        ["Condos & co-ops", "$1M – $3M", "4.0%"],
        ["Condos & co-ops", "$3M – $5M", "5.25%"],
        ["Condos & co-ops", "$5M+", "6.5%"],
        ["1–3 family homes", "$5M – $15M", "0.8%"],
        ["1–3 family homes", "$15M – $25M", "1.05%"],
        ["1–3 family homes", "$25M+", "1.3%"],
      ], caption: "Tax years 2026-27 and 2027-28." },

      { kind: "h", text: "Why the number on your bill doesn't match your true market value" },
      { kind: "p", text: "State law requires the DOF to value a condo or co-op as if it were a rental building generating income, regardless of what you paid or what it's worth today. The DOF estimates what a comparable rental would earn, then applies a capitalization rate to get a market value. That modeled number decides your bracket." },
      { kind: "p", text: "That's why the surcharge can land so unevenly. Two condos that closed within a few million dollars of each other can end up with one surcharge more than double the other, because DOF's rental-income estimate decided the bracket, not the sale. Neither the buyer nor seller controls that number before closing." },

      { kind: "h", text: "Who's exempt" },
      { kind: "p", text: "The surcharge generally doesn't apply if the property is the primary residence of any of the following:" },
      { kind: "list", items: [
        "The owner.",
        "A tenant or subtenant, provided they live there full time.",
        "One or more individuals who together hold a majority interest in the LLC, corporation, or partnership that owns the property, and live there.",
        "An immediate family member (child or parent) of the owner or of a majority interest holder, living there.",
        "The sole beneficiary, or beneficiaries, of a trust that owns the property, living there.",
      ] },
      { kind: "p", text: "A signed lease, a family tie, or a majority stake doesn't exempt the property by itself. The person has to genuinely live there and provide documentation showing it." },
      { kind: "p", text: "The underlying statute sets the actual test at more than half the year of occupancy, measured each year as of January 5th. For this first tax year, occupancy on January 5, 2026, already decided the outcome, months before the law was signed. DOF's public eligibility guide doesn't restate that date, but it's what governs which side of the line a given year falls on." },

      { kind: "h", text: "If you received a letter from DOF" },
      { kind: "p", text: "DOF flagged your property using the July 24th roll. A letter doesn't mean you owe the surcharge. It means DOF thinks you might, and it's on you to respond." },
      { kind: "p", text: "If you believe you're exempt, respond in writing with proof before the deadline. Your letter has the date. If you haven't received one, use the general deadline instead: August 21st for homes and condos, August 24 for co-ops." },
      { kind: "note", text: "Missing the deadline is the real risk for an owner who qualifies for an exemption." },

      { kind: "h", text: "What you'll need to prove it" },
      { kind: "p", text: "Every application starts with the occupant's own most recently filed federal or state tax return. Without one, two of these three instead:" },
      { kind: "list", items: [
        "A driver's license or other DMV-issued ID.",
        "A voter registration card.",
        "Other proof the property is their primary residence.",
      ] },
      { kind: "p", text: "Everything below builds on this, depending on who's actually living there." },
      { kind: "p", text: "Tenant or subtenant: their own tax return, or two of the ID alternatives above, plus the current lease and one more rental document (a utility bill, proof of rent paid, a renter's insurance policy), or a Tenant/Subtenant Affidavit plus two more rental documents. A lease with no proof the tenant lives there doesn't clear the bar." },
      { kind: "p", text: "Immediate family member: their own tax return, or two of the ID alternatives above, plus proof of the relationship itself. A birth certificate, a marriage certificate, or an Immediate Family Member Affidavit." },
      { kind: "p", text: "Owned through an LLC, corporation, trust, or partnership: the tax return, or two of the ID alternatives above, for whichever majority owner or beneficiary is living there, plus the entity's own paperwork, a partnership agreement, trust agreement, operating agreement, or articles of incorporation, and a Majority Interest Affidavit." },

      { kind: "h", text: "If you disagree with the determination" },
      { kind: "p", text: "A denial isn't final. The NYC Tax Commission hears surcharge appeals directly:" },
      { kind: "link", text: "nyc.gov/site/taxcommission/forms/surcharge-appeal.page", href: "https://www.nyc.gov/site/taxcommission/forms/surcharge-appeal.page" },

      { kind: "h", text: "What changes in 2028, and when it ends" },
      { kind: "p", text: "Starting July 2028, Phase 2 folds every non-primary property over $5M, condo or house, into one rate structure, and shifts valuation from DOF market value to a comparable-sales model. The administrative mechanics of that shift aren't public yet." },
      { kind: "p", text: "The surcharge itself sunsets June 30, 2031, unless Albany renews it." },

      { kind: "h", text: "Where we come in" },
      { kind: "p", text: "As real estate advisors, we don't offer tax advice. Be sure to bring in your accountant or attorney for that. We know how this tax changes the math on holding, buying, or selling a non-primary property across the luxury markets." },
      { kind: "note", text: "Most advisors tell you what you want to hear. We tell you what the market says." },
      { kind: "p", text: "If this tax touches a decision you're weighing, call us. We'll think it through with you, alongside your counsel." },

      { kind: "xref", lead: "For real examples and our take on how this may reshape the luxury market, see Part 6 of the Foundational Report.", label: "Foundational Report, Part 6 →", href: "/report.html#part-6" },

      { kind: "note", text: "Disclaimer. This is general market information, not tax, legal, or financial advice. Property tax rules are complex and subject to change. Confirm your own exposure with a qualified tax advisor or attorney before making a decision, especially if a DOF letter already names your property." },

      { kind: "h", text: "Sources" },
      { kind: "list", items: [
        "NYC Department of Finance, Class 2 Property Tax Guide.",
        "NYC.gov, Non-Primary Residence Surcharge and Surcharge Eligibility Guide.",
        "NYC Department of Finance, Supplemental Market Value Roll (published July 24, 2026).",
        "NYC Tax Commission, Surcharge Appeal.",
        "New York State Assembly Budget Bill A.10009-C / S.9009-C.",
        "Rockefeller Global Family Office, \"New York City Pied-à-Terre Surcharge Moves Forward\" (Rockefeller Insights).",
      ] },
    ],
  },
];

export function listBriefs(): Brief[] {
  return [...BRIEFS].sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getBrief(slug: string): Brief | undefined {
  return BRIEFS.find((b) => b.slug === slug);
}

export function formatBriefDate(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export type PlaceholderBrief = {
  title: string;
  teaser: string;
  status: string;
};

/**
 * Pieces that are planned but not yet published. Shown on the hub with their
 * status and no link. Move an entry out of here and into BRIEFS (as a real
 * Brief with a slug) once it's ready to publish.
 */
export const PLACEHOLDER_BRIEFS: PlaceholderBrief[] = [
  {
    title: "Luxury at Every Size",
    teaser: "How bedroom count is reshaping where the luxury dollar actually goes.",
    status: "In progress",
  },
  {
    title: "The Townhouse Report",
    teaser: "A size-adjusted look at Manhattan's most illiquid luxury product.",
    status: "In progress",
  },
  {
    title: "The Blue Chip List",
    teaser: "Which new-development buildings actually hold value from sponsor sale to resale.",
    status: "In progress",
  },
];
