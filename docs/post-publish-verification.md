# Post-Publish Verification Checklist

Run this after every publish to https://domidata.heatherdomi.com (and the Lovable URL). Each item has a check, an expected result, and what to do if it fails.

Last verified: 2026-08-10

## 1. Database access controls

### 1.1 Row level security on quarterly_brief_publish_log

Check:

```sql
select relname, relrowsecurity,
       (select count(*) from pg_policies p
         where p.schemaname = 'public' and p.tablename = c.relname) as policy_count
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and relname = 'quarterly_brief_publish_log';
```

Expected: `relrowsecurity = t` and `policy_count = 0`. No policies is intentional. The table is server-side only, reachable with the service role and nothing else.

If it fails: re-enable with `alter table public.quarterly_brief_publish_log enable row level security;` in a migration, and confirm no anon or authenticated grants exist.

### 1.2 Function execute grants

Check:

```sql
select proname, array_to_string(proacl, ',') as acl
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and proname in ('has_role','grant_admin_for_allowlisted_email',
                  'tg_normalize_report_bed_labels','update_updated_at_column');
```

Expected:
- `has_role`: postgres, authenticated, service_role only. No anon, no PUBLIC (`=X/postgres`).
- The other three: postgres and service_role only.

If it fails: re-apply the revoke migration. Anonymous execute on `has_role` is the one that matters most, since admin visibility keys off it.

### 1.3 Publish gate

Check: run the security scan before publishing. Expected: no unresolved critical findings. Publishing is blocked otherwise.

## 2. Tier auto-detection on the latest payloads

Both The Week and The Month detect whether the feed sends tiers as **bands** (Luxury, Prime, Trophy mutually exclusive) or **nested** (Prime and Trophy inside Luxury) and reconcile the segment total accordingly. The feed does not yet send an explicit `tiers.model` field, so detection is inferred.

Check the shape:

```sql
select week_start,
       payload->'tiers'->>'model' as declared_model,
       jsonb_typeof(payload->'tiers') as tiers_type
from weekly_report order by week_start desc limit 4;

select month_start,
       payload->'tiers'->>'model' as declared_model
from monthly_report order by month_start desc limit 2;
```

Expected: `declared_model` is still null (inference in use). If it ever becomes non-null, confirm the page honours it instead of inferring.

Then in the browser, signed in as an admin:

1. Open `/this-week` and `/monthly`.
2. Confirm the segment total bar at the top of the Luxury Lines section shows Manhattan-wide luxury deal count and volume.
3. Confirm the internal reconciliation line reads "Checked" and not "Check flagged". If flagged, the tier numbers and the glance total disagree; capture the two figures and raise with the data side before treating it as a page bug.
4. Sign out (or open a private window) and confirm the reconciliation line is **not** visible. It is admin-only and must never appear publicly.

## 3. Trophy guard on The Week

The Week overrides the feed's `sowhat.trophy_read` prose whenever the feed claims no trophy contracts but the counts say otherwise.

Check the data:

```sql
select week_start,
       payload->'hero'->>'trophy_count' as trophy_count,
       left(payload->'sowhat'->>'trophy_read', 80) as feed_prose
from weekly_report order by week_start desc limit 4;
```

Expected states, and what the page must render:

| trophy_count | feed prose | Page must show |
| --- | --- | --- |
| 0 | "No trophy ..." | The feed sentence, unchanged |
| > 0 | "No trophy ..." | Rebuilt sentence: actual count and volume in millions, plus the typical-week comparison |
| > 0 | matching prose | The feed sentence, unchanged |

Known case: week of 2026-08-03 has `trophy_count = 2` with stale "No trophy" prose. The Trophy Read callout on `/this-week` must show 2 contracts and $59M, not "No trophy".

Also confirm volume renders in millions (for example $59M), not raw dollars. A figure like $59,000,000M or $0M means the scaling regressed.

## 4. Rendering spot checks

- `/this-week`: hero grid (Luxury, Prime, Trophy) populated, 52-week trailing detail panels expand and show median price, average price per square foot, days on market.
- `/monthly`: trailing 12-month detail panel intact, neighborhood leaderboards populated.
- Neighborhood reports: bedroom donuts ordered Studio through 4+ Beds with no overlapping labels, historical line charts present.
- No em dashes or double hyphens in any rendered copy.
- Legal disclosure footer present on every page.

## 5. Sign-off

Record date, publisher, and any item that failed with the follow-up taken.
