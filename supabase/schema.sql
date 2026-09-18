-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query).
--
-- The tracker has no accounts, so the sync id is the only secret. That means the
-- anon key alone must not be enough to read anything: the table is locked down
-- with row-level security and no policies, and the only way in is through two
-- security-definer functions that require the exact id. Without the id, an
-- attacker holding the (publicly shipped) anon key can neither list nor read rows.

create table if not exists public.snapshots (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.snapshots enable row level security;

-- Deliberately no policies: direct REST access to the table is denied outright.
revoke all on public.snapshots from anon, authenticated;

create or replace function public.pull_snapshot(p_id text)
returns table (data jsonb, updated_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select s.data, s.updated_at from public.snapshots s where s.id = p_id;
$$;

create or replace function public.push_snapshot(p_id text, p_data jsonb)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  ts timestamptz;
begin
  -- Guard against someone with the anon key filling the table with junk rows.
  if p_id is null or length(p_id) < 24 then
    raise exception 'sync id too short';
  end if;
  if pg_column_size(p_data) > 4 * 1024 * 1024 then
    raise exception 'snapshot too large';
  end if;

  insert into public.snapshots (id, data, updated_at)
  values (p_id, p_data, now())
  on conflict (id) do update set data = excluded.data, updated_at = now()
  returning public.snapshots.updated_at into ts;

  return ts;
end;
$$;

grant execute on function public.pull_snapshot(text) to anon;
grant execute on function public.push_snapshot(text, jsonb) to anon;
