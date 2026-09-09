import { useState } from "react";

// Fixed UTC formatting so server and client render the same string.
const fmtNoteDate = (raw: string) => {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw ?? "";
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}`;
};

import { createFileRoute } from "@tanstack/react-router";
import { buildWeeklyWorkbookNow } from "../lib/weekly-workbook.functions";
import { buildMonthlyWorkbookNow } from "../lib/monthly-workbook.functions";
import { getNeighborhoodReportBySlug } from "../lib/neighborhood-report.functions";
import {
  NEIGHBORHOOD_SLUGS as SLUGS,
  buildBlocks,
  buildCsv,
  buildBedLabelMapCsv,
  type Row,
} from "../lib/sowhat-audit";
import {
  getBedroomLabelAnomalies,
  type BedroomLabelAnomaly,
} from "../lib/label-anomalies.functions";
import {
  listSowhatNotes,
  addSowhatNote,
  setSowhatNoteStatus,
  deleteSowhatNote,
} from "../lib/sowhat-notes.functions";
import {
  notesCsv,
  STATUS_LABEL,
  type NoteStatus,
  type SowhatNote,
} from "../lib/sowhat-notes";



export const Route = createFileRoute("/sowhat-debug")({
  loader: async (): Promise<{
    rows: Row[];
    anomalies: BedroomLabelAnomaly[];
    notes: SowhatNote[];
  }> => {
    const [rows, anomalies, notes] = await Promise.all([
      Promise.all(
        SLUGS.map(async (slug) => {
          try {
            const report = await getNeighborhoodReportBySlug({ data: { slug } });
            return { slug, report };
          } catch {
            return { slug, report: null };
          }
        }),
      ),
      getBedroomLabelAnomalies().catch(() => [] as BedroomLabelAnomaly[]),
      listSowhatNotes().catch(() => [] as SowhatNote[]),
    ]);
    return { rows, anomalies, notes };
  },
  head: () => ({
    meta: [
      { title: "So What engine debugger · internal" },
      { name: "description", content: "Internal audit view for generated report sentences." },
      { name: "robots", content: "noindex, nofollow, noai, noimageai" },
    ],
  }),
  component: SowhatDebug,
});



function downloadCsv(csv: string, name: string) {
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Note panel attached to one generated sentence. */
function NoteBox({
  slug,
  blockKey,
  blockLabel,
  sentence,
  notes,
  author,
  onAuthor,
  onChanged,
}: {
  slug: string;
  blockKey: string;
  blockLabel: string;
  sentence: string;
  notes: SowhatNote[];
  author: string;
  onAuthor: (v: string) => void;
  onChanged: (next: SowhatNote[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [correction, setCorrection] = useState("");
  const [busy, setBusy] = useState(false);

  const openCount = notes.filter((n) => n.status === "open").length;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim() || busy) return;
    setBusy(true);
    try {
      const next = await addSowhatNote({
        data: {
          neighborhoodSlug: slug,
          blockKey,
          blockLabel,
          sentenceSnapshot: sentence,
          note,
          correction,
          author,
        },
      });
      onChanged(next);
      setNote("");
      setCorrection("");
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const cycle = async (n: SowhatNote) => {
    const order: NoteStatus[] = ["open", "fixed", "wontfix"];
    const next = order[(order.indexOf(n.status) + 1) % order.length];
    setBusy(true);
    try {
      onChanged(await setSowhatNoteStatus({ data: { id: n.id, status: next } }));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (n: SowhatNote) => {
    setBusy(true);
    try {
      onChanged(await deleteSowhatNote({ data: { id: n.id } }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sd-notes">
      {notes.length > 0 && (
        <ul className="sd-note-list">
          {notes.map((n) => (
            <li key={n.id} className={`sd-note sd-note-${n.status}`}>
              <p className="sd-note-body">{n.note}</p>
              {n.correction ? (
                <p className="sd-note-fix">
                  <span>suggested</span> {n.correction}
                </p>
              ) : null}
              <p className="sd-note-meta">
                {n.author || "anonymous"} · {fmtNoteDate(n.created_at)} ·{" "}

                <button type="button" onClick={() => cycle(n)} disabled={busy}>
                  {STATUS_LABEL[n.status]}
                </button>{" "}
                ·{" "}
                <button type="button" onClick={() => remove(n)} disabled={busy}>
                  delete
                </button>
              </p>
            </li>
          ))}
        </ul>
      )}

      {open ? (
        <form className="sd-note-form" onSubmit={submit}>
          <label>
            <span>What is wrong</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              required
              placeholder="Chinatown should not be cited here."
            />
          </label>
          <label>
            <span>Suggested correction (optional)</span>
            <textarea
              value={correction}
              onChange={(e) => setCorrection(e.target.value)}
              rows={2}
              placeholder="Drop the comparison, or cite Tribeca instead."
            />
          </label>
          <label>
            <span>Your name</span>
            <input value={author} onChange={(e) => onAuthor(e.target.value)} />
          </label>
          <div className="sd-note-actions">
            <button type="submit" className="sd-export" disabled={busy || !note.trim()}>
              {busy ? "Saving..." : "Save note"}
            </button>
            <button type="button" className="sd-note-cancel" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="sd-note-add" onClick={() => setOpen(true)}>
          {openCount ? `Add note (${openCount} open)` : "Add note"}
        </button>
      )}
    </div>
  );
}

function SowhatDebug() {
  const loaded = Route.useLoaderData() as {
    rows: Row[];
    anomalies: BedroomLabelAnomaly[];
    notes: SowhatNote[];
  };
  const { rows, anomalies } = loaded;
  const [notes, setNotes] = useState<SowhatNote[]>(loaded.notes);
  const [author, setAuthor] = useState("");
  const [resolving, setResolving] = useState(false);
  const openNotes = notes.filter((n) => n.status === "open");
  const notesFor = (slug: string, blockKey: string) =>
    notes.filter((n) => n.neighborhood_slug === slug && n.block_key === blockKey);
  const live = rows.filter((r: Row) => r.report);
  const contradictionCount = rows.reduce(
    (n: number, r: Row) =>
      n + (r.report ? buildBlocks(r.report).filter((b) => b.audit?.length).length : 0),
    0,
  );


  const handleExport = () => downloadCsv(buildCsv(rows), "sowhat-audit");
  const handleExportLabelMap = () =>
    downloadCsv(buildBedLabelMapCsv(), "bedroom-label-map");
  const handleExportNotes = () => downloadCsv(notesCsv(notes), "sowhat-notes");


  const [building, setBuilding] = useState<null | "weekly" | "monthly">(null);
  const handleWorkbook = async (kind: "weekly" | "monthly") => {
    setBuilding(kind);
    try {
      const book =
        kind === "weekly" ? await buildWeeklyWorkbookNow() : await buildMonthlyWorkbookNow();
      const bytes = Uint8Array.from(atob(book.base64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = book.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("workbook build failed", e);
      alert("Workbook build failed. Check the console.");
    } finally {
      setBuilding(null);
    }
  };



  return (
    <main className="sowhat-debug">
      <header className="sd-head">
        <h1>So What engine debugger</h1>
        <p>
          Internal audit view. Every generated sentence with the inputs that produced it and
          the branch of the logic that fired. Not linked in navigation and excluded from search.
        </p>
        <div className="sd-actions">
          <p className="sd-meta">
            {live.length} of {rows.length} neighborhoods have a published payload.
          </p>
          <p className={contradictionCount ? "sd-meta sd-meta-alert" : "sd-meta"}>
            {contradictionCount
              ? `${contradictionCount} sentence${contradictionCount === 1 ? "" : "s"} contradict their inputs.`
              : "No sentences contradict their inputs."}
          </p>
          <p className={anomalies.length ? "sd-meta sd-meta-alert" : "sd-meta"}>
            {anomalies.length
              ? `${anomalies.length} unmapped bedroom label${anomalies.length === 1 ? "" : "s"} in the feed.`
              : "All bedroom labels map to the canonical set."}
          </p>
          <p className={openNotes.length ? "sd-meta sd-meta-alert" : "sd-meta"}>
            {openNotes.length
              ? `${openNotes.length} open review note${openNotes.length === 1 ? "" : "s"}.`
              : "No open review notes."}
          </p>

          {openNotes.length > 0 && (
            <button
              type="button"
              className="sd-export"
              disabled={resolving}
              onClick={async () => {
                if (!confirm(`Mark all ${openNotes.length} open notes as fixed?`)) return;
                setResolving(true);
                try {
                  let next = notes;
                  for (const n of openNotes) {
                    next = await setSowhatNoteStatus({ data: { id: n.id, status: "fixed" } });
                  }
                  setNotes(next);
                } finally {
                  setResolving(false);
                }
              }}
            >
              {resolving ? "Resolving..." : `Mark all ${openNotes.length} open notes fixed`}
            </button>
          )}
          <button type="button" className="sd-export" onClick={handleExport}>
            Export audit grid (CSV)
          </button>
          <button type="button" className="sd-export" onClick={handleExportNotes}>
            Export review notes (CSV)
          </button>


          <button type="button" className="sd-export" onClick={handleExportLabelMap}>
            Export bedroom label map (CSV)
          </button>
          <button
            type="button"
            className="sd-export"
            onClick={() => handleWorkbook("weekly")}
            disabled={building !== null}
          >
            {building === "weekly" ? "Building workbook..." : "Download weekly workbook (XLSX)"}
          </button>
          <button
            type="button"
            className="sd-export"
            onClick={() => handleWorkbook("monthly")}
            disabled={building !== null}
          >
            {building === "monthly" ? "Building workbook..." : "Download monthly workbook (XLSX)"}
          </button>
        </div>

        {anomalies.length > 0 && (
          <div className="sd-anomalies">
            <h2>Unmapped bedroom labels</h2>
            <p>
              Recorded when report data is written. These labels do not resolve to Studio, 1-Bed,
              2-Bed, 3-Bed, or 4+ Beds, so they pass through unchanged. Add an alias in
              bedroom-labels.ts and canonical_bed_label, or correct the upstream feed.
            </p>
            <ul>
              {anomalies.map((a: BedroomLabelAnomaly) => (
                <li key={`${a.neighborhood_slug}-${a.period}-${a.series}-${a.raw_label}`}>
                  <strong>{a.raw_label}</strong> · {a.neighborhood_slug ?? "unknown"} ·{" "}
                  {a.period ?? "unknown period"} · {a.series} · seen {a.occurrences}x
                </li>
              ))}
            </ul>
          </div>
        )}
      </header>



      {rows.map(({ slug, report }: Row) => (
        <section key={slug} className="sd-nbhd">
          <h2>
            {report?.payload?.geo ?? slug}
            <span className="sd-slug">/{slug}</span>
            {report?.payload?.periodLabel ? (
              <span className="sd-period">{report.payload.periodLabel}</span>
            ) : null}
          </h2>

          {!report ? (
            <p className="sd-empty">No payload row. Page renders the fallback state.</p>
          ) : (
            <div className="sd-grid">
              {buildBlocks(report).map((b) => (
                <article
                  key={b.key}
                  className={b.audit?.length ? "sd-card sd-card-contradiction" : "sd-card"}
                >
                  <h3>{b.label}</h3>
                  <p className="sd-sentence">{b.sentence || <em>empty</em>}</p>
                  <p className="sd-branch">
                    <span>branch</span> {b.branch}
                  </p>
                  {b.audit?.length ? (
                    <ul className="sd-contradictions">
                      {b.audit.map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                  ) : null}
                  {b.flag ? <p className="sd-flag">{b.flag}</p> : null}

                  <dl className="sd-inputs">
                    {b.inputs.map(([k, v]) => (
                      <div key={k}>
                        <dt>{k}</dt>
                        <dd>{v || "n/a"}</dd>
                      </div>
                    ))}
                  </dl>

                  <NoteBox
                    slug={slug}
                    blockKey={b.key}
                    blockLabel={b.label}
                    sentence={b.sentence ?? ""}
                    notes={notesFor(slug, b.key)}
                    author={author}
                    onAuthor={setAuthor}
                    onChanged={setNotes}
                  />
                </article>

              ))}
            </div>
          )}
        </section>
      ))}
    </main>
  );
}
