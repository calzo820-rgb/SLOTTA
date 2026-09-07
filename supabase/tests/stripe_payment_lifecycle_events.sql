-- Run after applying 20260907103045_stripe_payment_lifecycle_events.sql.
-- All test data and temporary tenant changes are rolled back.

begin;

do $$
declare
  v_tenant_id uuid;
  v_service_id uuid;
  v_staff_id uuid;
  v_hold_id uuid := gen_random_uuid();
  v_booking_id uuid;
  v_was_created boolean;
  v_processed boolean;
  v_duplicate_processed boolean;
begin
  select t.id, s.id, sm.id
    into v_tenant_id, v_service_id, v_staff_id
  from public.tenants t
  join public.services s on s.tenant_id = t.id and s.is_active = true
  join public.staff_members sm on sm.tenant_id = t.id and sm.is_active = true
  where t.is_active = true and s.price_cents > 0
  limit 1;

  if v_tenant_id is null then
    raise exception 'PAY-03 requires one active tenant, priced service and staff member';
  end if;

  if has_function_privilege(
    'anon',
    'public.process_stripe_booking_event(text,text,text,text,uuid,uuid,text,text,text,text,text,bigint,text)',
    'execute'
  ) or has_function_privilege(
    'authenticated',
    'public.process_stripe_booking_event(text,text,text,text,uuid,uuid,text,text,text,text,text,bigint,text)',
    'execute'
  ) or not has_function_privilege(
    'service_role',
    'public.process_stripe_booking_event(text,text,text,text,uuid,uuid,text,text,text,text,text,bigint,text)',
    'execute'
  ) then
    raise exception 'SLOTTA_STRIPE_EVENT_PRIVILEGES_INVALID';
  end if;

  update public.tenants
  set stripe_connect_account_id = 'acct_pay03_test'
  where id = v_tenant_id;

  insert into public.service_booking_holds (
    id, tenant_id, service_id, staff_id, customer_name, customer_email,
    customer_phone, booking_date, booking_time, status, expires_at,
    expected_amount_cents, expected_currency, stripe_connect_account_id,
    stripe_session_id
  ) values (
    v_hold_id, v_tenant_id, v_service_id, v_staff_id, 'PAY-03 test',
    'pay03@example.invalid', '00000000', date '2099-12-28', time '06:00',
    'pending', clock_timestamp() + interval '1 hour', 3500, 'eur',
    'acct_pay03_test', 'cs_pay03_test'
  );

  select r.booking_id, r.was_created
    into v_booking_id, v_was_created
  from public.finalize_stripe_booking(
    v_hold_id, v_tenant_id, 'cs_pay03_test', 'pi_pay03_test', 3500,
    'eur', 'acct_pay03_test', 'evt_pay03_async_success',
    'checkout.session.async_payment_succeeded'
  ) r;

  if v_booking_id is null or not v_was_created then
    raise exception 'SLOTTA_ASYNC_PAYMENT_WAS_NOT_FINALIZED';
  end if;

  select r.was_processed into v_processed
  from public.process_stripe_booking_event(
    'evt_pay03_refund_partial', 'charge.refunded', 'acct_pay03_test',
    'ch_pay03_test', null, null, null, 'pi_pay03_test', 'ch_pay03_test',
    null, null, 1000, 'eur'
  ) r;

  select r.was_processed into v_duplicate_processed
  from public.process_stripe_booking_event(
    'evt_pay03_refund_partial', 'charge.refunded', 'acct_pay03_test',
    'ch_pay03_test', null, null, null, 'pi_pay03_test', 'ch_pay03_test',
    null, null, 1000, 'eur'
  ) r;

  if not v_processed or v_duplicate_processed then
    raise exception 'SLOTTA_STRIPE_EVENT_NOT_IDEMPOTENT';
  end if;

  if not exists (
    select 1 from public.service_bookings
    where id = v_booking_id and payment_status = 'partially_refunded'
      and refunded_amount_cents = 1000 and stripe_charge_id = 'ch_pay03_test'
  ) then
    raise exception 'SLOTTA_PARTIAL_REFUND_STATE_INVALID';
  end if;

  perform * from public.process_stripe_booking_event(
    'evt_pay03_dispute', 'charge.dispute.created', 'acct_pay03_test',
    'dp_pay03_test', null, null, null, 'pi_pay03_test', 'ch_pay03_test',
    'dp_pay03_test', 'needs_response', null, null
  );

  if not exists (
    select 1 from public.service_bookings
    where id = v_booking_id and payment_status = 'disputed'
      and stripe_dispute_id = 'dp_pay03_test'
  ) then
    raise exception 'SLOTTA_DISPUTE_STATE_INVALID';
  end if;

  perform * from public.process_stripe_booking_event(
    'evt_pay03_dispute_closed', 'charge.dispute.closed', 'acct_pay03_test',
    'dp_pay03_test', null, null, null, 'pi_pay03_test', 'ch_pay03_test',
    'dp_pay03_test', 'lost', null, null
  );

  if not exists (
    select 1 from public.service_bookings
    where id = v_booking_id and payment_status = 'dispute_lost'
  ) then
    raise exception 'SLOTTA_CLOSED_DISPUTE_STATE_INVALID';
  end if;

  begin
    perform * from public.process_stripe_booking_event(
      'evt_pay03_wrong_account', 'charge.refunded', 'acct_other',
      'ch_pay03_test', null, null, null, 'pi_pay03_test', 'ch_pay03_test',
      null, null, 3500, 'eur'
    );
    raise exception 'SLOTTA_WRONG_CONNECT_ACCOUNT_WAS_ACCEPTED';
  exception
    when sqlstate '22023' then null;
  end;
end
$$;

rollback;
