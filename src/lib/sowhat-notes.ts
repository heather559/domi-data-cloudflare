// Shared types and formatting for reviewer notes on the So What debugger.
// Client-safe: no database access here.

export type NoteStatus = "open" | "fixed" | "wontfix";

export interface SowhatNote {
  id: string;
  neighborhood_slug: string;
  block_key: string;
  block_label: string | null;
  sentence_snapshot: string | null;
  note: string;
  correction: string | null;
  status: NoteStatus;
  author: string | null;
  created_at: string;
}

export interface SowhatNoteInput {
  neighborhoodSlug: string;
  blockKey: string;
  blockLabel?: string | null;
  sentenceSnapshot?: string | null;
  note: string;
  correction?: string | null;
  author?: string | null;
}

export const STATUS_LABEL: Record<NoteStatus, string> = {
  open: "open",
  fixed: "fixed",
  wontfix: "won't fix",
};

/** Flat CSV of every note, for pasting into a work list. */
export function notesCsv(rows: SowhatNote[]): string {
  const head = [
    "created_at",
    "status",
    "neighborhood_slug",
    "block_key",
    "block_label",
    "note",
    "correction",
    "author",
    "sentence_snapshot",
  ];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [
    head.join(","),
    ...rows.map((r) =>
      [
        r.created_at,
        r.status,
        r.neighborhood_slug,
        r.block_key,
        r.block_label,
        r.note,
        r.correction,
        r.author,
        r.sentence_snapshot,
      ]
        .map(esc)
        .join(","),
    ),
  ].join("\n");
}
