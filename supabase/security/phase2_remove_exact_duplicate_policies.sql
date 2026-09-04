-- Remove policies whose role, command and predicates are byte-for-byte
-- identical to another policy. Effective access remains unchanged.

begin;

-- Duplicates public.bts_select_same_tenant.
drop policy if exists blocked_read on public.blocked_time_slots;

-- Duplicates public."public insert order_items".
drop policy if exists "insert order_items" on public.order_items;

commit;
