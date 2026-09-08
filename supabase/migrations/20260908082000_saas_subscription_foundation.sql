-- Keep Slotta's own subscription separate from each salon's Stripe Connect account.
alter table public.tenants
  add column if not exists billing_customer_id text,
  add column if not exists billing_subscription_id text,
  add column if not exists billing_status text not null default 'trialing',
  add column if not exists billing_current_period_end timestamptz,
  add column if not exists trial_ends_at timestamptz not null default (now() + interval '14 days'),
  add column if not exists billing_grace_ends_at timestamptz;

alter table public.tenants
  drop constraint if exists tenants_billing_status_check,
  add constraint tenants_billing_status_check check (
    billing_status in ('trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete', 'paused')
  );

create unique index if not exists tenants_billing_customer_id_key
  on public.tenants (billing_customer_id)
  where billing_customer_id is not null;

create unique index if not exists tenants_billing_subscription_id_key
  on public.tenants (billing_subscription_id)
  where billing_subscription_id is not null;

comment on column public.tenants.billing_customer_id is
  'Stripe Customer on the Slotta platform account; never a connected account ID.';
comment on column public.tenants.billing_grace_ends_at is
  'End of the controlled grace period after a failed SaaS subscription payment.';
