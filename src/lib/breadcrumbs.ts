/**
 * Single source of truth for breadcrumb trails.
 *
 * Every trail below mirrors the page's real navigational path (the same labels
 * and hrefs a visitor follows to reach the page), so the emitted
 * BreadcrumbList schema cannot drift from what the site actually shows.
 *
 * JSON-LD convention matches the rest of the site: one standalone
 * `application/ld+json` script per schema type, emitted from the route
 * `head()` (see archive.$weekStart, briefs.$slug, neighborhoods.$slug).
 */

export const SITE_BASE = "https://domidata.heatherdomi.com";

export type Crumb = { name: string; href: string };

/** Every trail starts at Home. */
const HOME: Crumb = { name: "Home", href: "/" };

const abs = (href: string) => (href.startsWith("http") ? href : `${SITE_BASE}${href}`);

/** Build a BreadcrumbList JSON-LD object from a visual trail. */
export function breadcrumbList(trail: Crumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: abs(c.href),
    })),
  };
}

/** Route-`head()`-ready script descriptor. */
export function breadcrumbScript(trail: Crumb[]) {
  return {
    type: "application/ld+json",
    children: JSON.stringify(breadcrumbList(trail)),
  };
}

/** Raw `<script>` tag, for the static HTML reports served verbatim. */
export function breadcrumbScriptTag(trail: Crumb[]) {
  return `<script type="application/ld+json">${JSON.stringify(breadcrumbList(trail))}</script>`;
}

/* ── Canonical trails ── */

export const TRAILS = {
  thisWeek: [HOME, { name: "The Week", href: "/this-week" }],
  monthly: [HOME, { name: "The Month", href: "/monthly" }],
  quarterly: [HOME, { name: "The Quarterly", href: "/quarterly-brief.html" }],
  foundational: [HOME, { name: "The Foundational Report", href: "/report.html" }],
  neighborhoods: [HOME, { name: "Neighborhoods", href: "/neighborhoods" }],
} satisfies Record<string, Crumb[]>;

/** Home → Neighborhoods → <Neighborhood>. */
export function neighborhoodTrail(name: string, slug: string): Crumb[] {
  return [...TRAILS.neighborhoods, { name, href: `/neighborhoods/${slug}` }];
}
