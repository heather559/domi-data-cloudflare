import type { WeeklyReportPayload } from "./weekly-report.functions";

// Signed contract reconciliation.
//
// The weekly payload carries two views of the same set of luxury contracts:
// the hero totals and the neighborhood activity leaderboard. When a contract
// lands in the leaderboard after the hero totals were computed (the East
// Village $5.5M contract in the week of 2026-07-27 is the reference case),
// the page shows a headline count that is lower than the table beneath it.
//
// The leaderboard is the contract-level view, so when it sums HIGHER than the
// hero we lift the hero to match. We never lower the hero: the leaderboard is
// capped at ten neighborhoods upstream, so a lower sum is expected truncation
// rather than a missing contract.

const LEADERBOARD_CAP = 10;

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * Rescale a period-over-period percentage after the current value changed.
 * The prior value is implied by the original pair, so it stays fixed.
 */
function rescalePct(pct: unknown, oldValue: number, newValue: number): number | null {
  const p = num(pct);
  if (p === null || oldValue <= 0) return p;
  const prior = oldValue / (1 + p / 100);
  if (!Number.isFinite(prior) || prior <= 0) return p;
  return (newValue / prior - 1) * 100;
}

export type HeroReconciliation = {
  applied: boolean;
  countFrom: number | null;
  countTo: number | null;
  volumeFrom: number | null;
  volumeTo: number | null;
};

export function reconcileWeeklyHero(payload: WeeklyReportPayload | null | undefined): {
  payload: WeeklyReportPayload | null | undefined;
  reconciliation: HeroReconciliation;
} {
  const none: HeroReconciliation = {
    applied: false,
    countFrom: null,
    countTo: null,
    volumeFrom: null,
    volumeTo: null,
  };
  if (!payload) return { payload, reconciliation: none };

  const rows = payload.weekly_activity_leaderboard ?? [];
  if (rows.length === 0) return { payload, reconciliation: none };

  const tableCount = rows.reduce((acc, r) => acc + (num(r.wk_contracts) ?? 0), 0);
  const tableVolume = rows.reduce((acc, r) => acc + (num(r.wk_volume) ?? 0), 0);

  const hero = payload.hero ?? ({} as WeeklyReportPayload["hero"]);
  const heroCount = num(hero.luxury_count);
  const heroVolume = num(hero.luxury_volume);

  const liftCount = heroCount !== null && tableCount > heroCount;
  // Volume moves with the count so the two headline figures stay consistent.
  const liftVolume = liftCount && heroVolume !== null && tableVolume > heroVolume;
  if (!liftCount) return { payload, reconciliation: none };

  // Guard against a partial leaderboard reporting an implausible jump.
  if (rows.length >= LEADERBOARD_CAP && heroCount !== null && tableCount > heroCount * 2) {
    return { payload, reconciliation: none };
  }

  const nextHero = { ...hero, luxury_count: tableCount };
  nextHero.luxury_count_wow_pct = rescalePct(hero.luxury_count_wow_pct, heroCount!, tableCount);
  nextHero.luxury_count_vs_lastweek_pct = rescalePct(
    hero.luxury_count_vs_lastweek_pct,
    heroCount!,
    tableCount,
  );
  nextHero.luxury_count_yoy_pct = rescalePct(hero.luxury_count_yoy_pct, heroCount!, tableCount);

  if (liftVolume) {
    nextHero.luxury_volume = tableVolume;
    nextHero.luxury_volume_wow_pct = rescalePct(
      hero.luxury_volume_wow_pct,
      heroVolume!,
      tableVolume,
    );
    nextHero.luxury_volume_vs_lastweek_pct = rescalePct(
      hero.luxury_volume_vs_lastweek_pct,
      heroVolume!,
      tableVolume,
    );
    nextHero.luxury_volume_yoy_pct = rescalePct(
      hero.luxury_volume_yoy_pct,
      heroVolume!,
      tableVolume,
    );
  }

  // Keep the narrative in step with the corrected headline.
  const sowhat = payload.sowhat
    ? {
        ...payload.sowhat,
        pace_read: payload.sowhat.pace_read
          ? payload.sowhat.pace_read.replace(
              new RegExp(`\\(This week: ${heroCount}\\b`),
              `(This week: ${tableCount}`,
            )
          : payload.sowhat.pace_read,
        footnotes: {
          ...payload.sowhat.footnotes,
          count_reconciliation:
            "The headline luxury count is reconciled against the neighborhood activity table, so the two always agree. Contract figures use last asking price and the most recent week or two can revise upward.",
        },
      }
    : payload.sowhat;

  return {
    payload: { ...payload, hero: nextHero, sowhat },
    reconciliation: {
      applied: true,
      countFrom: heroCount,
      countTo: tableCount,
      volumeFrom: heroVolume,
      volumeTo: liftVolume ? tableVolume : heroVolume,
    },
  };
}

/** Convenience wrapper for read paths that only need the corrected payload. */
export function withReconciledHero<T extends { payload: WeeklyReportPayload }>(row: T): T {
  const { payload } = reconcileWeeklyHero(row.payload);
  return payload ? { ...row, payload } : row;
}
