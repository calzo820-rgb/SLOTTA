-- Track Stripe webhook delivery IDs and apply payment lifecycle changes in the
-- same transaction. Stripe retries and out-of-order deliveries are therefore
-- safe and cannot mutate a booking belonging to another Connect account.

create table if not exists slotta_private.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  stripe_account_id text,
  object_id text,
  processed_at timestamptz not null default now()
);

alter table slotta_private.stripe_webhook_events enable row level security;
revoke all on table slotta_private.stripe_webhook_events
  from public, anon, authenticated, service_role;

alter table public.service_bookings
  add column if not exists stripe_charge_id text,
  add column if not exists stripe_dispute_id text,
  add column if not exists payment_currency text,
  add column if not exists refunded_amount_cents bigint not null default 0,
  add column if not exists payment_updated_at timestamptz;

alter table public.service_bookings
  drop constraint if exists service_bookings_refunded_amount_check,
  add constraint service_bookings_refunded_amount_check
    check (refunded_amount_cents >= 0);

create unique index if not exists service_bookings_stripe_payment_intent_id_key
  on public.service_bookings (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

create index if not exists service_bookings_stripe_charge_id_idx
  on public.service_bookings (stripe_charge_id)
  where stripe_charge_id is not null;

create or replace function public.finalize_stripe_booking(
  p_hold_id uuid,
  p_tenant_id uuid,
  p_stripe_session_id text,
  p_stripe_payment_intent_id text,
  p_amount_total bigint,
  p_currency text,
  p_stripe_connect_account_id text,
  p_event_id text,
  p_event_type text
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
  v_claimed_event_id text;
begin
  if p_event_id is null or p_event_id = ''
     or p_event_type not in (
       'checkout.session.completed',
       'checkout.session.async_payment_succeeded'
     )
     or p_stripe_session_id is null or p_stripe_session_id = ''
     or p_stripe_payment_intent_id is null or p_stripe_payment_intent_id = ''
     or p_amount_total is null or p_amount_total <= 0
     or p_currency is null or p_currency !~ '^[a-z]{3}$'
     or p_stripe_connect_account_id is null
     or p_stripe_connect_account_id = '' then
    raise exception using errcode = '22023', message = 'SLOTTA_INVALID_STRIPE_PAYMENT';
  end if;

  insert into slotta_private.stripe_webhook_events (
    event_id, event_type, stripe_account_id, object_id
  ) values (
    p_event_id, p_event_type, p_stripe_connect_account_id, p_stripe_session_id
  )
  on conflict (event_id) do nothing
  returning event_id into v_claimed_event_id;

  if v_claimed_event_id is null then
    select b.id into v_existing_booking_id
    from public.service_bookings b
    where b.stripe_session_id = p_stripe_session_id;

    return query select v_existing_booking_id, false;
    return;
  end if;

  select h.* into v_hold
  from public.service_booking_holds h
  where h.id = p_hold_id and h.tenant_id = p_tenant_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'SLOTTA_HOLD_NOT_FOUND';
  end if;

  if v_hold.expected_amount_cents is null
     or v_hold.expected_currency is null
     or v_hold.stripe_connect_account_id is null
     or v_hold.expected_amount_cents <> p_amount_total
     or v_hold.expected_currency <> p_currency
     or v_hold.stripe_connect_account_id <> p_stripe_connect_account_id
     or (v_hold.stripe_session_id is not null and v_hold.stripe_session_id <> p_stripe_session_id) then
    raise exception using errcode = '22023', message = 'SLOTTA_STRIPE_PAYMENT_MISMATCH';
  end if;

  select b.id into v_existing_booking_id
  from public.service_bookings b
  where b.stripe_session_id = p_stripe_session_id;

  if v_existing_booking_id is not null then
    update public.service_booking_holds
    set status = 'paid', stripe_session_id = p_stripe_session_id,
        stripe_payment_intent_id = p_stripe_payment_intent_id
    where id = v_hold.id;
    return query select v_existing_booking_id, false;
    return;
  end if;

  if v_hold.status <> 'pending' then
    raise exception using errcode = '55000', message = 'SLOTTA_HOLD_NOT_PENDING';
  end if;

  update public.service_booking_holds
  set stripe_session_id = p_stripe_session_id,
      stripe_payment_intent_id = p_stripe_payment_intent_id
  where id = v_hold.id;

  insert into public.service_bookings (
    tenant_id, service_id, staff_id, customer_name, customer_email,
    customer_phone, note, booking_date, booking_time, status,
    payment_status, price_cents, payment_method, stripe_session_id,
    stripe_payment_intent_id, checkout_pending, payment_currency,
    payment_updated_at
  ) values (
    v_hold.tenant_id, v_hold.service_id, v_hold.staff_id,
    v_hold.customer_name, v_hold.customer_email, v_hold.customer_phone,
    v_hold.note, v_hold.booking_date, v_hold.booking_time::text,
    'confirmed', 'paid', v_hold.expected_amount_cents, 'online',
    p_stripe_session_id, p_stripe_payment_intent_id, false, p_currency, now()
  ) returning id into v_booking_id;

  update public.service_booking_holds set status = 'paid' where id = v_hold.id;
  return query select v_booking_id, true;
end
$$;

drop function if exists public.finalize_stripe_booking(
  uuid, uuid, text, text, bigint, text, text
);

revoke all on function public.finalize_stripe_booking(
  uuid, uuid, text, text, bigint, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.finalize_stripe_booking(
  uuid, uuid, text, text, bigint, text, text, text, text
) to service_role;

create or replace function public.process_stripe_booking_event(
  p_event_id text,
  p_event_type text,
  p_stripe_account_id text,
  p_object_id text,
  p_tenant_id uuid,
  p_hold_id uuid,
  p_stripe_session_id text,
  p_payment_intent_id text,
  p_charge_id text,
  p_dispute_id text,
  p_dispute_status text,
  p_amount_refunded bigint,
  p_currency text
)
returns table (was_processed boolean, booking_id uuid)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_claimed_event_id text;
  v_hold public.service_booking_holds%rowtype;
  v_booking public.service_bookings%rowtype;
  v_tenant_account text;
begin
  if p_event_id is null or p_event_id = ''
     or p_stripe_account_id is null or p_stripe_account_id = ''
     or p_event_type not in (
       'checkout.session.async_payment_failed',
       'checkout.session.expired',
       'charge.refunded',
       'charge.dispute.created',
       'charge.dispute.closed'
     ) then
    raise exception using errcode = '22023', message = 'SLOTTA_INVALID_STRIPE_EVENT';
  end if;

  insert into slotta_private.stripe_webhook_events (
    event_id, event_type, stripe_account_id, object_id
  ) values (p_event_id, p_event_type, p_stripe_account_id, p_object_id)
  on conflict (event_id) do nothing
  returning event_id into v_claimed_event_id;

  if v_claimed_event_id is null then
    return query select false, null::uuid;
    return;
  end if;

  if p_event_type in (
    'checkout.session.async_payment_failed', 'checkout.session.expired'
  ) then
    if p_tenant_id is null or p_hold_id is null
       or p_stripe_session_id is null or p_stripe_session_id = '' then
      raise exception using errcode = '22023', message = 'SLOTTA_INVALID_STRIPE_EVENT';
    end if;

    select h.* into v_hold
    from public.service_booking_holds h
    where h.id = p_hold_id and h.tenant_id = p_tenant_id
    for update;

    if not found then
      raise exception using errcode = 'P0002', message = 'SLOTTA_HOLD_NOT_FOUND';
    end if;

    if v_hold.stripe_connect_account_id <> p_stripe_account_id
       or v_hold.stripe_session_id <> p_stripe_session_id then
      raise exception using errcode = '22023', message = 'SLOTTA_STRIPE_PAYMENT_MISMATCH';
    end if;

    update public.service_booking_holds
    set status = 'expired'
    where id = v_hold.id and status = 'pending';

    return query select true, null::uuid;
    return;
  end if;

  if p_payment_intent_id is null or p_payment_intent_id = '' then
    raise exception using errcode = '22023', message = 'SLOTTA_INVALID_STRIPE_EVENT';
  end if;

  select b.* into v_booking
  from public.service_bookings b
  where b.stripe_payment_intent_id = p_payment_intent_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'SLOTTA_BOOKING_NOT_FOUND';
  end if;

  select t.stripe_connect_account_id into v_tenant_account
  from public.tenants t
  where t.id = v_booking.tenant_id;

  if v_tenant_account <> p_stripe_account_id then
    raise exception using errcode = '22023', message = 'SLOTTA_STRIPE_PAYMENT_MISMATCH';
  end if;

  if p_event_type = 'charge.refunded' then
    if p_charge_id is null or p_charge_id = ''
       or p_amount_refunded is null or p_amount_refunded < 0
       or p_currency is null or p_currency !~ '^[a-z]{3}$'
       or p_currency <> v_booking.payment_currency
       or p_amount_refunded > v_booking.price_cents then
      raise exception using errcode = '22023', message = 'SLOTTA_INVALID_STRIPE_REFUND';
    end if;

    update public.service_bookings
    set stripe_charge_id = p_charge_id,
        refunded_amount_cents = p_amount_refunded,
        payment_status = case
          when p_amount_refunded >= price_cents then 'refunded'
          when p_amount_refunded > 0 then 'partially_refunded'
          else 'paid'
        end,
        payment_updated_at = now()
    where id = v_booking.id;
  elsif p_event_type = 'charge.dispute.created' then
    update public.service_bookings
    set stripe_charge_id = coalesce(p_charge_id, stripe_charge_id),
        stripe_dispute_id = p_dispute_id,
        payment_status = 'disputed',
        payment_updated_at = now()
    where id = v_booking.id;
  else
    if p_dispute_status not in ('won', 'lost') then
      raise exception using errcode = '22023', message = 'SLOTTA_INVALID_STRIPE_DISPUTE';
    end if;

    update public.service_bookings
    set stripe_charge_id = coalesce(p_charge_id, stripe_charge_id),
        stripe_dispute_id = p_dispute_id,
        payment_status = case
          when p_dispute_status = 'lost' then 'dispute_lost'
          when refunded_amount_cents >= price_cents then 'refunded'
          when refunded_amount_cents > 0 then 'partially_refunded'
          else 'paid'
        end,
        payment_updated_at = now()
    where id = v_booking.id;
  end if;

  return query select true, v_booking.id;
end
$$;

revoke all on function public.process_stripe_booking_event(
  text, text, text, text, uuid, uuid, text, text, text, text, text, bigint, text
) from public, anon, authenticated;
grant execute on function public.process_stripe_booking_event(
  text, text, text, text, uuid, uuid, text, text, text, text, text, bigint, text
) to service_role;

create or replace function public.process_stripe_connect_event(
  p_event_id text,
  p_stripe_account_id text,
  p_details_submitted boolean,
  p_charges_enabled boolean,
  p_payouts_enabled boolean,
  p_disabled_reason text,
  p_requirements jsonb
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_claimed_event_id text;
begin
  if p_event_id is null or p_event_id = ''
     or p_stripe_account_id is null or p_stripe_account_id = '' then
    raise exception using errcode = '22023', message = 'SLOTTA_INVALID_STRIPE_EVENT';
  end if;

  insert into slotta_private.stripe_webhook_events (
    event_id, event_type, stripe_account_id, object_id
  ) values (p_event_id, 'account.updated', p_stripe_account_id, p_stripe_account_id)
  on conflict (event_id) do nothing
  returning event_id into v_claimed_event_id;

  if v_claimed_event_id is null then return false; end if;

  update public.tenants
  set stripe_connect_details_submitted = coalesce(p_details_submitted, false),
      stripe_connect_charges_enabled = coalesce(p_charges_enabled, false),
      stripe_connect_payouts_enabled = coalesce(p_payouts_enabled, false),
      stripe_connect_disabled_reason = p_disabled_reason,
      stripe_connect_requirements = p_requirements
  where stripe_connect_account_id = p_stripe_account_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'SLOTTA_TENANT_NOT_FOUND';
  end if;
  return true;
end
$$;

revoke all on function public.process_stripe_connect_event(
  text, text, boolean, boolean, boolean, text, jsonb
) from public, anon, authenticated;
grant execute on function public.process_stripe_connect_event(
  text, text, boolean, boolean, boolean, text, jsonb
) to service_role;

comment on table slotta_private.stripe_webhook_events is
  'Server-only idempotency ledger for verified Stripe webhook deliveries.';
