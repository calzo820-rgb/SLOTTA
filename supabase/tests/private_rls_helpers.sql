begin;

do $$
declare
  helper_name text;
  dependent_policy_count integer;
begin
  select p.proname into helper_name
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('is_tenant_owner', 'my_role', 'my_tenant_id')
  limit 1;

  if helper_name is not null then
    raise exception 'privileged helper remains in public schema: %', helper_name;
  end if;

  if (
    select count(*)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname in ('is_tenant_owner', 'my_role', 'my_tenant_id')
      and p.prosecdef
      and p.proconfig @> array['search_path=""']::text[]
  ) <> 3 then
    raise exception 'private SECURITY DEFINER helpers are missing or unsafe';
  end if;

  if has_function_privilege('anon', 'private.is_tenant_owner(uuid)', 'execute')
    or has_function_privilege('anon', 'private.my_role()', 'execute')
    or has_function_privilege('anon', 'private.my_tenant_id()', 'execute')
  then
    raise exception 'anonymous execution remains on a private helper';
  end if;

  if not has_schema_privilege('authenticated', 'private', 'usage')
    or not has_function_privilege('authenticated', 'private.is_tenant_owner(uuid)', 'execute')
    or not has_function_privilege('authenticated', 'private.my_role()', 'execute')
    or not has_function_privilege('authenticated', 'private.my_tenant_id()', 'execute')
  then
    raise exception 'authenticated RLS execution privilege is missing';
  end if;

  select count(*) into dependent_policy_count
  from pg_policies
  where schemaname = 'public'
    and (
      coalesce(qual, '') ~ 'private[.](is_tenant_owner|my_role|my_tenant_id)'
      or coalesce(with_check, '') ~ 'private[.](is_tenant_owner|my_role|my_tenant_id)'
    );

  if dependent_policy_count <> 24 then
    raise exception 'expected 24 policies using private helpers, found %', dependent_policy_count;
  end if;
end
$$;

select 'private_rls_helpers_verified' as result;

rollback;
