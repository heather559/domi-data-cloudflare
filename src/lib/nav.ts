export type NavLink = {
  label: string;
  href: string;
  /** One-line descriptor shown inside dropdown panels. */
  note?: string;
  /** Set false to keep an entry in the config but out of the rendered nav. */
  enabled?: boolean;
};

export type NavGroup = {
  label: string;
  /** Landing page for the group label itself. */
  href: string;
  children: NavLink[];
};

export type NavEntry = NavLink | NavGroup;

export const isGroup = (e: NavEntry): e is NavGroup =>
  Array.isArray((e as NavGroup).children);

export const NAV: NavEntry[] = [
  {
    label: "Reports",
    href: "/this-week",
    children: [
      { label: "The Week", href: "/this-week", note: "Manhattan-wide, every Monday" },
      { label: "The Month", href: "/monthly", note: "Published after month close" },
      { label: "The Quarter", href: "/quarterly-brief.html", note: "Reconciled against the public record" },
      { label: "Foundational Report", href: "/report.html", note: "Five years, twenty-one quarters" },
      { label: "Archive", href: "/archive", note: "Every locked weekly snapshot" },
    ],
  },
  { label: "Neighborhoods", href: "/neighborhoods" },
  {
    label: "Briefs",
    href: "/briefs",
    children: [
      { label: "All Briefs", href: "/briefs", note: "Special reports, published as warranted" },
      { label: "Pied-à-Terre Tax Brief", href: "/briefs/pied-a-terre-tax", note: "Who owes the new surcharge, and how to respond" },
    ],
  },
  { label: "Buy / Sell", href: "/buy-sell" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

const visible = (l: NavLink) => l.enabled !== false;

/** Flat list, used by the mobile drawer fallback and any legacy consumer. */
export const NAV_LINKS: NavLink[] = NAV.flatMap((e) =>
  isGroup(e) ? e.children.filter(visible) : visible(e) ? [e] : []
);

export const NAV_ENTRIES: NavEntry[] = NAV.map((e) =>
  isGroup(e) ? { ...e, children: e.children.filter(visible) } : e
).filter((e) => (isGroup(e) ? e.children.length > 0 : visible(e)));
