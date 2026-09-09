// Canonical bedroom labels.
//
// Upstream payloads use several spellings for the same segment ("1BR",
// "1-Bed", "1 Bed", "4+BR", "4+ Beds"). Any comparison that relies on raw
// upstream wording is fragile: a feed change silently breaks leader matching
// and contradiction checks. Everything in the app funnels label text through
// canonicalBedLabel() first, so comparisons are made on one vocabulary.

export const CANONICAL_BED_LABELS = [
  "Studio",
  "1-Bed",
  "2-Bed",
  "3-Bed",
  "4+ Beds",
] as const;

export type CanonicalBedLabel = (typeof CANONICAL_BED_LABELS)[number];

// Normalized key (lowercased, punctuation and spaces stripped) -> canonical label.
const ALIASES: Record<string, CanonicalBedLabel> = {
  studio: "Studio",
  studios: "Studio",
  "0": "Studio",
  "0br": "Studio",
  "0bed": "Studio",
  "0bedroom": "Studio",
  alcovestudio: "Studio",
  // Upstream bucket that folds studios together with unclassified units.
  studioother: "Studio",
  otherstudio: "Studio",

  "1": "1-Bed",
  "1br": "1-Bed",
  "1bed": "1-Bed",
  "1beds": "1-Bed",
  "1bedroom": "1-Bed",
  "1bedrooms": "1-Bed",
  onebedroom: "1-Bed",

  "2": "2-Bed",
  "2br": "2-Bed",
  "2bed": "2-Bed",
  "2beds": "2-Bed",
  "2bedroom": "2-Bed",
  "2bedrooms": "2-Bed",
  twobedroom: "2-Bed",

  "3": "3-Bed",
  "3br": "3-Bed",
  "3bed": "3-Bed",
  "3beds": "3-Bed",
  "3bedroom": "3-Bed",
  "3bedrooms": "3-Bed",
  threebedroom: "3-Bed",

  "4": "4+ Beds",
  "4+": "4+ Beds",
  "4br": "4+ Beds",
  "4bed": "4+ Beds",
  "4beds": "4+ Beds",
  "4bedroom": "4+ Beds",
  "4bedrooms": "4+ Beds",
  "4plus": "4+ Beds",
  "4plusbeds": "4+ Beds",
  "4orbeds": "4+ Beds",
  "4orbedrooms": "4+ Beds",
  fourplusbedroom: "4+ Beds",
};

/**
 * The alias table as data, for exports and downstream tools.
 * Each entry is a normalized upstream key and the canonical label it resolves to,
 * ordered Studio -> 1-Bed -> 2-Bed -> 3-Bed -> 4+ Beds.
 */
export function bedLabelAliasMap(): { alias: string; canonical: CanonicalBedLabel }[] {
  return Object.entries(ALIASES)
    .map(([alias, canonical]) => ({ alias, canonical }))
    .sort(
      (a, b) =>
        CANONICAL_BED_LABELS.indexOf(a.canonical) - CANONICAL_BED_LABELS.indexOf(b.canonical) ||
        a.alias.localeCompare(b.alias),
    );
}

function normalizeKey(label: unknown): string {
  return String(label ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[._]/g, "")
    .replace(/-/g, "")
    .replace(/bedrooms?/g, (m) => m) // keep word, handled by alias table
    .replace(/[^a-z0-9+]/g, "");
}

/** Map any upstream spelling to the canonical label. Unknown input passes through trimmed. */
export function canonicalBedLabel(label: unknown): string {
  const key = normalizeKey(label);
  if (ALIASES[key]) return ALIASES[key];
  // "Studio/Other", "Studio & Other" and similar compounds all lead with studio.
  if (key.startsWith("studio")) return "Studio";
  // "4+beds", "4+bed", "4+br" all normalize with the plus retained
  if (key.startsWith("4")) return "4+ Beds";
  return String(label ?? "").trim();
}

/** True when two labels name the same segment regardless of upstream wording. */
export function sameBedSegment(a: unknown, b: unknown): boolean {
  const ca = canonicalBedLabel(a);
  const cb = canonicalBedLabel(b);
  if (!ca || !cb) return false;
  return ca.toLowerCase() === cb.toLowerCase();
}

/** Display order: Studio -> 1 -> 2 -> 3 -> 4+. Unknown labels sort last. */
export function bedSortIndex(label: unknown): number {
  const i = (CANONICAL_BED_LABELS as readonly string[]).indexOf(canonicalBedLabel(label));
  return i === -1 ? CANONICAL_BED_LABELS.length : i;
}

/** Normalize and order a label/value series in one step. */
export function normalizeBedSeries<T extends { label: string }>(series: T[] | undefined): T[] {
  return (series ?? [])
    .map((d) => ({ ...d, label: canonicalBedLabel(d.label) }))
    .sort((a, b) => bedSortIndex(a.label) - bedSortIndex(b.label));
}
