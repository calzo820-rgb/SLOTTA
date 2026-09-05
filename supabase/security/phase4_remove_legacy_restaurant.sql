-- Permanently remove the unused legacy restaurant schema.
-- Current Slotta uses tenant_users, staff_members, services, service_bookings,
-- service_booking_holds and the related scheduling/payment tables instead.
--
-- Inventory before removal (2026-09-05):
-- all restaurant tables were empty; public.profiles contained two obsolete
-- mirror rows. Dropping profiles does not delete auth.users accounts.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Legacy auth mirror objects.
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.sync_profile();
drop view if exists public.my_memberships;

-- Restaurant order-number helper.
drop function if exists public.next_order_number(uuid);

-- Drop dependants before their parent tables. Avoid CASCADE so any unexpected
-- dependency aborts the migration instead of removing an unrelated object.
drop table if exists public.order_items;
drop table if exists public.order_slot_allocations;
drop table if exists public.orders;
drop table if exists public.table_sessions;
drop table if exists public.tables;
drop table if exists public.product_addons;
drop table if exists public.products;
drop table if exists public.tenant_addons;
drop table if exists public.order_counters;
drop table if exists public.payment_settings;
drop table if exists public.slot_blocks;

-- Unused membership/profile model from the same legacy application.
-- Slotta authorization is based on public.tenant_users.
drop table if exists public.staff_permissions;
drop table if exists public.memberships;
drop table if exists public.tenant_memberships;
drop table if exists public.profiles;

-- Enum types were only referenced by the objects removed above.
drop type if exists public.order_type;
drop type if exists public.tenant_role;
drop type if exists public.user_role;

commit;
