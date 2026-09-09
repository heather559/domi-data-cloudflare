// Reconciliation job: verifies that the hero block of a weekly report agrees
// with the neighborhood activity leaderboard on the same underlying week.
//
// The hero counts borough-wide luxury signed contracts and dollar volume. The
// activity leaderboard lists the same contracts grouped by neighborhood, so the
// two must sum to the same totals. When they diverge, the upstream payload is
// the source of the problem, not the page, so the mismatch is recorded in
// public.weekly_reconciliation_flags for review rather than patched at render.

export type ReconcileSeverity = "info" | "warning" | "critical";

export interface ReconcileFinding {
  weekStart: string;
  checkName: string;
  heroValue: number | null;
  tableValue: number | null;
  delta: number | null;
  severity: ReconcileSeverity;
  detail: Record<string, unknown>;
}

export interface ReconcileResult {
  weeksChecked: number;
  findings: ReconcileFinding[];
  cleared: number;
}

// Dollar volume carries rounding through the pipeline, so only a material gap
// is flagged. Contract counts are integers and must match exactly.
const VOLUME_TOLERANCE_PCT = 0.5;

// The upstream weekly payload publishes at most ten leaderboard neighborhoods.
const LEADERBOARD_CAP = 10;

interface HeroBlock {
  luxury_count?: number | null;
  luxury_volume?: number | null;
}

interface ActivityRow {
  name?: string | null;
  wk_contracts?: number | null;
  wk_volume?: number | null;
}

interface WeeklyRow {
  week_start: string;
  payload: {
    hero?: HeroBlock;
    weekly_activity_leaderboard?: ActivityRow[] | null;
  } | null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function sum(rows: ActivityRow[], key: "wk_contracts" | "wk_volume"): number {
  return rows.reduce((total, row) => total + (num(row[key]) ?? 0), 0);
}

/** Pure check over a single weekly payload. Returns zero or more findings. */
export function reconcileWeek(row: WeeklyRow): ReconcileFinding[] {
  const findings: ReconcileFinding[] = [];
  const hero = row.payload?.hero ?? {};
  const rows = row.payload?.weekly_activity_leaderboard ?? [];
  if (rows.length === 0) return findings;

  // The upstream leaderboard is capped at ten neighborhoods. When it is full,
  // a table total BELOW the hero is expected truncation, not a contradiction.
  // A table total ABOVE the hero is always a genuine mismatch.
  const truncated = rows.length >= LEADERBOARD_CAP;

  const contributors = rows.map((r) => ({
    name: r.name ?? "unknown",
    contracts: num(r.wk_contracts) ?? 0,
    volume: num(r.wk_volume) ?? 0,
  }));

  const heroCount = num(hero.luxury_count);
  const tableCount = sum(rows, "wk_contracts");
  const countDiff = heroCount === null ? 0 : tableCount - heroCount;
  if (heroCount !== null && countDiff !== 0 && !(truncated && countDiff < 0)) {
    findings.push({
      weekStart: row.week_start,
      checkName: "signed_contracts_hero_vs_leaderboard",
      heroValue: heroCount,
      tableValue: tableCount,
      delta: countDiff,
      severity: "critical",
      detail: {
        note: "Hero luxury contract count does not equal the sum of the activity leaderboard.",
        leaderboardRows: rows.length,
        contributors,
      },
    });
  }

  const heroVolume = num(hero.luxury_volume);
  const tableVolume = sum(rows, "wk_volume");
  if (heroVolume !== null && heroVolume > 0) {
    const diff = tableVolume - heroVolume;
    const pct = Math.abs(diff / heroVolume) * 100;
    if (pct > VOLUME_TOLERANCE_PCT && !(truncated && diff < 0)) {
      findings.push({
        weekStart: row.week_start,
        checkName: "signed_volume_hero_vs_leaderboard",
        heroValue: heroVolume,
        tableValue: tableVolume,
        delta: diff,
        severity: pct > 5 ? "critical" : "warning",
        detail: {
          note: "Hero luxury dollar volume does not equal the sum of the activity leaderboard.",
          pctDifference: Math.round(pct * 100) / 100,
          tolerancePct: VOLUME_TOLERANCE_PCT,
          leaderboardRows: rows.length,
          contributors,
        },
      });
    }
  }


  return findings;
}

/**
 * Runs the reconciliation across the most recent `weeks` weekly reports,
 * upserting any mismatch and closing flags whose week now reconciles.
 */
export async function runWeeklyReconciliation(weeks = 8): Promise<ReconcileResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const client = supabaseAdmin as unknown as {
    from: (table: string) => any;
  };

  const { data, error } = await client
    .from("weekly_report")
    .select("week_start, payload")
    .order("week_start", { ascending: false })
    .limit(Math.max(1, Math.min(weeks, 52)));

  if (error) throw new Error(`weekly_report load failed: ${JSON.stringify(error)}`);
  const rows = (data ?? []) as WeeklyRow[];

  const findings: ReconcileFinding[] = [];
  for (const row of rows) findings.push(...reconcileWeek(row));

  if (findings.length > 0) {
    const { error: upsertError } = await client
      .from("weekly_reconciliation_flags")
      .upsert(
        findings.map((f) => ({
          week_start: f.weekStart,
          check_name: f.checkName,
          hero_value: f.heroValue,
          table_value: f.tableValue,
          delta: f.delta,
          severity: f.severity,
          detail: f.detail,
          status: "open",
          resolved_at: null,
        })),
        { onConflict: "week_start,check_name" },
      );
    if (upsertError) throw new Error(`flag upsert failed: ${JSON.stringify(upsertError)}`);
  }

  // Any previously open flag for a week that now reconciles is auto-resolved,
  // so the review list only ever shows live problems.
  let cleared = 0;
  const checkedWeeks = rows.map((r) => r.week_start);
  for (const week of checkedWeeks) {
    const stillOpen = findings.filter((f) => f.weekStart === week).map((f) => f.checkName);
    let query = client
      .from("weekly_reconciliation_flags")
      .update({ status: "resolved", resolved_at: new Date().toISOString() })
      .eq("week_start", week)
      .eq("status", "open");
    if (stillOpen.length > 0) {
      query = query.not("check_name", "in", `(${stillOpen.join(",")})`);
    }
    const { data: updated } = await query.select("id");
    cleared += (updated as unknown[] | null)?.length ?? 0;
  }

  return { weeksChecked: rows.length, findings, cleared };
}
