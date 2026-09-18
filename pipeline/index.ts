import { computeWeek } from './lib/week';
import { sendSlackMessage } from './io/slack';
import { upsertRunStatus } from './io/supabase';

/**
 * Phase 1 proof-of-life entrypoint.
 *
 * This does NOT pull any real market data and does NOT write to
 * weekly_report -- that starts in Phase 2 once a working Marketproof API key
 * is available. All this proves, end to end on Railway, is:
 *   1. the week-boundary math runs correctly in a real deployed environment,
 *   2. the service can authenticate to Supabase and write/read
 *      pipeline_run_status,
 *   3. the service can notify Slack.
 *
 * Uses agent_name = 'site-data-agent-v2' (not 'site-data-agent') so this
 * never collides with the existing AI-agent routine's own status rows while
 * both exist side by side during the rebuild.
 */

const AGENT_NAME = 'site-data-agent-v2';

async function main(): Promise<void> {
  console.log(`[${AGENT_NAME}] starting Phase 1 proof-of-life run`);

  const { weekStart, weekEnd } = computeWeek();
  console.log(`[${AGENT_NAME}] computed week: ${weekStart} to ${weekEnd} (America/New_York, Mon-Sun)`);

  console.log(`[${AGENT_NAME}] upserting pipeline_run_status -> running`);
  await upsertRunStatus(AGENT_NAME, weekStart, 'running');
  console.log(`[${AGENT_NAME}] pipeline_run_status upserted: running`);

  // Phase 1 has no real work to do between running/completed -- Phase 2/3
  // will pull Marketproof data and write weekly_report here instead.
  console.log(`[${AGENT_NAME}] no business logic in Phase 1 -- marking run completed`);
  await upsertRunStatus(AGENT_NAME, weekStart, 'completed', 'Phase 1 proof-of-life run, no data pulled');
  console.log(`[${AGENT_NAME}] pipeline_run_status upserted: completed`);

  const slackText = `:white_check_mark: ${AGENT_NAME}: Phase 1 proof-of-life run completed -- week of ${weekStart} to ${weekEnd}. No data pulled yet (infrastructure test only).`;
  console.log(`[${AGENT_NAME}] sending Slack notification`);
  const slackResult = await sendSlackMessage(slackText);

  if (slackResult.ok) {
    console.log(`[${AGENT_NAME}] Slack notification sent (status ${slackResult.status})`);
  } else {
    // Don't fail the whole run over a notification failure -- the
    // pipeline_run_status row is the source of truth; Slack is a
    // convenience. Log loudly so it's visible in the Railway deploy log.
    console.error(`[${AGENT_NAME}] Slack notification FAILED: ${slackResult.error}`);
  }

  console.log(`[${AGENT_NAME}] Phase 1 proof-of-life run finished cleanly`);
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error(`[${AGENT_NAME}] run failed with an unhandled error:`, err);
    process.exit(1);
  });
