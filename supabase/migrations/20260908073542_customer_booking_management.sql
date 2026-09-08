-- Allow customers to manage an individual booking through an opaque token.
-- Only the SHA-256 hash is stored and all mutations continue to pass through
-- server-side routes using the service role.

alter table public.tenant_settings
  add column if not exists customer_cancellation_notice_hours integer
    not null default 24;

alter table public.tenant_settings
  drop constraint if exists tenant_settings_customer_cancellation_notice_check,
  add constraint tenant_settings_customer_cancellation_notice_check
    check (customer_cancellation_notice_hours between 0 and 168);

alter table public.service_bookings
  add column if not exists management_token_hash text,
  add column if not exists management_token_expires_at timestamptz,
  add column if not exists customer_cancelled_at timestamptz;

alter table public.service_bookings
  drop constraint if exists service_bookings_management_token_hash_check,
  add constraint service_bookings_management_token_hash_check
    check (
      management_token_hash is null
      or management_token_hash ~ '^[0-9a-f]{64}$'
    );

create unique index if not exists service_bookings_management_token_hash_key
  on public.service_bookings (management_token_hash)
  where management_token_hash is not null;

comment on column public.tenant_settings.customer_cancellation_notice_hours is
  'Minimum notice in hours required for a customer self-service cancellation.';

comment on column public.service_bookings.management_token_hash is
  'SHA-256 hash of the opaque customer management token; raw tokens are never stored.';

comment on column public.service_bookings.customer_cancelled_at is
  'Timestamp set only when the customer cancels through the self-service flow.';
