create table if not exists public.legacy_weekly_tracker (
  week_start date primary key,
  condo_contracts numeric,
  condo_volume numeric,
  coop_contracts numeric,
  coop_volume numeric,
  th_contracts numeric,
  th_volume numeric,
  total_contracts numeric,
  total_volume numeric,
  luxury_contracts numeric,
  luxury_volume numeric,
  luxury_volume_share numeric,
  bedroom jsonb,
  price_points jsonb,
  source text not null default 'Manhattan Contract Data Tracker (beginning 5/20/24)',
  created_at timestamptz not null default now()
);

grant select on public.legacy_weekly_tracker to authenticated;
grant all on public.legacy_weekly_tracker to service_role;

alter table public.legacy_weekly_tracker enable row level security;

create policy "Service role manages legacy tracker"
  on public.legacy_weekly_tracker for all
  to service_role using (true) with check (true);