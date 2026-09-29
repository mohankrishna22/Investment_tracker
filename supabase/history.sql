-- Cloud version history. Run once in the Supabase SQL editor, after schema.sql.
--
-- Every time a device saves over the cloud copy, the version being replaced is
-- kept here first. Any device can then list past versions and restore one — so a
-- bad write (an out-of-date phone, a mistaken erase) is always recoverable, even
-- if every device has already taken the bad copy.
--
-- Same security model as schema.sql: the table is closed to the anon key, and the
-- only way in is two functions that require your sync id.

create table if not exists public.snapshot_history (
  history_id bigserial primary key,
  id text not null,
  data jsonb not null,
  -- When the replaced version had been saved, i.e. which point in time it shows.
  saved_at timestamptz not null
);

create index if not exists snapshot_history_by_id
  on public.snapshot_history (id, saved_at desc);

alter table public.snapshot_history enable row level security;
revoke all on public.snapshot_history from anon, authenticated;

-- Keeps the outgoing version whenever the data actually changes.
create or replace function public.keep_snapshot_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.snapshot_history (id, data, saved_at)
  values (old.id, old.data, old.updated_at);

  -- Keep the newest 200 versions per sync id; older ones go.
  delete from public.snapshot_history h
  where h.id = old.id
    and h.history_id not in (
      select history_id from public.snapshot_history
      where id = old.id
      order by saved_at desc
      limit 200
    );

  return new;
end;
$$;

drop trigger if exists snapshots_keep_history on public.snapshots;
create trigger snapshots_keep_history
  before update on public.snapshots
  for each row
  when (old.data is distinct from new.data)
  execute function public.keep_snapshot_history();

-- Lists versions newest first, with record counts so you can spot the good one.
create or replace function public.list_history(p_id text)
returns table (
  history_id bigint,
  saved_at timestamptz,
  ventures int,
  investments int,
  people int,
  loans int
)
language sql
security definer
set search_path = public
as $$
  select
    h.history_id,
    h.saved_at,
    coalesce(jsonb_array_length(h.data -> 'ventures'), 0),
    coalesce(jsonb_array_length(h.data -> 'investments'), 0),
    coalesce(jsonb_array_length(h.data -> 'people'), 0),
    coalesce(jsonb_array_length(h.data -> 'loans'), 0)
  from public.snapshot_history h
  where h.id = p_id
  order by h.saved_at desc
  limit 100;
$$;

-- Returns one past version in full.
create or replace function public.get_history(p_id text, p_history_id bigint)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select h.data from public.snapshot_history h
  where h.id = p_id and h.history_id = p_history_id;
$$;

grant execute on function public.list_history(text) to anon;
grant execute on function public.get_history(text, bigint) to anon;
