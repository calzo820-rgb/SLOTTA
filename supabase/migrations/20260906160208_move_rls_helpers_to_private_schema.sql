-- Keep privileged RLS helpers outside the public Data API schema. PostgreSQL
-- tracks policy dependencies by function OID, so moving the functions updates
-- existing policies without recreating them or changing their behaviour.

create schema if not exists private;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

alter function public.is_tenant_owner(uuid) set schema private;
alter function public.my_role() set schema private;
alter function public.my_tenant_id() set schema private;

alter function private.is_tenant_owner(uuid) set search_path = '';
alter function private.my_role() set search_path = '';
alter function private.my_tenant_id() set search_path = '';

revoke all on function private.is_tenant_owner(uuid) from public, anon;
revoke all on function private.my_role() from public, anon;
revoke all on function private.my_tenant_id() from public, anon;

grant execute on function private.is_tenant_owner(uuid) to authenticated, service_role;
grant execute on function private.my_role() to authenticated, service_role;
grant execute on function private.my_tenant_id() to authenticated, service_role;
