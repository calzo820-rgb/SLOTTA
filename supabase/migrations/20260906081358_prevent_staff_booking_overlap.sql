-- Prevent overlapping reservations for the same staff member at the database
-- boundary. Application-level availability checks remain useful for UX, but
-- cannot protect against two requests that arrive at the same time.

create schema if not exists slotta_private;

revoke all on schema slotta_private from public, anon, authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'service_bookings_booking_time_format_check'
      and conrelid = 'public.service_bookings'::regclass
  ) then
    alter table public.service_bookings
      add constraint service_bookings_booking_time_format_check
      check (
        booking_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$'
      );
  end if;
end
$$;

create index if not exists service_bookings_active_staff_day_idx
  on public.service_bookings (
    tenant_id,
    coalesce(staff_id, staff_member_id),
    booking_date
  )
  where status <> 'cancelled'
    and not coalesce(checkout_pending, false);

create index if not exists service_booking_holds_pending_staff_day_idx
  on public.service_booking_holds (tenant_id, staff_id, booking_date, expires_at)
  where status = 'pending';

create or replace function slotta_private.guard_staff_booking_overlap()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  candidate_staff_id uuid;
  candidate_duration integer;
  candidate_start timestamp without time zone;
  candidate_end timestamp without time zone;
  has_conflict boolean;
begin
  if tg_table_name = 'service_bookings' then
    candidate_staff_id := coalesce(new.staff_id, new.staff_member_id);

    if new.status = 'cancelled' or coalesce(new.checkout_pending, false) then
      return new;
    end if;
  else
    candidate_staff_id := new.staff_id;

    if new.status <> 'pending' or new.expires_at <= pg_catalog.clock_timestamp() then
      return new;
    end if;
  end if;

  -- Old records without an assigned operator keep their historical behaviour.
  -- Every current public booking flow assigns an operator before inserting.
  if candidate_staff_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.staff_members sm
    where sm.id = candidate_staff_id
      and sm.tenant_id = new.tenant_id
  ) then
    raise exception using
      errcode = '23503',
      message = 'SLOTTA_INVALID_STAFF_TENANT';
  end if;

  select s.duration_minutes
    into candidate_duration
  from public.services s
  where s.id = new.service_id
    and s.tenant_id = new.tenant_id;

  if candidate_duration is null or candidate_duration < 1 or candidate_duration > 1440 then
    raise exception using
      errcode = '23514',
      message = 'SLOTTA_INVALID_SERVICE_DURATION';
  end if;

  candidate_start := new.booking_date + new.booking_time::time;
  candidate_end := candidate_start + pg_catalog.make_interval(mins => candidate_duration);

  -- Serialize all reservation changes for one operator. The lock is released
  -- automatically on commit or rollback, including when the trigger rejects.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(candidate_staff_id::text, 0)
  );

  select exists (
    select 1
    from public.service_bookings b
    join public.services s on s.id = b.service_id
    where b.tenant_id = new.tenant_id
      and coalesce(b.staff_id, b.staff_member_id) = candidate_staff_id
      and b.status <> 'cancelled'
      and not coalesce(b.checkout_pending, false)
      and (tg_table_name <> 'service_bookings' or b.id <> new.id)
      and b.booking_date + b.booking_time::time < candidate_end
      and b.booking_date + b.booking_time::time
            + pg_catalog.make_interval(mins => coalesce(s.duration_minutes, 60))
          > candidate_start
  ) into has_conflict;

  if has_conflict then
    raise exception using
      errcode = '23P01',
      message = 'SLOTTA_STAFF_OVERLAP';
  end if;

  select exists (
    select 1
    from public.service_booking_holds h
    join public.services s on s.id = h.service_id
    where h.tenant_id = new.tenant_id
      and h.staff_id = candidate_staff_id
      and h.status = 'pending'
      and h.expires_at > pg_catalog.clock_timestamp()
      and (tg_table_name <> 'service_booking_holds' or h.id <> new.id)
      -- Stripe converts its own hold into a booking before marking it paid.
      and not (
        tg_table_name = 'service_bookings'
        and new.stripe_session_id is not null
        and h.stripe_session_id = new.stripe_session_id
      )
      and h.booking_date + h.booking_time < candidate_end
      and h.booking_date + h.booking_time
            + pg_catalog.make_interval(mins => coalesce(s.duration_minutes, 60))
          > candidate_start
  ) into has_conflict;

  if has_conflict then
    raise exception using
      errcode = '23P01',
      message = 'SLOTTA_STAFF_OVERLAP';
  end if;

  return new;
end
$$;

revoke all on function slotta_private.guard_staff_booking_overlap() from public, anon, authenticated;

drop trigger if exists guard_service_booking_overlap on public.service_bookings;
create trigger guard_service_booking_overlap
before insert or update of
  tenant_id,
  service_id,
  staff_id,
  staff_member_id,
  booking_date,
  booking_time,
  status,
  checkout_pending,
  stripe_session_id
on public.service_bookings
for each row
execute function slotta_private.guard_staff_booking_overlap();

drop trigger if exists guard_service_booking_hold_overlap on public.service_booking_holds;
create trigger guard_service_booking_hold_overlap
before insert or update of
  tenant_id,
  service_id,
  staff_id,
  booking_date,
  booking_time,
  status,
  expires_at,
  stripe_session_id
on public.service_booking_holds
for each row
execute function slotta_private.guard_staff_booking_overlap();
