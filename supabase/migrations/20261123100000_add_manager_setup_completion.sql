alter table public.tenants
  add column if not exists setup_completed_at timestamptz;

-- Do not impose the new setup gate on tenants that were already active when
-- this migration is installed. New registrations remain NULL and will see
-- the guide after manual approval.
update public.tenants
set setup_completed_at = now()
where is_active = true
  and setup_completed_at is null;

comment on column public.tenants.setup_completed_at is
  'Timestamp when the owner completed the initial manager setup; NULL means the setup gate is pending.';
