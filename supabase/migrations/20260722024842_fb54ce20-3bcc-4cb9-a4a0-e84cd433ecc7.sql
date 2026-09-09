-- 1. Server-owned conversation sessions
create table public.agent_sessions (
  client_session_id uuid primary key,
  ip text,
  turn_count int not null default 0,
  closed boolean not null default false,
  history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);
alter table public.agent_sessions enable row level security;

-- 2. Generic atomic rate-limit counter
create table public.agent_rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  count int not null default 0
);
alter table public.agent_rate_limits enable row level security;

create or replace function public.agent_rate_limit_hit(p_key text, p_window_seconds int, p_limit int)
returns table(allowed boolean, current_count int)
language plpgsql
as $$
declare
  v_count int;
begin
  insert into public.agent_rate_limits as t (key, window_start, count)
  values (p_key, now(), 1)
  on conflict (key) do update set
    count = case
      when t.window_start <= now() - (p_window_seconds || ' seconds')::interval
      then 1 else t.count + 1 end,
    window_start = case
      when t.window_start <= now() - (p_window_seconds || ' seconds')::interval
      then now() else t.window_start end
  returning t.count into v_count;

  return query select (v_count <= p_limit), v_count;
end;
$$;

revoke execute on function public.agent_rate_limit_hit(text,int,int) from public, anon, authenticated;
grant execute on function public.agent_rate_limit_hit(text,int,int) to service_role;

-- 3. Global daily token/spend ceiling
create table public.agent_usage_daily (
  day date primary key,
  total_tokens bigint not null default 0,
  total_requests bigint not null default 0
);
alter table public.agent_usage_daily enable row level security;

create or replace function public.agent_usage_increment(p_day date, p_tokens bigint)
returns void
language plpgsql
as $$
begin
  insert into public.agent_usage_daily as t (day, total_tokens, total_requests)
  values (p_day, p_tokens, 1)
  on conflict (day) do update set
    total_tokens = t.total_tokens + excluded.total_tokens,
    total_requests = t.total_requests + 1;
end;
$$;

revoke execute on function public.agent_usage_increment(date,bigint) from public, anon, authenticated;
grant execute on function public.agent_usage_increment(date,bigint) to service_role;

-- 4. Enumeration detection log
create table public.agent_enumeration_log (
  ip text not null,
  kind text not null,
  key text not null,
  day date not null,
  first_seen_at timestamptz not null default now(),
  primary key (ip, kind, key, day)
);
alter table public.agent_enumeration_log enable row level security;