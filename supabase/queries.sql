-- Handy read-only queries for poking at your data in the Supabase SQL editor.
-- The app stores one row per sync id, with the whole portfolio as a single JSON
-- document, so the Table Editor shows you one row rather than a table per entity.
-- These unpack that document into something readable.

-- 1. What rows exist, how big they are, and when they last changed.
select
  id as sync_id,
  updated_at,
  pg_size_pretty(pg_column_size(data)::bigint) as size,
  jsonb_array_length(data -> 'ventures') as ventures,
  jsonb_array_length(data -> 'investments') as investments,
  jsonb_array_length(data -> 'payouts') as payouts
from public.snapshots
order by updated_at desc;

-- 2. Your investment types.
select
  v ->> 'name' as name,
  v ->> 'category' as category,
  v ->> 'status' as status,
  (v ->> 'startDate')::date as started,
  (v ->> 'currentValue')::numeric as current_value
from public.snapshots s, jsonb_array_elements(s.data -> 'ventures') v
order by name;

-- 3. Every investment entry, with the venture it belongs to.
select
  v ->> 'name' as venture,
  (i ->> 'date')::date as date,
  i ->> 'item' as item,
  i ->> 'category' as category,
  (i ->> 'amount')::numeric as amount
from public.snapshots s
cross join jsonb_array_elements(s.data -> 'investments') i
join lateral (
  select v from jsonb_array_elements(s.data -> 'ventures') v
  where v ->> 'id' = i ->> 'ventureId'
) ventures on true
order by date desc;

-- 4. Every return received.
select
  v ->> 'name' as venture,
  (p ->> 'date')::date as date,
  p ->> 'kind' as kind,
  (p ->> 'amount')::numeric as amount,
  p ->> 'notes' as notes
from public.snapshots s
cross join jsonb_array_elements(s.data -> 'payouts') p
join lateral (
  select v from jsonb_array_elements(s.data -> 'ventures') v
  where v ->> 'id' = p ->> 'ventureId'
) ventures on true
order by date desc;

-- 5. Totals per venture — the same figures the home page shows.
select
  v ->> 'name' as venture,
  coalesce(sum((i ->> 'amount')::numeric) filter (where i is not null), 0) as invested,
  coalesce((
    select sum((p ->> 'amount')::numeric)
    from jsonb_array_elements(s.data -> 'payouts') p
    where p ->> 'ventureId' = v ->> 'id'
  ), 0) as returned
from public.snapshots s
cross join jsonb_array_elements(s.data -> 'ventures') v
left join lateral (
  select i from jsonb_array_elements(s.data -> 'investments') i
  where i ->> 'ventureId' = v ->> 'id'
) invested on true
group by s.data, v
order by invested desc;
