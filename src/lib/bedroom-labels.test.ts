import { describe, expect, it } from "vitest";
import {
  CANONICAL_BED_LABELS,
  canonicalBedLabel,
  sameBedSegment,
  bedSortIndex,
  normalizeBedSeries,
} from "./bedroom-labels";

// Every known upstream spelling, grouped by the segment it must resolve to.
// Add new upstream variants here first; the suite then enforces mapping,
// matching, and ordering for them in one place.
const ALIAS_GROUPS: Record<(typeof CANONICAL_BED_LABELS)[number], string[]> = {
  Studio: [
    "Studio",
    "studio",
    "  STUDIO  ",
    "Studios",
    "0",
    "0BR",
    "0-Bed",
    "0 Bed",
    "0 Bedroom",
    "Alcove Studio",
  ],
  "1-Bed": ["1", "1BR", "1-Bed", "1 Bed", "1 Beds", "1 Bedroom", "1 Bedrooms", "One Bedroom", "one bedroom"],
  "2-Bed": ["2", "2BR", "2-Bed", "2 Bed", "2 Beds", "2 Bedroom", "2 Bedrooms", "Two Bedroom"],
  "3-Bed": ["3", "3BR", "3-Bed", "3 Bed", "3 Beds", "3 Bedroom", "3 Bedrooms", "Three Bedroom"],
  "4+ Beds": [
    "4",
    "4+",
    "4BR",
    "4+BR",
    "4-Bed",
    "4 Beds",
    "4+ Beds",
    "4 Bedroom",
    "4 Bedrooms",
    "4 Plus",
    "4 Plus Beds",
    "4 or more beds",
    "4 or more bedrooms",
    "Four Plus Bedroom",
  ],
};

const ALL_ALIASES = Object.entries(ALIAS_GROUPS).flatMap(([canonical, aliases]) =>
  aliases.map((alias) => ({ canonical, alias })),
);

describe("canonicalBedLabel", () => {
  it.each(ALL_ALIASES)("maps $alias to $canonical", ({ alias, canonical }) => {
    expect(canonicalBedLabel(alias)).toBe(canonical);
  });

  it("is idempotent on canonical labels", () => {
    for (const label of CANONICAL_BED_LABELS) {
      expect(canonicalBedLabel(canonicalBedLabel(label))).toBe(label);
    }
  });

  it("passes unknown labels through trimmed rather than guessing", () => {
    expect(canonicalBedLabel("  Penthouse  ")).toBe("Penthouse");
    expect(canonicalBedLabel("Loft")).toBe("Loft");
  });

  it("handles null and undefined without throwing", () => {
    expect(canonicalBedLabel(null)).toBe("");
    expect(canonicalBedLabel(undefined)).toBe("");
  });
});

describe("sameBedSegment", () => {
  it("matches every alias against every other alias of the same segment", () => {
    for (const aliases of Object.values(ALIAS_GROUPS)) {
      for (const a of aliases) {
        for (const b of aliases) {
          expect(sameBedSegment(a, b)).toBe(true);
        }
      }
    }
  });

  it("never matches aliases across different segments", () => {
    const groups = Object.values(ALIAS_GROUPS);
    for (let i = 0; i < groups.length; i += 1) {
      for (let j = 0; j < groups.length; j += 1) {
        if (i === j) continue;
        expect(sameBedSegment(groups[i][0], groups[j][0])).toBe(false);
      }
    }
  });

  it("matches the real upstream mismatch: volumeData vs countData wording", () => {
    expect(sameBedSegment("1BR", "1-Bed")).toBe(true);
    expect(sameBedSegment("4+BR", "4+ Beds")).toBe(true);
    expect(sameBedSegment("3BR", "3-Bed")).toBe(true);
  });

  it("returns false when either side is empty", () => {
    expect(sameBedSegment("", "1-Bed")).toBe(false);
    expect(sameBedSegment(null, undefined)).toBe(false);
  });
});

describe("bedSortIndex", () => {
  it("orders the canonical labels Studio through 4+ Beds", () => {
    expect(CANONICAL_BED_LABELS.map(bedSortIndex)).toEqual([0, 1, 2, 3, 4]);
  });

  it("gives every alias the index of its canonical segment", () => {
    for (const { alias, canonical } of ALL_ALIASES) {
      expect(bedSortIndex(alias)).toBe(
        (CANONICAL_BED_LABELS as readonly string[]).indexOf(canonical),
      );
    }
  });

  it("sorts unknown labels last", () => {
    expect(bedSortIndex("Penthouse")).toBe(CANONICAL_BED_LABELS.length);
    expect(bedSortIndex("Penthouse")).toBeGreaterThan(bedSortIndex("4+ Beds"));
  });
});

describe("normalizeBedSeries", () => {
  it("normalizes labels and reorders a shuffled upstream volumeData series", () => {
    const upstream = [
      { label: "4+BR", value: 40 },
      { label: "3BR", value: 30 },
      { label: "1BR", value: 10 },
      { label: "2BR", value: 20 },
      { label: "Studio", value: 5 },
    ];
    expect(normalizeBedSeries(upstream)).toEqual([
      { label: "Studio", value: 5 },
      { label: "1-Bed", value: 10 },
      { label: "2-Bed", value: 20 },
      { label: "3-Bed", value: 30 },
      { label: "4+ Beds", value: 40 },
    ]);
  });

  it("produces identical label sequences for volumeData and countData wording", () => {
    const volume = normalizeBedSeries([
      { label: "4+BR", value: 1 },
      { label: "Studio", value: 2 },
      { label: "2BR", value: 3 },
    ]);
    const count = normalizeBedSeries([
      { label: "2-Bed", value: 3 },
      { label: "4+ Beds", value: 1 },
      { label: "Studio", value: 2 },
    ]);
    expect(volume.map((d) => d.label)).toEqual(count.map((d) => d.label));
  });

  it("returns an empty array for undefined input", () => {
    expect(normalizeBedSeries(undefined)).toEqual([]);
  });
});
