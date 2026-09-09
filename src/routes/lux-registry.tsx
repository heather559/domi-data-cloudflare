import { createFileRoute } from "@tanstack/react-router";
import { getLuxRegistry } from "../lib/lux-registry.functions";
import {
  buildRegistryCsv,
  fmtDelta,
  fmtMoney,
  type LuxRegistry,
  type LuxRegistryRow,
} from "../lib/lux-registry";

export const Route = createFileRoute("/lux-registry")({
  loader: async (): Promise<LuxRegistry> => {
    try {
      return await getLuxRegistry();
    } catch {
      return { weekStart: null, complete: false, rows: [], unverifiedCitations: [] };
    }
  },
  head: () => ({
    meta: [
      { title: "Luxury registry · internal" },
      {
        name: "description",
        content: "Internal ranking of qualifying Manhattan luxury neighborhoods.",
      },
      { name: "robots", content: "noindex, nofollow, noai, noimageai" },
    ],
  }),
  component: LuxRegistryPage,
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

function RankTable({
  rows,
  mode,
}: {
  rows: LuxRegistryRow[];
  mode: "volume" | "intensity";
}) {
  // Each published board is capped at 10, but both boards carry volume and
  // intensity for every name on them. So the full union can be ranked on either
  // measure. A rank the feed did not publish is shown with a tilde.
  const metric = (r: LuxRegistryRow) => (mode === "volume" ? r.vol52wk : r.pctLux);
  const ranked = rows
    .filter((r) => metric(r) !== null)
    .sort((a, b) => (metric(b) ?? 0) - (metric(a) ?? 0));

  if (ranked.length === 0) {
    return <p className="sd-empty">No rows on this board in the latest feed.</p>;
  }

  return (
    <table className="lr-table">
      <thead>
        <tr>
          <th scope="col">Rank</th>
          <th scope="col">Neighborhood</th>
          <th scope="col">Move</th>
          <th scope="col">{mode === "volume" ? "Luxury volume (52wk)" : "Luxury share"}</th>
          <th scope="col">Luxury contracts (52wk)</th>
          <th scope="col">Qualifies</th>
          <th scope="col">Local luxury median</th>
          <th scope="col">Source</th>
        </tr>
      </thead>
      <tbody>
        {ranked.map((r, i) => {
          const feedRank = mode === "volume" ? r.volumeRank : r.intensityRank;
          return (
            <tr key={r.name} className={r.qualified ? undefined : "lr-row-short"}>
              <td className="lr-num">{feedRank ?? `~${i + 1}`}</td>
              <th scope="row">{r.name}</th>
              <td>{fmtDelta(mode === "volume" ? r.volumeRankDelta : r.intensityRankDelta)}</td>
              <td className="lr-num">
                {mode === "volume"
                  ? fmtMoney(r.vol52wk)
                  : r.pctLux === null
                    ? "n/a"
                    : `${r.pctLux.toFixed(1)}%`}
              </td>
              <td className="lr-num">{r.contracts52wk ?? "n/a"}</td>
              <td className={r.qualified ? "lr-yes" : "lr-no"}>{r.qualified ? "yes" : "no"}</td>
              <td className="lr-num">{fmtMoney(r.localMedian)}</td>
              <td className="lr-src">{r.source}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}


function LuxRegistryPage() {
  const reg = Route.useLoaderData() as LuxRegistry;
  const qualified = reg.rows.filter((r) => r.qualified);

  return (
    <main className="sowhat-debug lux-registry">
      <header className="sd-head">
        <h1>Manhattan luxury registry</h1>
        <p>
          Internal reference. Every neighborhood the feed can account for, ranked on luxury
          dollar volume and on luxury intensity, with the 11 contract qualification floor
          applied. The So What engine reads this same registry: a neighborhood that does not
          appear here, or appears without 11 qualifying contracts, is never cited by name in a
          report. Not linked in navigation and excluded from search.
        </p>
        <div className="sd-actions">
          <p className="sd-meta">
            {qualified.length} of {reg.rows.length} neighborhoods clear the 11 contract floor.
          </p>
          <p className="sd-meta">
            Feed week: {reg.weekStart ?? "none"}.{" "}
            {reg.complete
              ? "Source: uncapped qualified feed."
              : "Source: union of the two top 10 boards."}
          </p>
          <button
            type="button"
            className="sd-export"
            onClick={() => downloadCsv(buildRegistryCsv(reg), "lux-registry")}
          >
            Export registry (CSV)
          </button>
        </div>

        {!reg.complete && (
          <div className="sd-anomalies">
            <h2>Coverage is capped upstream</h2>
            <p>
              The weekly feed publishes only the top 10 by dollar volume and the top 10 by
              intensity. Both boards carry volume and intensity for every name on them, so the
              tables below rank the full merged list on each measure. A rank marked with a tilde
              is derived here rather than published by the feed. A neighborhood outside both
              boards has no contract count anywhere in the data, so the engine cannot verify it
              and drops the comparison. To close the gap, the pipeline should emit an uncapped
              qualified_neighborhoods array (name, contracts_52wk, vol_52wk, pct_lux,
              volume_rank, intensity_rank) for every neighborhood with 11 or more luxury
              contracts over the trailing 52 weeks. This page will use it automatically.
            </p>

          </div>
        )}
      </header>

      <section className="sd-nbhd">
        <h2>Ranked by luxury dollar volume</h2>
        <RankTable rows={reg.rows} mode="volume" />
      </section>

      <section className="sd-nbhd">
        <h2>Ranked by luxury intensity</h2>
        <RankTable rows={reg.rows} mode="intensity" />
      </section>

      <section className="sd-nbhd">
        <h2>Cited but unverifiable</h2>
        <p className="sd-meta">
          Names sitting in a report's nextNeighborhood field that the registry cannot confirm.
          These comparisons are dropped from the copy rather than published unchecked.
        </p>
        {reg.unverifiedCitations.length === 0 ? (
          <p className="sd-empty">Every cited neighbor clears the floor. No comparisons dropped.</p>
        ) : (
          <ul className="lr-dropped">
            {reg.unverifiedCitations.map((u) => (
              <li key={`${u.citedBy}-${u.cited}`}>
                <strong>{u.cited}</strong> cited by {u.citedBy}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
