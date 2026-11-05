-- Marketplace V1 foundation.
-- This migration is intentionally only prepared in the feature branch.
-- Do not apply it to production until a separate explicit authorization.
--
-- Keep salon identity, address, slug, logo and booking URL in public.tenants.
-- This one-to-one table contains only Marketplace-specific settings and location
-- metadata; it is not a second salon registry.
create table if not exists public.tenant_marketplace (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  opt_in boolean not null default false,
  category text check (
    category is null or category in ('hairdresser', 'barber', 'beauty')
  ),
  description text check (
    description is null or char_length(description) <= 500
  ),
  latitude numeric(8, 6) check (
    latitude is null or latitude between -90 and 90
  ),
  longitude numeric(9, 6) check (
    longitude is null or longitude between -180 and 180
  ),
  geocode_status text not null default 'missing' check (
    geocode_status in ('missing', 'pending', 'geocoded', 'manual', 'failed', 'stale')
  ),
  location_source text check (
    location_source is null or location_source in ('provider', 'manual')
  ),
  geocoded_at timestamptz,
  geocoded_address_hash text check (
    geocoded_address_hash is null or geocoded_address_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint tenant_marketplace_coordinates_pair check (
    (latitude is null) = (longitude is null)
  ),
  constraint tenant_marketplace_location_consistency check (
    (geocode_status in ('geocoded', 'manual') and latitude is not null and longitude is not null)
    or geocode_status not in ('geocoded', 'manual')
  )
);

comment on table public.tenant_marketplace is
  'Optional Marketplace settings for an existing tenant; contains no duplicated salon identity or booking data.';

alter table public.tenant_marketplace enable row level security;
revoke all on table public.tenant_marketplace from public, anon, authenticated;
grant all on table public.tenant_marketplace to service_role;

-- Serialize explicit one-address geocoding requests across Vercel instances.
create table if not exists public.marketplace_geocoding_gate (
  singleton boolean primary key default true check (singleton),
  last_request_at timestamptz
);

insert into public.marketplace_geocoding_gate (singleton, last_request_at)
values (true, null)
on conflict (singleton) do nothing;

alter table public.marketplace_geocoding_gate enable row level security;
revoke all on table public.marketplace_geocoding_gate from public, anon, authenticated;
grant select, update on table public.marketplace_geocoding_gate to service_role;

create or replace function public.marketplace_claim_geocoding_slot()
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_last_request_at timestamptz;
  v_now timestamptz := clock_timestamp();
begin
  select last_request_at into v_last_request_at
  from public.marketplace_geocoding_gate
  where singleton = true
  for update;

  if not found then return false; end if;
  if v_last_request_at is not null
     and v_last_request_at > v_now - interval '1 second' then
    return false;
  end if;

  update public.marketplace_geocoding_gate
  set last_request_at = v_now
  where singleton = true;
  return true;
end;
$$;

revoke all on function public.marketplace_claim_geocoding_slot() from public, anon, authenticated;
grant execute on function public.marketplace_claim_geocoding_slot() to service_role;

-- No backfill: existing tenants remain opted out and absent from the Marketplace
-- until they explicitly opt in through an approved flow.
