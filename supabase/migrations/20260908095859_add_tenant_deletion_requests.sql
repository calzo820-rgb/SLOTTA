create table if not exists public.tenant_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  requested_by uuid references auth.users(id) on delete set null,
  status text not null default 'scheduled',
  requested_at timestamptz not null default now(),
  scheduled_for timestamptz not null default (now() + interval '30 days'),
  cancelled_at timestamptz,
  completed_at timestamptz,
  constraint tenant_deletion_requests_status_check
    check (status in ('scheduled', 'cancelled', 'completed')),
  constraint tenant_deletion_requests_dates_check check (
    scheduled_for >= requested_at
    and (cancelled_at is null or cancelled_at >= requested_at)
    and (completed_at is null or completed_at >= requested_at)
  )
);

create unique index if not exists tenant_deletion_requests_one_scheduled_per_tenant
  on public.tenant_deletion_requests (tenant_id)
  where status = 'scheduled';

create index if not exists tenant_deletion_requests_due_idx
  on public.tenant_deletion_requests (scheduled_for)
  where status = 'scheduled';

alter table public.tenant_deletion_requests enable row level security;

revoke all on table public.tenant_deletion_requests from anon, authenticated;
grant select, insert, update, delete on table public.tenant_deletion_requests to service_role;

comment on table public.tenant_deletion_requests is
  'Server-only deletion queue. Requests have a 30-day cooling-off period before manual verified erasure.';
