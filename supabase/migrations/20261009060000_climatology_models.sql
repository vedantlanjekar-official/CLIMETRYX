-- Location-fitted climatology models (ERA5 1991–2020) cached per organization and 0.25° grid cell.
-- Coordinates are snapped to the ERA5 grid, so exact business locations are not stored here.

create table public.climatology_models (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  grid_latitude numeric(6, 2) not null check (grid_latitude between -90 and 90),
  grid_longitude numeric(6, 2) not null check (grid_longitude between -180 and 180),
  version text not null,
  baseline_start date not null,
  baseline_end date not null,
  source_id text not null references public.data_sources (id),
  model jsonb not null,
  validation jsonb,
  fitted_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (organization_id, grid_latitude, grid_longitude, version)
);

create index climatology_models_org_idx on public.climatology_models (organization_id);

alter table public.climatology_models enable row level security;

create policy climatology_models_select on public.climatology_models for select to authenticated
  using (app_private.is_org_member(organization_id));
create policy climatology_models_insert on public.climatology_models for insert to authenticated
  with check (app_private.has_org_role(organization_id, array['owner', 'admin', 'analyst', 'member']));
create policy climatology_models_delete on public.climatology_models for delete to authenticated
  using (app_private.has_org_role(organization_id, array['owner', 'admin']));

insert into public.data_sources (id, name, kind, status, docs_url, licence, geography, resolution, attribution, limitations)
values (
  'open-meteo-era5-climatology',
  'ERA5 1991–2020 climatology via Open-Meteo',
  'historical_api',
  'verified',
  'https://open-meteo.com/en/docs/historical-weather-api',
  'Open-Meteo free API is non-commercial. ERA5 is Copernicus Climate Change Service data; attribute both.',
  'Global',
  'ERA5 about 0.25°',
  'Weather data by Open-Meteo.com; contains modified Copernicus Climate Change Service information',
  'Reanalysis grid statistics, not station records at the premises. Percentile and SPI fits describe what is unusual for the area.'
)
on conflict (id) do nothing;

update public.data_sources
set status = 'verified', updated_at = now()
where id in ('open-meteo-forecast', 'open-meteo-archive', 'open-meteo-geocoding');
