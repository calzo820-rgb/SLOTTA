-- Run after applying 20260907113106_secure_booking_confirmation_tokens.sql.
-- All test data and temporary tenant changes are rolled back.

begin;

do $$
declare
  v_tenant_id uuid;
  v_service_id uuid;
  v_staff_id uuid;
  v_hold_id uuid := gen_random_uuid();
  v_booking_id uuid;
  v_token_hash text := repeat('a', 64);
begin
  select t.id, s.id, sm.id
    into v_tenant_id, v_service_id, v_staff_id
  from public.tenants t
  join public.services s on s.tenant_id = t.id and s.is_active = true
  join public.staff_members sm on sm.tenant_id = t.id and sm.is_active = true
  where t.is_active = true
  limit 1;

  if v_tenant_id is null then
    raise exception 'DATA-01 requires one active tenant, service and staff member';
  end if;

  insert into public.service_booking_holds (
    id, tenant_id, service_id, staff_id, customer_name, customer_email,
    customer_phone, booking_date, booking_time, status, expires_at,
    stripe_session_id, confirmation_token_hash,
    confirmation_token_expires_at
  ) values (
    v_hold_id, v_tenant_id, v_service_id, v_staff_id, 'DATA-01 test',
    'data01@example.invalid', '00000000', date '2099-12-29', time '06:00',
    'pending', clock_timestamp() + interval '1 hour', 'cs_data01_test',
    v_token_hash, clock_timestamp() + interval '30 days'
  );

  insert into public.service_bookings (
    tenant_id, service_id, staff_id, customer_name, customer_email,
    customer_phone, booking_date, booking_time, status, payment_status,
    stripe_session_id, checkout_pending
  ) values (
    v_tenant_id, v_service_id, v_staff_id, 'DATA-01 test',
    'data01@example.invalid', '00000000', date '2099-12-29', time '06:00',
    'confirmed', 'paid', 'cs_data01_test', false
  ) returning id into v_booking_id;

  if not exists (
    select 1
    from public.service_bookings b
    where b.id = v_booking_id
      and b.confirmation_token_hash = v_token_hash
      and b.confirmation_token_expires_at > clock_timestamp()
      and b.confirmation_token_revoked_at is null
  ) then
    raise exception 'SLOTTA_CONFIRMATION_TOKEN_WAS_NOT_COPIED';
  end if;

  begin
    update public.service_bookings
    set confirmation_token_hash = 'not-a-sha256-hash'
    where id = v_booking_id;
    raise exception 'SLOTTA_INVALID_CONFIRMATION_HASH_WAS_ACCEPTED';
  exception
    when check_violation then null;
  end;
end
$$;

rollback;
