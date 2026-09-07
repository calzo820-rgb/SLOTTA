-- Store the immutable economic terms used to create each Stripe Checkout
-- Session, then finalize the paid booking in one database transaction.

alter table public.service_booking_holds
  add column if not exists expected_amount_cents bigint,
  add column if not exists expected_currency text,
  add column if not exists stripe_connect_account_id text,
  add column if not exists stripe_payment_intent_id text;

alter table public.service_bookings
  add column if not exists stripe_payment_intent_id text;

alter table public.service_booking_holds
  drop constraint if exists service_booking_holds_expected_amount_check,
  add constraint service_booking_holds_expected_amount_check
    check (expected_amount_cents is null or expected_amount_cents > 0),
  drop constraint if exists service_booking_holds_expected_currency_check,
  add constraint service_booking_holds_expected_currency_check
    check (
      expected_currency is null
      or expected_currency ~ '^[a-z]{3}$'
    );

create unique index if not exists service_bookings_stripe_session_id_key
  on public.service_bookings (stripe_session_id)
  where stripe_session_id is not null;

create or replace function public.finalize_stripe_booking(
  p_hold_id uuid,
  p_tenant_id uuid,
  p_stripe_session_id text,
  p_stripe_payment_intent_id text,
  p_amount_total bigint,
  p_currency text,
  p_stripe_connect_account_id text
)
returns table (booking_id uuid, was_created boolean)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_hold public.service_booking_holds%rowtype;
  v_existing_booking_id uuid;
  v_booking_id uuid;
begin
  if p_stripe_session_id is null or p_stripe_session_id = ''
     or p_amount_total is null or p_amount_total <= 0
     or p_currency is null or p_currency !~ '^[a-z]{3}$'
     or p_stripe_connect_account_id is null
     or p_stripe_connect_account_id = '' then
    raise exception using
      errcode = '22023',
      message = 'SLOTTA_INVALID_STRIPE_PAYMENT';
  end if;

  select h.*
    into v_hold
  from public.service_booking_holds h
  where h.id = p_hold_id
    and h.tenant_id = p_tenant_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'SLOTTA_HOLD_NOT_FOUND';
  end if;

  if v_hold.expected_amount_cents is null
     or v_hold.expected_currency is null
     or v_hold.stripe_connect_account_id is null
     or v_hold.expected_amount_cents <> p_amount_total
     or v_hold.expected_currency <> p_currency
     or v_hold.stripe_connect_account_id <> p_stripe_connect_account_id
     or (
       v_hold.stripe_session_id is not null
       and v_hold.stripe_session_id <> p_stripe_session_id
     ) then
    raise exception using
      errcode = '22023',
      message = 'SLOTTA_STRIPE_PAYMENT_MISMATCH';
  end if;

  select b.id
    into v_existing_booking_id
  from public.service_bookings b
  where b.stripe_session_id = p_stripe_session_id;

  if v_existing_booking_id is not null then
    update public.service_booking_holds
    set status = 'paid',
        stripe_session_id = p_stripe_session_id,
        stripe_payment_intent_id = p_stripe_payment_intent_id
    where id = v_hold.id;

    return query select v_existing_booking_id, false;
    return;
  end if;

  if v_hold.status <> 'pending' then
    raise exception using
      errcode = '55000',
      message = 'SLOTTA_HOLD_NOT_PENDING';
  end if;

  -- Save the session before inserting so the overlap trigger can recognize
  -- that the new booking is replacing this exact hold.
  update public.service_booking_holds
  set stripe_session_id = p_stripe_session_id,
      stripe_payment_intent_id = p_stripe_payment_intent_id
  where id = v_hold.id;

  insert into public.service_bookings (
    tenant_id,
    service_id,
    staff_id,
    customer_name,
    customer_email,
    customer_phone,
    note,
    booking_date,
    booking_time,
    status,
    payment_status,
    price_cents,
    payment_method,
    stripe_session_id,
    stripe_payment_intent_id,
    checkout_pending
  ) values (
    v_hold.tenant_id,
    v_hold.service_id,
    v_hold.staff_id,
    v_hold.customer_name,
    v_hold.customer_email,
    v_hold.customer_phone,
    v_hold.note,
    v_hold.booking_date,
    v_hold.booking_time::text,
    'confirmed',
    'paid',
    v_hold.expected_amount_cents,
    'online',
    p_stripe_session_id,
    p_stripe_payment_intent_id,
    false
  )
  returning id into v_booking_id;

  update public.service_booking_holds
  set status = 'paid'
  where id = v_hold.id;

  return query select v_booking_id, true;
end
$$;

revoke all on function public.finalize_stripe_booking(
  uuid, uuid, text, text, bigint, text, text
) from public, anon, authenticated;

grant execute on function public.finalize_stripe_booking(
  uuid, uuid, text, text, bigint, text, text
) to service_role;

comment on function public.finalize_stripe_booking(
  uuid, uuid, text, text, bigint, text, text
) is 'Atomically validates a paid Stripe Checkout Session and converts its hold into one booking.';
