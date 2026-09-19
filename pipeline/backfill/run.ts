/**
 * Backfill validation harness -- the actual point of this task.
 *
 * For each of the real historical weeks already stored in
 * `public.weekly_report` (chronological order, since STEP 0's own
 * statefulness rule means each week's computation needs the PRIOR week's
 * real values as inputs):
 *   1. Fetches real Marketproof data for that historical week/window
 *      (backfill/fetchWeek.ts, anchored via `end_date`).
 *   2. Runs it through compute/ (backfill/buildPayload.ts) to get a
 *      computed payload.
 *   3. Compares the computed payload field-by-field against the REAL
 *      stored payload for that same week (backfill/compare.ts).
 *   4. Reports exact / close / mismatch per field, plus the STEP 7
 *      output-contract checks against the computed payload.
 *
 * Uses the PRIOR week's REAL STORED payload (not last iteration's own
 * computed result) as the "prior week" input for each week's computation --
 * a deliberate choice so one week's drift can never compound into the
 * next week's comparison, keeping each week's diff attributable to that
 * week's own compute logic. Documented as a judgment call in the task's
 * final report.
 *
 * Does NOT write to `public.weekly_report`. Writes its results (computed
 * payload + diff summary per week) to backfill/results/*.json for
 * inspection, and prints a summary to the console -- per the task's own
 * "your call" on where to park output for review.
 */

import { getSupabaseClient } from '../io/supabase';
import { fetchWeekPhase1, fetchWeekPhase2, fetchNeighborhoodWeeklyStats, fetchQuarterCutoffs } from './fetchWeek';
import { buildPayloadForWeek } from './buildPayload';
import { computeLeaderboards } from '../compute/leaderboard';
import { planQuarterlyHistoryUpdate, applyQuarterlyHistoryUpdate, type QuarterlyHistory } from '../compute/historyQuarterly';
import { comparePayloads, summarizeDiffs } from './compare';
import {
  runOutputContractChecks,
  checkTierCutoffMonotonicity,
  checkHeroLuxuryCountMatchesDemandTrend,
  checkLuxurySupplyWithinAllSupply,
  checkBedroomMixSumAgreesWithTotalContracts,
  type CheckResult,
} from '../schema/checks';
import type { PriorWeekValues } from '../compute/types';
import { EMPTY_PRIOR_WEEK } from '../compute/types';
import type { WeeklyReportPayload, TierCard } from '../schema/weeklyReportPayload';
import * as fs from 'node:fs';
import * as path from 'node:path';

interface StoredWeekRow {
  week_start: string;
  week_end: string;
  payload: WeeklyReportPayload;
}

async function fetchStoredWeeks(): Promise<StoredWeekRow[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('weekly_report')
    .select('week_start, week_end, payload')
    .order('week_start', { ascending: true });

  if (error) throw new Error(`Failed to read weekly_report: ${error.message}`);
  return (data ?? []) as StoredWeekRow[];
}

/** Builds this week's PriorWeekValues from the PREVIOUS week's real stored payload (or EMPTY_PRIOR_WEEK if there is none). */
function priorFromStoredPayload(prevPayload: WeeklyReportPayload | null): PriorWeekValues {
  if (!prevPayload) return EMPTY_PRIOR_WEEK;

  const pickTierCard = (t: TierCard): TierCard => t;

  return {
    prevSupplyBandLabel: prevPayload.sowhat.supply_band_label,
    prevStreakWeeks: prevPayload.sowhat.streak_weeks,
    prevLuxuryCount: prevPayload.hero.luxury_count,
    prevLuxuryVolume: prevPayload.hero.luxury_volume,
    prevQuarterlyHistory: prevPayload.tiers.history_quarterly,
    prevTiers: {
      luxury: pickTierCard(prevPayload.tiers.luxury),
      prime: pickTierCard(prevPayload.tiers.prime),
      trophy: pickTierCard(prevPayload.tiers.trophy),
    },
    prevPulseAll: {
      contracts: prevPayload.market_pulse.all.contracts,
      volume: prevPayload.market_pulse.all.volume,
    },
  };
}

