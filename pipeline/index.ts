import { computeWeek } from './lib/week';
import { addDaysIso } from './compute/lib';
import { buildPriorWeekValues } from './lib/priorWeek';
import { sendSlackMessage } from './io/slack';
import { upsertRunStatus, getStoredWeeklyReportPayload, writeWeeklyReport } from './io/supabase';
import { fetchWeekPhase1, fetchWeekPhase2, fetchNeighborhoodWeeklyStats, fetchQuarterCutoffs } from './backfill/fetchWeek';
import { buildPayloadForWeek } from './backfill/buildPayload';
import { computeLeaderboards } from './compute/leaderboard';
import { planQuarterlyHistoryUpdate, applyQuarterlyHistoryUpdate, type QuarterlyHistory } from './compute/historyQuarterly';
import {
  runOutputContractChecks,
  checkTierCutoffMonotonicity,
  checkHeroLuxuryCountMatchesDemandTrend,
  checkLuxurySupplyWithinAllSupply,
  checkBedroomMixSumAgreesWithTotalContracts,
  type CheckResult,
} from './schema/checks';
import type { WeeklyReportPayload } from './schema/weeklyReportPayload';

/**
 * Live weekly pipeline entrypoint.
 *
 * Adapts the exact fetch -> compute -> assemble -> checks orchestration
 * order already proven correct in `backfill/run.ts`'s `computeForWeek` --
 * the difference here is a single current week (not a historical loop with
 * a stored-payload comparison), and a prior-week lookup from the REAL
 * `public.weekly_report` table instead of a loop variable.
 *
 * PROMOTED TO LIVE 2026-09-20: this now writes directly to the real
 * `public.weekly_report` table (the one the deployed site actually reads),
 * not `weekly_report_shadow`. Promoted after shadow-mode verification
 * (backfill against 9 real historical weeks, a live shadow run, and the
 * companion `top-deals-weekly-agent` routine closing the Top Deals /
 * weekly_activity_leaderboard gap) at the owner's explicit direction.
 *
 * Uses agent_name = 'site-data-agent-v2' (not 'site-data-agent') so this
 * never collides with the existing AI-agent routine's own status rows while
 * both exist side by side during the rebuild.
 */

const AGENT_NAME = 'site-data-agent-v2';

/** The 14 top-level keys of WeeklyReportPayload, in schema order -- used for the Slack "which sections came back with real data" summary. */
const PAYLOAD_SECTION_KEYS = [
  'hero',
  'demand_trend',
  'tiers',
  'market_pulse',
  'bedroom_mix',
  'leaderboard',
  'concentrated_leaderboard',
  'weekly_activity_leaderboard',
  'supply',
  'type_trends',
  'top_deals',
  'sowhat',
  'tier_series',
  'tier_series_methodology_note',
] as const;

interface SectionSummary {
  key: string;
  status: string;
  isEmptyish: boolean;
}

/** True if `value` contains at least one non-null/undefined primitive anywhere in its (possibly nested) structure. Used as a coarse "did this section come back with real data" heuristic -- good enough for a human-facing Slack summary, not a correctness check (schema/checks.ts already owns those). */
function hasAnyNonNullValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.some(hasAnyNonNullValue);
  if (typeof value === 'object') return Object.values(value as Record<string, unknown>).some(hasAnyNonNullValue);
  return true;
}

function summarizeSections(payload: WeeklyReportPayload): SectionSummary[] {
  return PAYLOAD_SECTION_KEYS.map((key) => {
    const value = (payload as unknown as Record<string, unknown>)[key];

    if (Array.isArray(value)) {
      return value.length > 0
        ? { key, status: `${value.length} row(s)`, isEmptyish: false }
        : { key, status: 'empty ([])', isEmptyish: true };
    }
    if (value === null) {
      return { key, status: 'null', isEmptyish: true };
    }
    const hasData = hasAnyNonNullValue(value);
    return { key, status: hasData ? 'has data' : 'all null', isEmptyish: !hasData };
  });
}

interface CurrentWeekResult {
  payload: WeeklyReportPayload;
  checks: CheckResult[];
  priorWeekStart: string;
  priorWeekFound: boolean;
}

