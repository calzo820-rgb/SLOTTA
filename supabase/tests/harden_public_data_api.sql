begin;

do $$
declare
  exposed_table text;
begin
  select c.relname into exposed_table
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p', 'v', 'm')
    and (
      has_table_privilege('anon', c.oid, 'select')
      or has_table_privilege('anon', c.oid, 'insert')
      or has_table_privilege('anon', c.oid, 'update')
      or has_table_privilege('anon', c.oid, 'delete')
      or has_table_privilege('anon', c.oid, 'truncate')
      or has_table_privilege('anon', c.oid, 'references')
      or has_table_privilege('anon', c.oid, 'trigger')
    )
  limit 1;

  if exposed_table is not null then
    raise exception 'anonymous table privilege remains on %', exposed_table;
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'service_bookings'
      and 'anon' = any(roles)
  ) then
    raise exception 'anonymous service_bookings policy remains';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'service_bookings'
      and policyname = 'service_bookings_member_insert' and cmd = 'INSERT'
      and 'authenticated' = any(roles)
  ) then
    raise exception 'authenticated manual booking insert policy missing';
  end if;

  if has_table_privilege('authenticated', 'public.service_booking_holds', 'select')
    or has_table_privilege('authenticated', 'public.service_booking_holds', 'insert')
    or has_table_privilege('authenticated', 'public.push_subscriptions', 'select')
    or has_table_privilege('authenticated', 'public.tester_leads', 'select')
  then
    raise exception 'authenticated access remains on a server-only table';
  end if;
end
$$;

select 'public_data_api_hardened' as result;

rollback;
