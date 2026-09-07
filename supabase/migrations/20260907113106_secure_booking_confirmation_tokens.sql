-- Public confirmation pages must not be addressable with internal booking IDs
-- or Stripe session IDs. Only SHA-256 hashes are persisted; the random token
-- is returned once to the customer's browser and expires after 30 days.

alter table public.service_bookings
  add column if not exists confirmation_token_hash text,
  add column if not exists confirmation_token_expires_at timestamptz,
  add column if not exists confirmation_token_revoked_at timestamptz;

alter table public.service_booking_holds
  add column if not exists confirmation_token_hash text,
  add column if not exists confirmation_token_expires_at timestamptz,
  add column if not exists confirmation_token_revoked_at timestamptz;

alter table public.service_bookings
  drop constraint if exists service_bookings_confirmation_token_hash_check,
  add constraint service_bookings_confirmation_token_hash_check
    check (
      confirmation_token_hash is null
      or confirmation_token_hash ~ '^[0-9a-f]{64}$'
    );

alter table public.service_booking_holds
  drop constraint if exists service_booking_holds_confirmation_token_hash_check,
  add constraint service_booking_holds_confirmation_token_hash_check
    check (
      confirmation_token_hash is null
      or confirmation_token_hash ~ '^[0-9a-f]{64}$'
    );

create unique index if not exists service_bookings_confirmation_token_hash_key
  on public.service_bookings (confirmation_token_hash)
  where confirmation_token_hash is not null;

create unique index if not exists service_booking_holds_confirmation_token_hash_key
  on public.service_booking_holds (confirmation_token_hash)
  where confirmation_token_hash is not null;

create or replace function slotta_private.copy_booking_confirmation_token()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if new.stripe_session_id is not null and new.confirmation_token_hash is null then
    select
      h.confirmation_token_hash,
      h.confirmation_token_expires_at,
      h.confirmation_token_revoked_at
    into
      new.confirmation_token_hash,
      new.confirmation_token_expires_at,
      new.confirmation_token_revoked_at
    from public.service_booking_holds h
    where h.stripe_session_id = new.stripe_session_id;
  end if;

  return new;
end
$$;

revoke all on function slotta_private.copy_booking_confirmation_token()
  from public, anon, authenticated;

drop trigger if exists copy_booking_confirmation_token_from_hold
  on public.service_bookings;

create trigger copy_booking_confirmation_token_from_hold
before insert on public.service_bookings
for each row
execute function slotta_private.copy_booking_confirmation_token();

comment on column public.service_bookings.confirmation_token_hash is
  'SHA-256 hash of the expiring public confirmation token; never store the raw token.';
