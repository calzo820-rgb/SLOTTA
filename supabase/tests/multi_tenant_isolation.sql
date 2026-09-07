begin;

-- SEC-07: regression guard for cross-tenant access.
-- Temporary fixtures are created inside this transaction and always rolled
-- back. No production row survives this test.
do $$
declare
  target_table text;
  missing_select text[] := '{}';
  missing_tenant_guard text[] := '{}';
  exposed_table text;
begin
  foreach target_table in array array[
    'tenants', 'tenant_users', 'tenant_settings', 'tenant_hours',
    'services', 'staff_members', 'staff_hours', 'closures',
    'blocked_time_slots', 'service_bookings'
  ] loop
    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = target_table
        and cmd = 'SELECT'
        and 'authenticated' = any(roles)
        and coalesce(qual, '') <> ''
        and (
          coalesce(qual, '') ilike '%tenant_id%'
          or coalesce(qual, '') ilike '%private.my_tenant_id%'
          or coalesce(qual, '') ilike '%tenant_users%'
        )
    ) then
      missing_select := array_append(missing_select, target_table);
    end if;

    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = target_table
        and (
          coalesce(qual, '') ilike '%tenant_id%'
          or coalesce(qual, '') ilike '%private.my_tenant_id%'
          or coalesce(qual, '') ilike '%tenant_users%'
          or coalesce(with_check, '') ilike '%tenant_id%'
          or coalesce(with_check, '') ilike '%private.my_tenant_id%'
          or coalesce(with_check, '') ilike '%tenant_users%'
        )
    ) then
      missing_tenant_guard := array_append(missing_tenant_guard, target_table);
    end if;
  end loop;

  if cardinality(missing_select) > 0 then
    raise exception 'missing tenant-scoped authenticated SELECT policy on: %',
      array_to_string(missing_select, ', ');
  end if;

  if cardinality(missing_tenant_guard) > 0 then
    raise exception 'missing tenant guard in policies on: %',
      array_to_string(missing_tenant_guard, ', ');
  end if;

  select c.relname into exposed_table
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p', 'v', 'm')
    and has_table_privilege('anon', c.oid, 'select')
    and c.relname in (
      'tenants', 'tenant_users', 'tenant_settings', 'tenant_hours',
      'services', 'staff_members', 'staff_hours', 'closures',
      'blocked_time_slots', 'service_bookings'
    )
  limit 1;

  if exposed_table is not null then
    raise exception 'anonymous SELECT privilege remains on %', exposed_table;
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'tenants', 'tenant_users', 'tenant_settings', 'tenant_hours',
        'services', 'staff_members', 'staff_hours', 'closures',
        'blocked_time_slots', 'service_bookings'
      )
      and 'anon' = any(roles)
  ) then
    raise exception 'anonymous policy remains on a tenant-scoped table';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'tenants', 'tenant_users', 'tenant_settings', 'tenant_hours',
        'services', 'staff_members', 'staff_hours', 'closures',
        'blocked_time_slots', 'service_bookings'
      )
      and cmd in ('INSERT', 'UPDATE', 'DELETE')
      and 'authenticated' = any(roles)
      and coalesce(qual, '') = ''
      and coalesce(with_check, '') = ''
  ) then
    raise exception 'unscoped authenticated write policy remains';
  end if;
end
$$;

-- Exercise the policies with the real owner and staff roles. A temporary
-- second tenant is deliberately outside both memberships.
select set_config(
  'slotta.test_owner_id',
  (select user_id::text from public.tenant_users where role = 'owner' and coalesce(is_active, true) limit 1),
  true
);
select set_config(
  'slotta.test_staff_id',
  (select user_id::text from public.tenant_users where role = 'staff' and coalesce(is_active, true) limit 1),
  true
);
select set_config(
  'slotta.test_owner_tenant_id',
  (select tenant_id::text from public.tenant_users where role = 'owner' and coalesce(is_active, true) limit 1),
  true
);
select set_config('slotta.test_foreign_tenant_id', gen_random_uuid()::text, true);

do $$
begin
  if current_setting('slotta.test_owner_id', true) is null
    or current_setting('slotta.test_staff_id', true) is null
  then
    raise exception 'SEC-07 requires one active owner and one active staff membership';
  end if;
end
$$;

insert into public.tenants (id, slug, name, staff_login_code)
values (
  current_setting('slotta.test_foreign_tenant_id')::uuid,
  'sec-07-' || replace(current_setting('slotta.test_foreign_tenant_id'), '-', ''),
  'SEC-07 foreign tenant',
  lpad((100000 + floor(random() * 900000))::integer::text, 6, '0')
);

insert into public.services (tenant_id, name, duration_minutes, price_cents)
values (
  current_setting('slotta.test_foreign_tenant_id')::uuid,
  'SEC-07 hidden service',
  30,
  1000
);

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('slotta.test_owner_id'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $$
begin
  if exists (
    select 1 from public.tenants
    where id = current_setting('slotta.test_foreign_tenant_id')::uuid
  ) or exists (
    select 1 from public.services
    where tenant_id = current_setting('slotta.test_foreign_tenant_id')::uuid
  ) then
    raise exception 'owner can read another tenant';
  end if;

  begin
    insert into public.services (tenant_id, name, duration_minutes, price_cents)
    values (
      current_setting('slotta.test_foreign_tenant_id')::uuid,
      'SEC-07 forbidden owner write', 30, 1000
    );
    raise exception 'owner can write to another tenant';
  exception
    when insufficient_privilege then null;
  end;
end
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('slotta.test_staff_id'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $$
begin
  if exists (
    select 1 from public.tenants
    where id = current_setting('slotta.test_foreign_tenant_id')::uuid
  ) or exists (
    select 1 from public.services
    where tenant_id = current_setting('slotta.test_foreign_tenant_id')::uuid
  ) then
    raise exception 'staff can read another tenant';
  end if;

  begin
    insert into public.services (tenant_id, name, duration_minutes, price_cents)
    values (
      current_setting('slotta.test_owner_tenant_id')::uuid,
      'SEC-07 forbidden staff write', 30, 1000
    );
    raise exception 'staff can perform an owner-only write';
  exception
    when insufficient_privilege then null;
  end;
end
$$;

reset role;

select 'multi_tenant_isolation_verified' as result;

rollback;
