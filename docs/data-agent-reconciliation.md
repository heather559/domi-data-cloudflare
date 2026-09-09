# Data agent handoff: weekly signed-contract reconciliation

For the upstream agents that write `public.weekly_report` (`domi-data-tracker`,
`monday-report-agent`, and any Claude agent producing the weekly payload).

## What changed

The site now checks every weekly payload for internal consistency and records
mismatches. Two views of the same contract set must agree:

- `payload.hero.luxury_count` / `payload.hero.luxury_volume` (borough rollup)
- the sum of `payload.weekly_activity_leaderboard[].wk_contracts` / `.wk_volume`

A check runs hourly and writes to `public.weekly_reconciliation_flags`.

The site does not display the mismatch: at render, when the leaderboard sums
higher than the hero, the hero is lifted to match and the dependent percentages
are rescaled. So a flag is a data-quality task, never a live visual bug. Nothing
is on fire while you work the queue.

## Reading the queue

    GET https://domidata.heatherdomi.com/api/public/reconciliation-flags
    Header: x-data-agent-token: <data agent token>

Optional: `?status=all`, `?status=resolved`, `?week=YYYY-MM-DD`.
Read-only. Returns 401 without the token.

The data agent token is scoped to reconciliation only: this endpoint and the
rerun callback below. It does not grant access to workbook exports, archive
resnapshots, or any other job endpoint. Ask Heather for the value; do not reuse
the shared export secret.

Each flag includes:

| Field | Meaning |
| --- | --- |
| `week_start` | The week to correct |
| `check` | `signed_contracts_hero_vs_leaderboard` or `signed_volume_hero_vs_leaderboard` |
| `hero_value` | What the payload published |
| `leaderboard_value` | What the neighborhood table sums to |
| `delta` | leaderboard minus hero |
| `luxury_cutoff` | That week's Top 10% price line, for re-testing membership |
| `contributors` | Per-neighborhood contracts and volume from the table |
| `fix` | Which payload keys to recompute |

## The fix

1. Recompute the hero aggregate from the contract-level source for that week.
2. Include every contract at or above `luxury_cutoff`, **regardless of
   neighborhood**. The known failure mode is a neighborhood filter or a stale
   cutoff dropping a qualifying contract from the borough rollup.
3. Rewrite `payload.hero.luxury_count` and `payload.hero.luxury_volume`, plus
   the percentages derived from them: `luxury_count_wow_pct`,
   `luxury_count_vs_lastweek_pct`, `luxury_count_yoy_pct`, and the three
   matching `luxury_volume_*` fields.
4. Leave `weekly_activity_leaderboard` alone. It is the contract-level view and
   is treated as correct.
5. Check `payload.sowhat.pace_read`, which quotes the count in prose
   ("This week: 14"). It must match the corrected figure.

## Confirming the fix

    POST https://domidata.heatherdomi.com/api/public/weekly-reconciliation
    Header: x-data-agent-token: <data agent token>

Flags auto-resolve once the two figures agree. The hourly cron does the same
check, so a fix is confirmed within the hour even without the callback.

## Rules the checker applies

- Count must match exactly.
- Volume tolerance is 0.5 percent.
- A leaderboard total **below** the hero is ignored when the table is at its
  ten-row cap, since that is expected truncation. A total **above** the hero is
  always a genuine mismatch.

## Currently open

- **2026-07-27**, count: hero 14 vs table 15. The gap is East Village's single
  $5.5M contract, which cleared the $4,863,281 cutoff but is missing from the
  borough rollup.
- **2026-07-27**, volume: $100,919,000 vs $106,419,000. Same contract.
- **2026-07-20**, volume: hero $109,809,000 vs table $93,184,000 across only 8
  rows. Opposite direction, and with 8 rows the truncation explanation does not
  apply. Either two luxury neighborhoods are missing from that leaderboard or
  the hero volume is overstated. Needs a look before it is corrected.
