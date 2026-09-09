import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { listPipelineRunsFn } from "../lib/pipeline-runs.functions";
import { runPipelineAlertCheckNow } from "../lib/pipeline-alerts.functions";
import {
  fmtDuration,
  fmtStamp,
  runsCsv,
  uniqueSorted,
  type PipelineRun,
} from "../lib/pipeline-runs";

export const Route = createFileRoute("/pipeline-runs")({
  loader: async (): Promise<PipelineRun[]> => {
    try {
      return await listPipelineRunsFn();
    } catch {
      return [];
    }
  },
  head: () => ({
    meta: [
      { title: "Pipeline runs \u00b7 internal" },
      {
        name: "description",
        content: "Internal dashboard of data pipeline agent runs and their status.",
      },
      { name: "robots", content: "noindex, nofollow, noai, noimageai" },
      { property: "og:title", content: "Pipeline runs \u00b7 internal" },
      {
        property: "og:description",
        content: "Internal dashboard of data pipeline agent runs and their status.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PipelineRunsPage,
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

function PipelineRunsPage() {
  const runs = Route.useLoaderData() as PipelineRun[];

  const [agent, setAgent] = useState("all");
  const [status, setStatus] = useState("all");
  const [week, setWeek] = useState("all");
  const [query, setQuery] = useState("");
  const [checking, setChecking] = useState(false);
  const [checkNote, setCheckNote] = useState<string | null>(null);

  const agents = useMemo(() => uniqueSorted(runs.map((r) => r.agentName)), [runs]);
  const statuses = useMemo(() => uniqueSorted(runs.map((r) => r.status)), [runs]);
  const weeks = useMemo(
    () => uniqueSorted(runs.map((r) => r.weekStart).filter(Boolean)).reverse(),
    [runs],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return runs.filter((r) => {
      if (agent !== "all" && r.agentName !== agent) return false;
      if (status !== "all" && r.status !== status) return false;
      if (week !== "all" && r.weekStart !== week) return false;
      if (q && !`${r.agentName} ${r.detail ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [runs, agent, status, week, query]);

  const summary = useMemo(() => {
    const map = new Map<string, { runs: number; last: string | null }>();
    for (const r of filtered) {
      const cur = map.get(r.agentName) ?? { runs: 0, last: null };
      cur.runs += 1;
      if (!cur.last || Date.parse(r.startedAt) > Date.parse(cur.last)) cur.last = r.startedAt;
      map.set(r.agentName, cur);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const resetDisabled =
    agent === "all" && status === "all" && week === "all" && query.trim() === "";

  return (
    <main className="sowhat-debug pipeline-runs">
      <header className="sd-head">
        <h1>Pipeline runs</h1>
        <p>
          Every run written to the pipeline status log, newest first. Timestamps are
          shown in New York time. This page is internal and is not indexed.
        </p>
        <p className="sd-meta">
          {filtered.length} of {runs.length} runs across {agents.length} agents
        </p>
      </header>

      <section className="pr-filters" aria-label="Filters">
        <label>
          <span>Agent</span>
          <select value={agent} onChange={(e) => setAgent(e.target.value)}>
            <option value="all">All agents</option>
            {agents.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All statuses</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Week start</span>
          <select value={week} onChange={(e) => setWeek(e.target.value)}>
            <option value="all">All weeks</option>
            {weeks.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Search detail</span>
          <input
            type="search"
            value={query}
            placeholder="agent or detail text"
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="sd-actions">
          <button
            type="button"
            className="sd-export"
            disabled={resetDisabled}
            onClick={() => {
              setAgent("all");
              setStatus("all");
              setWeek("all");
              setQuery("");
            }}
          >
            Reset filters
          </button>
          <button
            type="button"
            className="sd-export"
            disabled={checking}
            onClick={async () => {
              setChecking(true);
              setCheckNote(null);
              try {
                const r = await runPipelineAlertCheckNow();
                setCheckNote(
                  r.flagged === 0
                    ? `No failed or stalled runs. Stall timeout is ${r.stallMinutes} minutes.`
                    : `${r.flagged} flagged, ${r.notified} notification${r.notified === 1 ? "" : "s"} sent, ${r.skippedAlreadyNotified} already notified.`,
                );
              } catch {
                setCheckNote("Alert check failed. See server logs.");
              } finally {
                setChecking(false);
              }
            }}
          >
            {checking ? "Checking\u2026" : "Run alert check"}
          </button>
          <button
            type="button"
            className="sd-export"
            disabled={filtered.length === 0}
            onClick={() => downloadCsv(runsCsv(filtered), "pipeline-runs")}
          >
            Download CSV
          </button>
        </div>
      </section>

      {checkNote && <p className="sd-meta pr-check-note">{checkNote}</p>}

      {summary.length > 0 && (
        <section className="pr-summary" aria-label="Agent summary">
          {summary.map(([name, s]) => (
            <div key={name} className="sd-card">
              <h3>{name}</h3>
              <p className="sd-sentence">
                {s.runs} {s.runs === 1 ? "run" : "runs"}. Last started {fmtStamp(s.last)}.
              </p>
            </div>
          ))}
        </section>
      )}

      <section aria-label="Run log">
        {filtered.length === 0 ? (
          <p className="sd-empty">No runs match these filters.</p>
        ) : (
          <div className="pr-table-wrap">
            <table className="pr-table">
              <caption className="sr-only">
                Pipeline agent runs with status, timestamps and duration
              </caption>
              <thead>
                <tr>
                  <th scope="col">Agent</th>
                  <th scope="col">Week start</th>
                  <th scope="col">Status</th>
                  <th scope="col">Started</th>
                  <th scope="col">Completed</th>
                  <th scope="col">Duration</th>
                  <th scope="col">Detail</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={`${r.agentName}-${r.weekStart}-${r.startedAt}`}>
                    <th scope="row">{r.agentName}</th>
                    <td>{r.weekStart || "\u2013"}</td>
                    <td>
                      <span className={`pr-status pr-status-${r.status.toLowerCase()}`}>
                        {r.status}
                      </span>
                    </td>
                    <td>{fmtStamp(r.startedAt)}</td>
                    <td>{fmtStamp(r.completedAt)}</td>
                    <td>{fmtDuration(r)}</td>
                    <td className="pr-detail">{r.detail || "\u2013"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
