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

-- No backfill: existing tenants remain opted out and absent from the Marketplace
-- until they explicitly opt in through an approved flow.
