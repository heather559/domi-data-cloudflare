// Server-only store for reviewer notes left on the So What debugger. The table
// is locked to the public API, so every read and write goes through here.
import type { NoteStatus, SowhatNote, SowhatNoteInput } from "@/lib/sowhat-notes";

const MAX = 4000;

function clean(v: unknown, limit = MAX): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, limit);
  return t.length ? t : null;
}

function isStatus(v: unknown): v is NoteStatus {
  return v === "open" || v === "fixed" || v === "wontfix";
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as { from: (t: string) => any };
}

const COLS =
  "id, neighborhood_slug, block_key, block_label, sentence_snapshot, note, correction, status, author, created_at";

export async function listNotes(): Promise<SowhatNote[]> {
  try {
    const client = await admin();
    const { data } = await client
      .from("sowhat_notes")
      .select(COLS)
      .order("created_at", { ascending: false })
      .limit(1000);
    return (data ?? []) as SowhatNote[];
  } catch (err) {
    console.error("[sowhat_notes] list failed:", err);
    return [];
  }
}

export async function addNote(input: SowhatNoteInput): Promise<SowhatNote[]> {
  const note = clean(input?.note);
  const slug = clean(input?.neighborhoodSlug, 120);
  const blockKey = clean(input?.blockKey, 120);
  if (!note || !slug || !blockKey) return listNotes();

  try {
    const client = await admin();
    await client.from("sowhat_notes").insert({
      neighborhood_slug: slug,
      block_key: blockKey,
      block_label: clean(input.blockLabel, 200),
      sentence_snapshot: clean(input.sentenceSnapshot),
      note,
      correction: clean(input.correction),
      author: clean(input.author, 120),
    });
  } catch (err) {
    console.error("[sowhat_notes] insert failed:", err);
  }
  return listNotes();
}

export async function setStatus(id: unknown, status: unknown): Promise<SowhatNote[]> {
  const noteId = clean(id, 60);
  if (!noteId || !isStatus(status)) return listNotes();
  try {
    const client = await admin();
    await client.from("sowhat_notes").update({ status }).eq("id", noteId);
  } catch (err) {
    console.error("[sowhat_notes] status update failed:", err);
  }
  return listNotes();
}

export async function removeNote(id: unknown): Promise<SowhatNote[]> {
  const noteId = clean(id, 60);
  if (!noteId) return listNotes();
  try {
    const client = await admin();
    await client.from("sowhat_notes").delete().eq("id", noteId);
  } catch (err) {
    console.error("[sowhat_notes] delete failed:", err);
  }
  return listNotes();
}
