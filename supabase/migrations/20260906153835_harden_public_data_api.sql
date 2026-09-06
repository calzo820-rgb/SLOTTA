-- Public booking data is served by trusted Next.js routes. Browser clients no
-- longer need direct anonymous access to database tables.

drop policy if exists service_bookings_public_insert on public.service_bookings;
drop policy if exists tenants_public_read on public.tenants;
drop policy if exists tenant_settings_public_read on public.tenant_settings;
drop policy if exists tenant_hours_public_read on public.tenant_hours;
drop policy if exists services_public_read_active on public.services;
drop policy if exists staff_hours_public_read on public.staff_hours;
drop policy if exists closures_public_read on public.closures;

create policy tenants_member_select on public.tenants
  for select to authenticated
  using (exists (
    select 1 from public.tenant_users tu
    where tu.user_id = (select auth.uid()) and tu.tenant_id = tenants.id
      and coalesce(tu.is_active, true) = true
  ));

create policy tenant_settings_member_select on public.tenant_settings
  for select to authenticated
  using (exists (
    select 1 from public.tenant_users tu
    where tu.user_id = (select auth.uid())
      and tu.tenant_id = tenant_settings.tenant_id
      and coalesce(tu.is_active, true) = true
  ));

create policy tenant_hours_member_select on public.tenant_hours
  for select to authenticated
  using (exists (
    select 1 from public.tenant_users tu
    where tu.user_id = (select auth.uid())
      and tu.tenant_id = tenant_hours.tenant_id
      and coalesce(tu.is_active, true) = true
  ));

drop policy if exists services_authenticated_read on public.services;
create policy services_member_select on public.services
  for select to authenticated
  using (exists (
    select 1 from public.tenant_users tu
    where tu.user_id = (select auth.uid()) and tu.tenant_id = services.tenant_id
      and coalesce(tu.is_active, true) = true
  ));

create policy staff_hours_member_select on public.staff_hours
  for select to authenticated
  using (exists (
    select 1 from public.tenant_users tu
    where tu.user_id = (select auth.uid())
      and tu.tenant_id = staff_hours.tenant_id
      and coalesce(tu.is_active, true) = true
  ));

create policy closures_member_select on public.closures
  for select to authenticated
  using (exists (
    select 1 from public.tenant_users tu
    where tu.user_id = (select auth.uid()) and tu.tenant_id = closures.tenant_id
      and coalesce(tu.is_active, true) = true
  ));

-- Manual dashboard bookings stay available to active tenant members. Public
-- bookings are inserted only by server routes using the service role.
create policy service_bookings_member_insert on public.service_bookings
  for insert to authenticated
  with check (exists (
    select 1 from public.tenant_users tu
    where tu.user_id = (select auth.uid())
      and tu.tenant_id = service_bookings.tenant_id
      and coalesce(tu.is_active, true) = true
  ));

-- Data API least privilege. RLS remains enabled as defense in depth.
revoke all privileges on all tables in schema public from anon;
revoke truncate, references, trigger on all tables in schema public
  from authenticated;
revoke all privileges on table
  public.push_subscriptions,
  public.service_booking_holds,
  public.tester_leads
from authenticated;
