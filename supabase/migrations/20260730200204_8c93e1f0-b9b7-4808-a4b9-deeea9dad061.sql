create table public.monthly_report (
  month_start date primary key,
  month_end date not null,
  generated_at timestamptz not null default now(),
  is_provisional boolean not null default true,
  payload jsonb not null
);

alter table public.monthly_report enable row level security;

grant select on public.monthly_report to anon;
grant select on public.monthly_report to authenticated;
grant select, insert, update, delete, truncate, references, trigger on public.monthly_report to service_role;