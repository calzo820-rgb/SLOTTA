begin;

do $$
declare
  first_allowed boolean;
  second_allowed boolean;
  third_allowed boolean;
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'private' and table_name = 'api_rate_limits'
  ) then
    raise exception 'private rate limit table is missing';
  end if;

  if has_function_privilege(
    'anon',
    'public.consume_api_rate_limit(text,integer,integer)',
    'execute'
  ) or has_function_privilege(
    'authenticated',
    'public.consume_api_rate_limit(text,integer,integer)',
    'execute'
  ) then
    raise exception 'rate limit function is exposed to a browser role';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.consume_api_rate_limit(text,integer,integer)',
    'execute'
  ) then
    raise exception 'service role cannot consume rate limits';
  end if;

  select r.allowed into first_allowed
  from public.consume_api_rate_limit(repeat('a', 64), 2, 60) r;
  select r.allowed into second_allowed
  from public.consume_api_rate_limit(repeat('a', 64), 2, 60) r;
  select r.allowed into third_allowed
  from public.consume_api_rate_limit(repeat('a', 64), 2, 60) r;

  if first_allowed is not true
    or second_allowed is not true
    or third_allowed is not false
  then
    raise exception 'distributed counter did not enforce the configured limit';
  end if;
end
$$;

select 'distributed_rate_limit_verified' as result;
rollback;
