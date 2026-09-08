begin;

do $$
begin
  if to_regclass('public.tenant_deletion_requests') is null then
    raise exception 'tenant_deletion_requests table missing';
  end if;

  if not coalesce((
    select c.relrowsecurity
    from pg_class c
    where c.oid = 'public.tenant_deletion_requests'::regclass
  ), false) then
    raise exception 'RLS is not enabled';
  end if;

  if has_table_privilege('anon', 'public.tenant_deletion_requests', 'select')
    or has_table_privilege('authenticated', 'public.tenant_deletion_requests', 'select')
    or has_table_privilege('authenticated', 'public.tenant_deletion_requests', 'insert')
    or has_table_privilege('authenticated', 'public.tenant_deletion_requests', 'update')
    or has_table_privilege('authenticated', 'public.tenant_deletion_requests', 'delete') then
    raise exception 'client role privileges remain';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'tenant_deletion_requests_one_scheduled_per_tenant'
      and indexdef ilike '%where (status = ''scheduled''%'
  ) then
    raise exception 'scheduled request uniqueness index missing';
  end if;
end
$$;

rollback;
