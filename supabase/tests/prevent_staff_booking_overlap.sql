-- Run after applying 20260906081358_prevent_staff_booking_overlap.sql.
-- Every test row is rolled back, including successful inserts.

begin;

do $verification$
declare
  test_tenant uuid;
  test_service uuid;
  test_staff uuid;
  test_duration integer;
  test_date date := current_date + interval '100 years';
  test_session text := 'slotta-atomic-test-' || txid_current()::text;
  booking_overlap_blocked boolean := false;
  hold_overlap_blocked boolean := false;
begin
  select s.tenant_id, s.id, sm.id, s.duration_minutes
    into test_tenant, test_service, test_staff, test_duration
  from public.services s
  join public.staff_members sm on sm.tenant_id = s.tenant_id
  where s.is_active and sm.is_active
  order by s.created_at, sm.position
  limit 1;

  if test_tenant is null then
    raise exception 'SLOTTA_TEST_FIXTURE_MISSING';
  end if;

  insert into public.service_bookings (
    tenant_id,
    service_id,
    staff_id,
    customer_name,
    booking_date,
    booking_time,
    status,
    payment_status,
    checkout_pending
  ) values (
    test_tenant,
    test_service,
    test_staff,
    'Atomic guard test',
    test_date,
    '09:00:00',
    'confirmed',
    'unpaid',
    false
  );

  begin
    insert into public.service_bookings (
      tenant_id,
      service_id,
      staff_id,
      customer_name,
      booking_date,
      booking_time,
      status,
      payment_status,
      checkout_pending
    ) values (
      test_tenant,
      test_service,
      test_staff,
      'Must be blocked',
      test_date,
      '09:01:00',
      'confirmed',
      'unpaid',
      false
    );
  exception when exclusion_violation then
    booking_overlap_blocked := true;
  end;

  if not booking_overlap_blocked then
    raise exception 'SLOTTA_BOOKING_OVERLAP_WAS_NOT_BLOCKED';
  end if;

  -- An appointment starting exactly when the first one ends is allowed.
  insert into public.service_bookings (
    tenant_id,
    service_id,
    staff_id,
    customer_name,
    booking_date,
    booking_time,
    status,
    payment_status,
    checkout_pending
  ) values (
    test_tenant,
    test_service,
    test_staff,
    'Adjacent is allowed',
    test_date,
    (time '09:00:00' + make_interval(mins => test_duration))::text,
    'confirmed',
    'unpaid',
    false
  );

  begin
    insert into public.service_booking_holds (
      tenant_id,
      service_id,
      staff_id,
      customer_name,
      customer_phone,
      booking_date,
      booking_time,
      status,
      expires_at
    ) values (
      test_tenant,
      test_service,
      test_staff,
      'Hold must be blocked',
      '00000000',
      test_date,
      time '09:01:00',
      'pending',
      clock_timestamp() + interval '30 minutes'
    );
  exception when exclusion_violation then
    hold_overlap_blocked := true;
  end;

  if not hold_overlap_blocked then
    raise exception 'SLOTTA_HOLD_OVERLAP_WAS_NOT_BLOCKED';
  end if;

  -- Stripe must be able to convert its own hold into the final booking.
  insert into public.service_booking_holds (
    tenant_id,
    service_id,
    staff_id,
    customer_name,
    customer_phone,
    booking_date,
    booking_time,
    stripe_session_id,
    status,
    expires_at
  ) values (
    test_tenant,
    test_service,
    test_staff,
    'Stripe conversion test',
    '00000000',
    test_date,
    time '12:00:00',
    test_session,
    'pending',
    clock_timestamp() + interval '30 minutes'
  );

  insert into public.service_bookings (
    tenant_id,
    service_id,
    staff_id,
    customer_name,
    booking_date,
    booking_time,
    stripe_session_id,
    status,
    payment_status,
    checkout_pending
  ) values (
    test_tenant,
    test_service,
    test_staff,
    'Stripe conversion test',
    test_date,
    '12:00:00',
    test_session,
    'confirmed',
    'paid',
    false
  );
end
$verification$;

rollback;