/** Fetch -> compute -> assemble -> STEP 7 checks, for the current (just-ended) week. Same order as backfill/run.ts's computeForWeek. */
async function computeCurrentWeek(weekStart: string, weekEnd: string): Promise<CurrentWeekResult> {
  const priorWeekStart = addDaysIso(weekStart, -7);
  console.log(`[${AGENT_NAME}] looking up prior week (${priorWeekStart}) from public.weekly_report ...`);
  const prevPayload = await getStoredWeeklyReportPayload(priorWeekStart);
  const priorWeekFound = prevPayload !== null;
  if (priorWeekFound) {
    console.log(`[${AGENT_NAME}] found a stored row for ${priorWeekStart} -- using its real values as this week's prior-week inputs`);
  } else {
    console.log(
      `[${AGENT_NAME}] no stored row for ${priorWeekStart} -- proceeding with EMPTY_PRIOR_WEEK (expected: public.weekly_report has not been updated since 2026-08-31). Every WoW/streak/rank_delta field this feeds will be null, not fabricated.`,
    );
  }
  const prior = buildPriorWeekValues(prevPayload);

  console.log(`[${AGENT_NAME}] fetching Marketproof data (phase 1, independent calls) ...`);
  const phase1 = await fetchWeekPhase1(weekStart, weekEnd);

  const cutoffs = {
    luxury: phase1.lux52?.lines.p90.cutoff ?? null,
    prime: phase1.lux52?.lines.p95.cutoff ?? null,
    trophy: phase1.lux52?.lines.p99.cutoff ?? null,
  };

  console.log(`[${AGENT_NAME}] fetching Marketproof data (phase 2, cutoff-anchored) ...`);
  const phase2 = await fetchWeekPhase2(weekEnd, cutoffs);

  // Determine the top-10-by-volume / top-10-by-intensity(>=11) name sets
  // directly from phase1's hoodRankNoMinPrice (no anchored data or weekly
  // stats needed for the NAME selection itself -- see STEP 4/4b).
  const preliminary = computeLeaderboards({
    hoodRankNoMinPrice: phase1.hoodRankNoMinPrice,
    hoodRankMinPriceAnchored: null,
    hoodRankHistorical: null,
    weeklyStats: new Map(),
  });
  const names = [...new Set([...preliminary.leaderboard.map((r) => r.name), ...preliminary.concentrated_leaderboard.map((r) => r.name)])];
  console.log(`[${AGENT_NAME}] fetching per-neighborhood weekly stats for ${names.length} leaderboard neighborhood(s) ...`);
  const neighborhoodWeeklyStats = await fetchNeighborhoodWeeklyStats(names, cutoffs.luxury, weekStart, weekEnd);

  // STEP 1.7: quarterly history, conditional fetch.
  const plan = planQuarterlyHistoryUpdate(prior.prevQuarterlyHistory, weekEnd);
  const newQuarterCutoffs = plan.needsFetchForQuarter
    ? await fetchQuarterCutoffs(plan.needsFetchForQuarter.label, plan.needsFetchForQuarter.endDateForFetch)
    : null;
  const historyQuarterly: QuarterlyHistory = applyQuarterlyHistoryUpdate(plan, newQuarterCutoffs, cutoffs);

  console.log(`[${AGENT_NAME}] assembling payload (includes the STEP 6 top_deals call -- confirmed blocked on MCP OAuth, expect []) ...`);
  const payload = await buildPayloadForWeek({
    weekStart,
    weekEnd,
    phase1,
    phase2,
    prior,
    neighborhoodWeeklyStats,
    historyQuarterly,
    callTopDeals: true,
  });

  // STEP 7's own output-contract checks, plus STEP 7.5's structural
  // consistency checks -- run together here for one complete picture,
  // same set backfill/run.ts uses per week.
  const checks: CheckResult[] = [
    ...runOutputContractChecks(payload),
    checkTierCutoffMonotonicity({
      luxury: payload.tiers.luxury.cutoff,
      prime: payload.tiers.prime.cutoff,
      trophy: payload.tiers.trophy.cutoff,
    }),
    checkHeroLuxuryCountMatchesDemandTrend(payload.hero.luxury_count, payload.demand_trend.counts),
    checkLuxurySupplyWithinAllSupply(payload.supply.luxury.active, payload.supply.all.active),
    checkBedroomMixSumAgreesWithTotalContracts(payload.bedroom_mix.count, payload.market_pulse.all.contracts),
  ];

  return { payload, checks, priorWeekStart, priorWeekFound };
}