async function computeForWeek(
  weekStart: string,
  weekEnd: string,
  prior: PriorWeekValues,
): Promise<{ payload: WeeklyReportPayload; checks: CheckResult[] }> {
  const phase1 = await fetchWeekPhase1(weekStart, weekEnd);

  const cutoffs = {
    luxury: phase1.lux52?.lines.p90.cutoff ?? null,
    prime: phase1.lux52?.lines.p95.cutoff ?? null,
    trophy: phase1.lux52?.lines.p99.cutoff ?? null,
  };

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
  const neighborhoodWeeklyStats = await fetchNeighborhoodWeeklyStats(names, cutoffs.luxury, weekStart, weekEnd);

  // STEP 1.7: quarterly history, conditional fetch.
  const plan = planQuarterlyHistoryUpdate(prior.prevQuarterlyHistory, weekEnd);
  const newQuarterCutoffs = plan.needsFetchForQuarter
    ? await fetchQuarterCutoffs(plan.needsFetchForQuarter.label, plan.needsFetchForQuarter.endDateForFetch)
    : null;
  const historyQuarterly: QuarterlyHistory = applyQuarterlyHistoryUpdate(plan, newQuarterCutoffs, cutoffs);

  const payload = await buildPayloadForWeek({
    weekStart,
    weekEnd,
    phase1,
    phase2,
    prior,
    neighborhoodWeeklyStats,
    historyQuarterly,
    // top_deals costs a real Anthropic + Marketproof-MCP call and is
    // confirmed blocked on a missing MCP OAuth credential (same as
    // weekly_activity_leaderboard) -- called anyway per the task brief so
    // the plumbing is exercised, but never treated as a failure if it
    // comes back [].
    callTopDeals: true,
  });

  // STEP 7's own output-contract checks, plus STEP 7.5's structural
  // consistency checks (pre-existing, ported before this task) -- run
  // together here for one complete picture per week.
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
  return { payload, checks };
}

async function main(): Promise<void> {
  console.log('[backfill] reading stored historical weeks from public.weekly_report ...');
  const storedWeeks = await fetchStoredWeeks();
  console.log(`[backfill] found ${storedWeeks.length} stored weeks: ${storedWeeks.map((w) => w.week_start).join(', ')}`);

  const resultsDir = path.join(__dirname, 'results');
  fs.mkdirSync(resultsDir, { recursive: true });

  let prior: PriorWeekValues = EMPTY_PRIOR_WEEK;
  const overallSummary: Array<{ week_start: string; exact: number; close: number; mismatch: number; missing: number; checksFailed: number }> = [];

  for (const stored of storedWeeks) {
    console.log(`\n[backfill] === week ${stored.week_start} ===`);
    try {
      const { payload: computed, checks } = await computeForWeek(stored.week_start, stored.week_end, prior);

      const diffs = comparePayloads(computed, stored.payload);
      const summary = summarizeDiffs(diffs);

      const failedChecks = checks.filter((c) => !c.ok);

      console.log(
        `[backfill] ${stored.week_start}: ${summary.exact} exact, ${summary.close} close, ${summary.mismatch} mismatch, ${summary.missing} missing, ${summary.typeMismatch} type-mismatch (of ${summary.total} leaf fields) -- ${failedChecks.length} output-contract check(s) failed`,
      );
      if (failedChecks.length > 0) {
        for (const c of failedChecks) console.log(`  [check FAILED] ${c.code}: ${c.detail ?? ''}`);
      }
      if (summary.mismatches.length > 0) {
        console.log('  top mismatches:');
        for (const m of summary.mismatches.slice(0, 20)) {
          console.log(`    ${m.path}: computed=${JSON.stringify(m.computed)} stored=${JSON.stringify(m.stored)} (${m.status}${m.detail ? `, ${m.detail}` : ''})`);
        }
      }

      fs.writeFileSync(
        path.join(resultsDir, `${stored.week_start}.json`),
        JSON.stringify({ week_start: stored.week_start, computed, stored: stored.payload, diffs, checks }, null, 2),
      );

      overallSummary.push({
        week_start: stored.week_start,
        exact: summary.exact,
        close: summary.close,
        mismatch: summary.mismatch,
        missing: summary.missing,
        checksFailed: failedChecks.length,
      });

      // Next iteration's "prior" is THIS WEEK'S REAL STORED payload, not our
      // own computed result -- isolates each week's comparison from
      // compounding drift (see module header).
      prior = priorFromStoredPayload(stored.payload);
    } catch (err) {
      console.error(`[backfill] ${stored.week_start}: FAILED with an error -- ${err instanceof Error ? err.stack : String(err)}`);
      overallSummary.push({ week_start: stored.week_start, exact: 0, close: 0, mismatch: 0, missing: 0, checksFailed: -1 });
      // Even on a hard failure, carry forward the real stored payload as
      // next week's prior -- one week's fetch/compute failure shouldn't
      // also corrupt the next week's inputs.
      prior = priorFromStoredPayload(stored.payload);
    }
  }

  console.log('\n[backfill] ==================== SUMMARY ====================');
  console.table(overallSummary);
  fs.writeFileSync(path.join(resultsDir, '_summary.json'), JSON.stringify(overallSummary, null, 2));
  console.log(`[backfill] full per-week results written to ${resultsDir}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[backfill] run failed with an unhandled error:', err);
    process.exit(1);
  });
