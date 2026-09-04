-- Slotta phase 1 database hardening.
-- Intentionally limited to legacy tables unused by the current booking app,
-- view execution mode, function grants/search paths, and duplicate indexes.
-- Review and apply to Supabase only after application-flow verification.

begin;

-- Legacy restaurant tables live in the exposed public schema. Enabling RLS
-- closes Data API access unless an explicit policy permits it. The current
-- Slotta source does not query these tables.
alter table public.tables enable row level security;
alter table public.table_sessions enable row level security;
alter table public.product_addons enable row level security;
alter table public.order_slot_allocations enable row level security;
alter table public.order_counters enable row level security;

-- These legacy membership tables are not used by the current app, which uses
-- public.tenant_users. Keep them inaccessible through the Data API.
alter table public.profiles enable row level security;
alter table public.tenant_memberships enable row level security;

-- Make the view respect the caller and the RLS policies on its source tables.
alter view public.my_memberships set (security_invoker = true);

-- Pin function resolution to trusted schemas.
alter function public.set_updated_at() set search_path = pg_catalog;
alter function public.next_order_number(uuid) set search_path = public, pg_catalog;

-- Trigger/internal functions are not public RPC endpoints.
revoke execute on function public.sync_profile() from public, anon, authenticated;
revoke execute on function public.pick_available_staff(uuid, date, text, uuid)
  from public, anon, authenticated;
grant execute on function public.sync_profile() to service_role;
grant execute on function public.pick_available_staff(uuid, date, text, uuid)
  to service_role;

-- Authorization helpers remain callable by authenticated users because active
-- RLS policies depend on them, but unauthenticated RPC access is removed.
revoke execute on function public.is_tenant_owner(uuid) from public, anon;
revoke execute on function public.my_tenant_id() from public, anon;
revoke execute on function public.my_role() from public, anon;
grant execute on function public.is_tenant_owner(uuid) to authenticated, service_role;
grant execute on function public.my_tenant_id() to authenticated, service_role;
grant execute on function public.my_role() to authenticated, service_role;

-- Keep the public booking catalogue independent from authenticated helper
-- functions. Anonymous visitors see active services only; authenticated tenant
-- users can additionally see their own inactive services in the admin area.
drop policy if exists services_public_read_active on public.services;
drop policy if exists services_authenticated_read on public.services;
create policy services_public_read_active
  on public.services
  for select
  to anon
  using (is_active = true);
create policy services_authenticated_read
  on public.services
  for select
  to authenticated
  using (is_active = true or tenant_id = public.my_tenant_id());

-- Remove only byte-for-byte duplicate indexes reported by Database Advisor.
drop index if exists public.idx_blocked_time_slots_tenant_day;
drop index if exists public.idx_orders_type;
drop index if exists public.idx_service_booking_holds_stripe_session;
drop index if exists public.idx_service_bookings_session;
drop index if exists public.idx_service_bookings_stripe_session;
drop index if exists public.tenant_users_tenant_username_unique;

commit;
