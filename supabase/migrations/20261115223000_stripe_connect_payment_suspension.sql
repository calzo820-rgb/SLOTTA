alter table public.tenant_settings
  add column if not exists online_payments_reactivation_required boolean not null default false;

alter table public.tenants
  add column if not exists stripe_connect_status_synced_at timestamptz;

create or replace function public.sync_stripe_connect_account_status(
  p_stripe_account_id text,
  p_details_submitted boolean,
  p_charges_enabled boolean,
  p_payouts_enabled boolean,
  p_disabled_reason text,
  p_requirements jsonb,
  p_observed_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_tenant_id uuid;
  v_previous_ready boolean;
  v_current_ready boolean;
  v_last_synced_at timestamptz;
begin
  if p_stripe_account_id is null or p_stripe_account_id = '' then
    raise exception using errcode = '22023', message = 'SLOTTA_INVALID_STRIPE_ACCOUNT';
  end if;

  select t.id,
         coalesce(t.stripe_connect_charges_enabled, false)
           and coalesce(t.stripe_connect_payouts_enabled, false),
         t.stripe_connect_status_synced_at
    into v_tenant_id, v_previous_ready, v_last_synced_at
  from public.tenants t
  where t.stripe_connect_account_id = p_stripe_account_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'SLOTTA_TENANT_NOT_FOUND';
  end if;

  if p_observed_at is not null
     and v_last_synced_at is not null
     and p_observed_at < v_last_synced_at then
    return v_previous_ready;
  end if;

  v_current_ready := coalesce(p_charges_enabled, false)
    and coalesce(p_payouts_enabled, false);

  update public.tenants
  set stripe_connect_details_submitted = coalesce(p_details_submitted, false),
      stripe_connect_charges_enabled = coalesce(p_charges_enabled, false),
      stripe_connect_payouts_enabled = coalesce(p_payouts_enabled, false),
      stripe_connect_disabled_reason = p_disabled_reason,
      stripe_connect_requirements = p_requirements,
      stripe_connect_status_synced_at = coalesce(p_observed_at, clock_timestamp())
  where id = v_tenant_id
    and stripe_connect_account_id = p_stripe_account_id;

  if v_previous_ready and not v_current_ready then
    insert into public.tenant_settings (
      tenant_id,
      online_payments_reactivation_required
    ) values (
      v_tenant_id,
      true
    )
    on conflict (tenant_id) do update
      set online_payments_reactivation_required = true;
  end if;

  return v_current_ready;
end
$$;

revoke all on function public.sync_stripe_connect_account_status(text, boolean, boolean, boolean, text, jsonb, timestamptz)
  from public, anon, authenticated;
grant execute on function public.sync_stripe_connect_account_status(text, boolean, boolean, boolean, text, jsonb, timestamptz)
  to service_role;

create function public.process_stripe_connect_event(
  p_event_id text,
  p_stripe_account_id text,
  p_details_submitted boolean,
  p_charges_enabled boolean,
  p_payouts_enabled boolean,
  p_disabled_reason text,
  p_requirements jsonb,
  p_observed_at timestamptz
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

  perform public.sync_stripe_connect_account_status(
    p_stripe_account_id,
    p_details_submitted,
    p_charges_enabled,
    p_payouts_enabled,
    p_disabled_reason,
    p_requirements,
    p_observed_at
  );

  return true;
end
$$;

revoke all on function public.process_stripe_connect_event(text, text, boolean, boolean, boolean, text, jsonb, timestamptz)
  from public, anon, authenticated;
grant execute on function public.process_stripe_connect_event(text, text, boolean, boolean, boolean, text, jsonb, timestamptz)
  to service_role;

-- Backward-compatible wrapper for webhook requests from the previous app
-- version while the database migration and application deployment roll out.
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
language sql
security definer
set search_path = pg_catalog
as $$
  select public.process_stripe_connect_event(
    p_event_id,
    p_stripe_account_id,
    p_details_submitted,
    p_charges_enabled,
    p_payouts_enabled,
    p_disabled_reason,
    p_requirements,
    clock_timestamp()
  );
$$;

revoke all on function public.process_stripe_connect_event(text, text, boolean, boolean, boolean, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.process_stripe_connect_event(text, text, boolean, boolean, boolean, text, jsonb)
  to service_role;

create or replace function public.confirm_tenant_online_payment_reactivation(
  p_tenant_id uuid,
  p_stripe_account_id text,
  p_payment_mode text default null
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_account_id text;
  v_tenant_id uuid;
  v_charges_enabled boolean;
  v_payouts_enabled boolean;
  v_reactivation_required boolean;
  v_saved_mode text;
begin
  if p_tenant_id is null or p_stripe_account_id is null or p_stripe_account_id = '' then
    raise exception using errcode = '22023', message = 'SLOTTA_INVALID_REACTIVATION_REQUEST';
  end if;

  if p_payment_mode is not null and p_payment_mode not in ('online', 'client_choice') then
    raise exception using errcode = '22023', message = 'SLOTTA_INVALID_PAYMENT_MODE';
  end if;

  select t.stripe_connect_account_id,
         coalesce(t.stripe_connect_charges_enabled, false),
         coalesce(t.stripe_connect_payouts_enabled, false),
         t.id
    into v_account_id, v_charges_enabled, v_payouts_enabled, v_tenant_id
  from public.tenants t
  where t.id = p_tenant_id
  for update;

  if not found
     or v_account_id is distinct from p_stripe_account_id
     or not v_charges_enabled
     or not v_payouts_enabled then
    return false;
  end if;

  select coalesce(s.online_payments_reactivation_required, false),
         coalesce(s.payment_mode_default, 'in_person')
    into v_reactivation_required, v_saved_mode
  from public.tenant_settings s
  where s.tenant_id = v_tenant_id
  for update;

  if not found then return false; end if;

  if p_payment_mode is null and v_saved_mode not in ('online', 'client_choice') then
    return false;
  end if;

  if p_payment_mode is null and not v_reactivation_required then
    return true;
  end if;

  update public.tenant_settings
  set online_payments_reactivation_required = false,
      payment_mode_default = coalesce(p_payment_mode, v_saved_mode)
  where tenant_id = p_tenant_id;

  return true;
end
$$;

revoke all on function public.confirm_tenant_online_payment_reactivation(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.confirm_tenant_online_payment_reactivation(uuid, text, text)
  to service_role;
