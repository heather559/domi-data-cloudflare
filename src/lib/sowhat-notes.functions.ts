import { createServerFn } from "@tanstack/react-start";
import type { SowhatNote, SowhatNoteInput } from "@/lib/sowhat-notes";

/** All reviewer notes, newest first. */
export const listSowhatNotes = createServerFn({ method: "GET" }).handler(
  async (): Promise<SowhatNote[]> => {
    const { listNotes } = await import("./sowhat-notes.server");
    return listNotes();
  },
);

/** Records a note against one generated sentence and returns the fresh list. */
export const addSowhatNote = createServerFn({ method: "POST" })
  .inputValidator((data: SowhatNoteInput) => data)
  .handler(async ({ data }): Promise<SowhatNote[]> => {
    const { addNote } = await import("./sowhat-notes.server");
    return addNote(data);
  });

/** Moves a note between open, fixed and won't fix. */
export const setSowhatNoteStatus = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; status: string }) => data)
  .handler(async ({ data }): Promise<SowhatNote[]> => {
    const { setStatus } = await import("./sowhat-notes.server");
    return setStatus(data?.id, data?.status);
  });

/** Removes a note outright. */
export const deleteSowhatNote = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }): Promise<SowhatNote[]> => {
    const { removeNote } = await import("./sowhat-notes.server");
    return removeNote(data?.id);
  });
