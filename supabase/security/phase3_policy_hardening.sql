-- Slotta phase 3 database hardening.
-- Restricts staff-management writes to tenant owners, removes redundant
-- permissive policies, and adds missing indexes used by current Slotta tables.
--
-- Apply through the Supabase migration workflow after this PR is merged.

begin;

-- The owner-only policies already present below are the authoritative write
-- rules for staff_members. These broader policies allowed any active tenant
-- user (including staff accounts) to create, update, or delete operators.
drop policy if exists "staff insert own tenant" on public.staff_members;
drop policy if exists "staff update own tenant" on public.staff_members;
drop policy if exists "staff delete own tenant" on public.staff_members;

-- Authenticated tenant staff still need read access to operators for calendar
-- and booking views. Recreate the read rule with a single-evaluation auth.uid().
drop policy if exists "staff select own tenant" on public.staff_members;
create policy "staff select own tenant"
  on public.staff_members
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.tenant_users tu
      where tu.tenant_id = staff_members.tenant_id
        and tu.user_id = (select auth.uid())
        and coalesce(tu.is_active, true) = true
    )
  );

-- Consolidate blocked_time_slots rules. Effective access remains:
-- active tenant users can read; owner/staff can manage their tenant's blocks.
drop policy if exists "manage blocks owner" on public.blocked_time_slots;
drop policy if exists "read blocks by tenant" on public.blocked_time_slots;
drop policy if exists bts_insert_same_tenant on public.blocked_time_slots;
drop policy if exists bts_update_same_tenant on public.blocked_time_slots;
drop policy if exists bts_delete_same_tenant on public.blocked_time_slots;

drop policy if exists bts_select_same_tenant on public.blocked_time_slots;
create policy bts_select_same_tenant
  on public.blocked_time_slots
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.tenant_users tu
      where tu.user_id = (select auth.uid())
        and tu.tenant_id = blocked_time_slots.tenant_id
        and coalesce(tu.is_active, true) = true
    )
  );

drop policy if exists blocked_insert on public.blocked_time_slots;
create policy blocked_insert
  on public.blocked_time_slots
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.tenant_users tu
      where tu.user_id = (select auth.uid())
        and tu.tenant_id = blocked_time_slots.tenant_id
        and coalesce(tu.is_active, true) = true
        and tu.role in ('owner', 'staff')
    )
  );

drop policy if exists blocked_update on public.blocked_time_slots;
create policy blocked_update
  on public.blocked_time_slots
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.tenant_users tu
      where tu.user_id = (select auth.uid())
        and tu.tenant_id = blocked_time_slots.tenant_id
        and coalesce(tu.is_active, true) = true
        and tu.role in ('owner', 'staff')
    )
  )
  with check (
    exists (
      select 1
      from public.tenant_users tu
      where tu.user_id = (select auth.uid())
        and tu.tenant_id = blocked_time_slots.tenant_id
        and coalesce(tu.is_active, true) = true
        and tu.role in ('owner', 'staff')
    )
  );

drop policy if exists blocked_delete on public.blocked_time_slots;
create policy blocked_delete
  on public.blocked_time_slots
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.tenant_users tu
      where tu.user_id = (select auth.uid())
        and tu.tenant_id = blocked_time_slots.tenant_id
        and coalesce(tu.is_active, true) = true
        and tu.role in ('owner', 'staff')
    )
  );

-- Avoid per-row re-evaluation in simple ownership policies.
drop policy if exists memberships_select_own on public.memberships;
create policy memberships_select_own
  on public.memberships
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists tu_select_self on public.tenant_users;
create policy tu_select_self
  on public.tenant_users
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists staff_permissions_select_own on public.staff_permissions;
create policy staff_permissions_select_own
  on public.staff_permissions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Cover foreign keys used by Slotta's notification, hold and staff-hours paths.
create index if not exists push_subscriptions_tenant_id_idx
  on public.push_subscriptions (tenant_id);
create index if not exists service_booking_holds_service_id_idx
  on public.service_booking_holds (service_id);
create index if not exists service_booking_holds_staff_id_idx
  on public.service_booking_holds (staff_id);
create index if not exists staff_hours_tenant_id_idx
  on public.staff_hours (tenant_id);

commit;
