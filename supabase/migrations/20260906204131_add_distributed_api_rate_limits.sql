-- Shared fixed-window rate limiting for all Vercel instances. Only a SHA-256
-- digest of scope + client IP is persisted; raw IP addresses are never stored.

create table if not exists private.api_rate_limits (
  bucket_key text primary key check (bucket_key ~ '^[0-9a-f]{64}$'),
  request_count integer not null check (request_count > 0),
  reset_at timestamptz not null,
  updated_at timestamptz not null default clock_timestamp()
);

revoke all on table private.api_rate_limits from public, anon, authenticated;

create or replace function public.consume_api_rate_limit(
  p_bucket_key text,
  p_limit integer,
  p_window_seconds integer
)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_count integer;
  v_reset_at timestamptz;
begin
  if p_bucket_key !~ '^[0-9a-f]{64}$'
    or p_limit < 1 or p_limit > 10000
    or p_window_seconds < 1 or p_window_seconds > 86400
  then
    raise exception 'invalid rate limit parameters' using errcode = '22023';
  end if;

  insert into private.api_rate_limits as bucket (
    bucket_key,
    request_count,
    reset_at,
    updated_at
  ) values (
    p_bucket_key,
    1,
    v_now + make_interval(secs => p_window_seconds),
    v_now
  )
  on conflict (bucket_key) do update
    set request_count = case
          when bucket.reset_at <= v_now then 1
          else bucket.request_count + 1
        end,
        reset_at = case
          when bucket.reset_at <= v_now
            then v_now + make_interval(secs => p_window_seconds)
          else bucket.reset_at
        end,
        updated_at = v_now
  returning bucket.request_count, bucket.reset_at
  into v_count, v_reset_at;

  -- Opportunistic bounded-retention cleanup avoids storing inactive hashes.
  if random() < 0.01 then
    delete from private.api_rate_limits
    where updated_at < v_now - interval '2 days';
  end if;

  allowed := v_count <= p_limit;
  retry_after_seconds := greatest(
    1,
    ceil(extract(epoch from (v_reset_at - v_now)))::integer
  );
  return next;
end;
$$;

revoke all on function public.consume_api_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, integer, integer)
  to service_role;