function buildSlackSummary(args: {
  weekStart: string;
  weekEnd: string;
  sections: SectionSummary[];
  checks: CheckResult[];
  priorWeekStart: string;
  priorWeekFound: boolean;
}): string {
  const { weekStart, weekEnd, sections, checks, priorWeekStart, priorWeekFound } = args;
  const failedChecks = checks.filter((c) => !c.ok);
  const passedCount = checks.length - failedChecks.length;

  const sectionLines = sections
    .map((s) => `${s.isEmptyish ? ':warning:' : ':white_check_mark:'} ${s.key}: ${s.status}`)
    .join('\n');

  const checksLine =
    failedChecks.length === 0
      ? `:white_check_mark: all ${checks.length} STEP 7/7.5 checks passed`
      : `:warning: ${passedCount}/${checks.length} checks passed -- FAILED: ${failedChecks.map((c) => c.code).join(', ')}`;

  const priorWeekLine = priorWeekFound
    ? `Prior week (${priorWeekStart}): found in public.weekly_report, used as real WoW/streak inputs.`
    : `Prior week (${priorWeekStart}): NOT found in public.weekly_report (expected -- not updated since 2026-08-31). All WoW/streak/rank_delta fields fed by it are null this run, not fabricated.`;

  return [
    `:white_check_mark: ${AGENT_NAME}: LIVE run completed -- week of ${weekStart} to ${weekEnd}`,
    checksLine,
    priorWeekLine,
    '',
    'Payload sections:',
    sectionLines,
    '',
    `Written to public.weekly_report WHERE week_start = '${weekStart}' -- this is now the real, live table the site reads.`,
  ].join('\n');
}

async function main(weekStart: string, weekEnd: string): Promise<void> {
  console.log(`[${AGENT_NAME}] starting live weekly pipeline run`);
  console.log(`[${AGENT_NAME}] computed week: ${weekStart} to ${weekEnd} (America/New_York, Mon-Sun)`);

  console.log(`[${AGENT_NAME}] upserting pipeline_run_status -> running`);
  await upsertRunStatus(AGENT_NAME, weekStart, 'running');

  const { payload, checks, priorWeekStart, priorWeekFound } = await computeCurrentWeek(weekStart, weekEnd);

  const failedChecks = checks.filter((c) => !c.ok);
  console.log(`[${AGENT_NAME}] STEP 7/7.5 checks: ${checks.length - failedChecks.length}/${checks.length} passed`);
  for (const c of checks) {
    console.log(`  [${c.ok ? 'OK' : 'FAILED'}] ${c.code}${c.detail ? ` -- ${c.detail}` : ''}`);
  }
  // Failed checks are logged loudly above but are NOT treated as fatal here --
  // per the spec's own severity distinction, these are structural/plausibility
  // checks meant to inform a human reviewer of a *shadow* run, not hard gates
  // that should abort a run before it ever gets written for inspection.

  const sections = summarizeSections(payload);
  console.log(`[${AGENT_NAME}] payload section summary:`);
  for (const s of sections) console.log(`  ${s.key}: ${s.status}`);

  console.log(`[${AGENT_NAME}] writing payload to public.weekly_report (LIVE table, is_provisional=true) ...`);
  const writeResult = await writeWeeklyReport(weekStart, weekEnd, payload, true);
  if (!writeResult.confirmed) {
    throw new Error(
      `writeWeeklyReport did not confirm a fresh write for week_start=${weekStart} (generated_at=${writeResult.generatedAt})`,
    );
  }
  console.log(
    `[${AGENT_NAME}] weekly_report write confirmed: week_start=${weekStart} generated_at=${writeResult.generatedAt}`,
  );

  const statusDetail = `week ${weekStart}..${weekEnd}, LIVE write to weekly_report, ${checks.length - failedChecks.length}/${checks.length} checks passed, prior_week_found=${priorWeekFound}`;
  await upsertRunStatus(AGENT_NAME, weekStart, 'completed', statusDetail);
  console.log(`[${AGENT_NAME}] pipeline_run_status upserted: completed`);

  const slackText = buildSlackSummary({
    weekStart,
    weekEnd,
    sections,
    checks,
    priorWeekStart,
    priorWeekFound,
  });
  console.log(`[${AGENT_NAME}] sending Slack notification`);
  const slackResult = await sendSlackMessage(slackText);

  if (slackResult.ok) {
    console.log(`[${AGENT_NAME}] Slack notification sent (status ${slackResult.status})`);
  } else {
    // Don't fail the whole run over a notification failure -- the
    // pipeline_run_status row and the shadow write are the sources of
    // truth; Slack is a convenience. Log loudly so it's visible in the
    // Railway deploy log.
    console.error(`[${AGENT_NAME}] Slack notification FAILED: ${slackResult.error}`);
  }

  console.log(`[${AGENT_NAME}] run finished cleanly`);
}

const { weekStart, weekEnd } = computeWeek();

main(weekStart, weekEnd)
  .then(() => {
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(`[${AGENT_NAME}] run failed with an unhandled error:`, err);
    try {
      await upsertRunStatus(AGENT_NAME, weekStart, 'failed', err instanceof Error ? err.message : String(err));
    } catch (statusErr) {
      console.error(`[${AGENT_NAME}] additionally failed to record a 'failed' pipeline_run_status row:`, statusErr);
    }
    process.exit(1);
  });
