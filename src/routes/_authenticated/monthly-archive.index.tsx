import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useAdminRole } from "@/hooks/use-admin-role";
import {
  listMonthlyArchive,
  archiveCurrentMonthlyReport,
} from "@/lib/monthly-archive.functions";
import { archiveCss } from "@/lib/monthly-archive.ui";

export const Route = createFileRoute("/_authenticated/monthly-archive/")({
  head: () => ({
    meta: [
      { title: "The Month archive · internal" },
      { name: "description", content: "Frozen editions of the Domi Data monthly report." },
      { name: "robots", content: "noindex, nofollow, noai, noimageai" },
    ],
  }),
  component: MonthlyArchiveIndex,
});

function fmtMonth(d: string) {
  const [y, m] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function MonthlyArchiveIndex() {
  const { state } = useAdminRole();
  const qc = useQueryClient();
  const list = useServerFn(listMonthlyArchive);
  const snapshot = useServerFn(archiveCurrentMonthlyReport);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["monthly-archive"],
    queryFn: () => list(),
    enabled: state === "admin",
  });

  async function onSnapshot() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await snapshot({ data: undefined as never });
      setMsg(res ? `Archived ${fmtMonth(res.month_start)}.` : "Nothing to archive.");
      await qc.invalidateQueries({ queryKey: ["monthly-archive"] });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Archive failed.");
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading") {
    return (
      <main className="internal-index">
        <p className="lede">Checking access…</p>
        <style>{archiveCss}</style>
      </main>
    );
  }
  if (state === "denied") {
    return (
      <main className="internal-index">
        <h1>Access restricted</h1>
        <p className="lede">This page requires an admin account.</p>
        <style>{archiveCss}</style>
      </main>
    );
  }

  const rows = data ?? [];

  return (
    <main className="internal-index">
      <header>
        <p className="eyebrow">Internal</p>
        <h1>The Month archive</h1>
        <p className="lede">
          Frozen editions of the monthly report. Each snapshot holds the figures exactly as they
          published, so a later data load never rewrites history.
        </p>
        <p>
          <button type="button" className="btn" onClick={onSnapshot} disabled={busy}>
            {busy ? "Archiving…" : "Archive the current month"}
          </button>{" "}
          <Link to="/internal">Back to the site index</Link>
        </p>
        {msg ? <p className="note">{msg}</p> : null}
      </header>

      {isLoading ? (
        <p className="note">Loading archive…</p>
      ) : rows.length === 0 ? (
        <p className="note">No months archived yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">Month</th>
              <th scope="col">Archived</th>
              <th scope="col">Page</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.month_start}>
                <th scope="row">{fmtMonth(r.month_start)}</th>
                <td>{new Date(r.archived_at).toLocaleString()}</td>
                <td>
                  <Link
                    to="/monthly-archive/$monthStart"
                    params={{ monthStart: r.month_start }}
                  >
                    /monthly-archive/{r.month_start}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <style>{archiveCss}</style>
    </main>
  );
}
