-- Run after applying 20260907100604_atomic_stripe_booking_finalization.sql.
-- Every mutation is rolled back.

begin;

do $$
declare
  v_tenant_id uuid;
  v_service_id uuid;
  v_staff_id uuid;
  v_hold_id uuid := gen_random_uuid();
  v_mismatch_hold_id uuid := gen_random_uuid();
  v_booking_id uuid;
  v_was_created boolean;
  v_count integer;
  v_mismatch_blocked boolean := false;
begin
  select t.id, s.id, sm.id
    into v_tenant_id, v_service_id, v_staff_id
  from public.tenants t
  join public.services s
    on s.tenant_id = t.id
   and s.is_active = true
   and s.price_cents > 0
  join public.staff_members sm
    on sm.tenant_id = t.id
   and sm.is_active = true
  where t.is_active = true
  limit 1;

  if v_tenant_id is null then
    raise exception 'PAY-01 requires one active tenant, priced service and staff member';
  end if;

  if has_function_privilege(
    'anon',
    'public.finalize_stripe_booking(uuid,uuid,text,text,bigint,text,text)',
    'execute'
  ) or has_function_privilege(
    'authenticated',
    'public.finalize_stripe_booking(uuid,uuid,text,text,bigint,text,text)',
    'execute'
  ) or not has_function_privilege(
    'service_role',
    'public.finalize_stripe_booking(uuid,uuid,text,text,bigint,text,text)',
    'execute'
  ) then
    raise exception 'SLOTTA_STRIPE_FINALIZER_PRIVILEGES_INVALID';
  end if;

  insert into public.service_booking_holds (
    id,
    tenant_id,
    service_id,
    staff_id,
    customer_name,
    customer_email,
    customer_phone,
    booking_date,
    booking_time,
    status,
    expires_at,
    expected_amount_cents,
    expected_currency,
    stripe_connect_account_id,
    stripe_session_id
  ) values (
    v_hold_id,
    v_tenant_id,
    v_service_id,
    v_staff_id,
    'PAY-01 test',
    'pay01@example.invalid',
    '00000000',
    date '2099-12-29',
    time '06:00',
    'pending',
    clock_timestamp() + interval '1 hour',
    3500,
    'eur',
    'acct_pay01_test',
    'cs_pay01_test'
  );

  select result.booking_id, result.was_created
    into v_booking_id, v_was_created
  from public.finalize_stripe_booking(
    v_hold_id,
    v_tenant_id,
    'cs_pay01_test',
    'pi_pay01_test',
    3500,
    'eur',
    'acct_pay01_test'
  ) result;

  if v_booking_id is null or not v_was_created then
    raise exception 'SLOTTA_STRIPE_FINALIZER_DID_NOT_CREATE_BOOKING';
  end if;

  if not exists (
    select 1
    from public.service_bookings b
    where b.id = v_booking_id
      and b.payment_status = 'paid'
      and b.payment_method = 'online'
      and b.price_cents = 3500
      and b.stripe_session_id = 'cs_pay01_test'
      and b.stripe_payment_intent_id = 'pi_pay01_test'
  ) or not exists (
    select 1
    from public.service_booking_holds h
    where h.id = v_hold_id
      and h.status = 'paid'
      and h.stripe_payment_intent_id = 'pi_pay01_test'
  ) then
    raise exception 'SLOTTA_STRIPE_FINALIZER_STATE_INVALID';
  end if;

  select result.booking_id, result.was_created
    into v_booking_id, v_was_created
  from public.finalize_stripe_booking(
    v_hold_id,
    v_tenant_id,
    'cs_pay01_test',
    'pi_pay01_test',
    3500,
    'eur',
    'acct_pay01_test'
  ) result;

  select count(*)
    into v_count
  from public.service_bookings b
  where b.stripe_session_id = 'cs_pay01_test';

  if v_was_created or v_count <> 1 then
    raise exception 'SLOTTA_STRIPE_FINALIZER_NOT_IDEMPOTENT';
  end if;

  insert into public.service_booking_holds (
    id,
    tenant_id,
    service_id,
    staff_id,
    customer_name,
    customer_phone,
    booking_date,
    booking_time,
    status,
    expires_at,
    expected_amount_cents,
    expected_currency,
    stripe_connect_account_id,
    stripe_session_id
  ) values (
    v_mismatch_hold_id,
    v_tenant_id,
    v_service_id,
    v_staff_id,
    'PAY-02 test',
    '00000000',
    date '2099-12-30',
    time '06:00',
    'pending',
    clock_timestamp() + interval '1 hour',
    3500,
    'eur',
    'acct_pay01_test',
    'cs_pay02_test'
  );

  begin
    perform *
    from public.finalize_stripe_booking(
      v_mismatch_hold_id,
      v_tenant_id,
      'cs_pay02_test',
      'pi_pay02_test',
      1,
      'eur',
      'acct_pay01_test'
    );
  exception
    when sqlstate '22023' then
      v_mismatch_blocked := true;
  end;

  if not v_mismatch_blocked then
    raise exception 'SLOTTA_STRIPE_AMOUNT_MISMATCH_WAS_NOT_BLOCKED';
  end if;

  if not exists (
    select 1
    from public.service_booking_holds h
    where h.id = v_mismatch_hold_id
      and h.status = 'pending'
  ) then
    raise exception 'SLOTTA_STRIPE_MISMATCH_CHANGED_HOLD';
  end if;
end
$$;

rollback;
