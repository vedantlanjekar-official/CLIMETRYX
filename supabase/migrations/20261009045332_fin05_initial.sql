-- FIN-05 initial schema. Apply only to a dedicated FIN-05 Supabase project.
-- PostGIS is created in schema gis when it is not already installed.
-- If PostGIS already exists in another schema, stop and follow docs/DATABASE.md.
-- Authorization roles live in organization_members, never in user-editable JWT metadata.

create schema if not exists app_private;
create schema if not exists gis;

revoke all on schema app_private from public;
revoke all on schema gis from public;
grant usage on schema app_private to authenticated, service_role;
grant usage on schema gis to authenticated, service_role;

do $$
begin
  if not exists (select 1 from pg_extension where extname = 'postgis') then
    execute 'create extension postgis with schema gis';
  elsif not exists (
    select 1
    from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'postgis' and n.nspname = 'gis'
  ) then
    raise exception 'PostGIS is installed outside schema gis. Do not relocate it in this migration.';
  end if;
end $$;

revoke all on all tables in schema gis from public, anon, authenticated;

create or replace function app_private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function app_private.sync_point()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.latitude is null or new.longitude is null then
    new.geom = null;
  else
    new.geom = gis.st_setsrid(gis.st_makepoint(new.longitude, new.latitude), 4326)::gis.geography;
  end if;
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 160),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'analyst', 'member', 'viewer')),
  status text not null default 'active' check (status in ('active', 'invited', 'suspended')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'analyst', 'member', 'viewer')),
  status text not null default 'pending_manual' check (status in ('pending_manual', 'accepted', 'revoked')),
  invited_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.user_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete cascade,
  consent_type text not null,
  version text not null,
  granted boolean not null,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  actor_id uuid references public.profiles (id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  trading_name text,
  legal_type text,
  registration_country text,
  registration_identifier text,
  country text,
  admin_area text,
  district text,
  city text,
  postal_code text,
  industry text not null default '',
  sub_industry text,
  msme_size_band text,
  established_year integer check (established_year is null or established_year between 1800 and 2100),
  employee_count integer check (employee_count is null or employee_count >= 0),
  employee_band text,
  products_services text,
  customer_types text,
  operating_model text,
  seasonality text,
  objectives text,
  challenges text,
  status text not null default 'active' check (status in ('draft', 'active', 'archived')),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.onboarding_drafts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  business_id uuid references public.businesses (id) on delete set null,
  step integer not null default 1 check (step between 1 and 10),
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table public.business_locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  label text not null,
  site_type text not null check (site_type in ('head_office', 'shop', 'factory', 'warehouse', 'farm', 'processing', 'distribution', 'other')),
  address_line text,
  admin_area text,
  district text,
  city text,
  postal_code text,
  country text,
  latitude numeric(9, 6) check (latitude is null or latitude between -90 and 90),
  longitude numeric(9, 6) check (longitude is null or longitude between -180 and 180),
  geocoder_name text,
  match_quality text,
  crs text not null default 'EPSG:4326',
  geocoded_at timestamptz,
  user_confirmed boolean not null default false,
  accepted_low_precision boolean not null default false,
  site_status text not null default 'active' check (site_status in ('active', 'planned', 'closed')),
  tenure text,
  land_area numeric,
  land_area_unit text,
  building_area numeric,
  activity text,
  criticality text,
  opening_hours text,
  dependencies jsonb not null default '{}'::jsonb,
  resilience_features jsonb not null default '{}'::jsonb,
  geom gis.geography(Point, 4326),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.location_preferences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null,
  region text,
  city text,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  geocoder_name text,
  match_quality text,
  user_confirmed boolean not null default false,
  intended_activity text,
  acquisition_preference text,
  desired_area numeric,
  budget_amount numeric,
  budget_currency char(3),
  decision_date date,
  utility_needs jsonb not null default '{}'::jsonb,
  workforce_requirements text,
  proximity_preferences text,
  max_acceptable_risk text,
  weights jsonb not null default '{}'::jsonb,
  geom gis.geography(Point, 4326),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.operational_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  business_id uuid not null unique references public.businesses (id) on delete cascade,
  capacity text,
  machinery text,
  electricity_critical text not null default 'unknown' check (electricity_critical in ('yes', 'no', 'unknown')),
  water_critical text not null default 'unknown' check (water_critical in ('yes', 'no', 'unknown')),
  cooling_critical text not null default 'unknown' check (cooling_critical in ('yes', 'no', 'unknown')),
  refrigeration text not null default 'unknown' check (refrigeration in ('yes', 'no', 'unknown')),
  network_dependence text,
  transport_dependence text,
  outdoor_workforce text not null default 'unknown' check (outdoor_workforce in ('yes', 'no', 'unknown')),
  perishable_inventory text not null default 'unknown' check (perishable_inventory in ('yes', 'no', 'unknown')),
  inventory_characteristics text,
  seasonal_windows text,
  lead_times text,
  max_tolerable_downtime_hours numeric check (max_tolerable_downtime_hours is null or max_tolerable_downtime_hours >= 0),
  continuity_arrangements text,
  alternative_sites text,
  historical_incidents jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.financial_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  business_id uuid not null unique references public.businesses (id) on delete cascade,
  currency char(3) not null,
  reporting_period text not null check (reporting_period in ('monthly', 'annual')),
  monthly_revenue numeric,
  annual_revenue numeric,
  gross_margin_band text,
  fixed_costs numeric,
  variable_costs numeric,
  payroll numeric,
  rent numeric,
  utilities numeric,
  cash_reserves numeric,
  cash_reserve_band text,
  working_capital numeric,
  debt_service numeric,
  receivables numeric,
  payables numeric,
  inventory_value numeric,
  inventory_sensitivity text,
  insurance_status text,
  insurance_exclusions text,
  expected_downtime_days numeric,
  recovery_cost_estimate numeric,
  seasonality jsonb not null default '{}'::jsonb,
  consent_recorded boolean not null default false,
  updated_at timestamptz not null default now(),
  check (consent_recorded)
);

create table public.monthly_financial_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  year integer not null,
  month integer not null check (month between 1 and 12),
  revenue numeric,
  costs numeric,
  currency char(3) not null,
  source text not null default 'business_reported',
  unique (business_id, year, month)
);

create table public.resilience_measures (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  location_id uuid references public.business_locations (id) on delete cascade,
  measure_key text not null,
  status text not null check (status in ('yes', 'no', 'unknown')),
  notes text,
  unique nulls not distinct (business_id, location_id, measure_key)
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null,
  reference_code text,
  product_supplied text,
  criticality text not null default 'unknown' check (criticality in ('critical', 'important', 'optional', 'unknown')),
  spend_share numeric check (spend_share is null or spend_share between 0 and 1),
  lead_time_days numeric,
  single_source text not null default 'unknown' check (single_source in ('yes', 'no', 'unknown')),
  alternatives text,
  substitution_time_days numeric,
  transport_mode text,
  inventory_buffer_days numeric,
  logistics_dependency text,
  disruption_history text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.supplier_locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  supplier_id uuid not null references public.suppliers (id) on delete cascade,
  address_line text,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  geocoder_name text,
  match_quality text,
  user_confirmed boolean not null default false,
  geom gis.geography(Point, 4326)
);

create table public.supplier_dependencies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  supplier_id uuid not null references public.suppliers (id) on delete cascade,
  input_name text not null,
  criticality text,
  share numeric,
  notes text
);

create table public.property_cost_assumptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  location_id uuid references public.business_locations (id) on delete cascade,
  preference_id uuid references public.location_preferences (id) on delete cascade,
  tenure text,
  site_area numeric,
  purchase_price numeric,
  market_estimate numeric,
  rent_amount numeric,
  rent_period text,
  lease_term_months integer,
  construction_cost numeric,
  renovation_cost numeric,
  preparation_cost numeric,
  utility_connection_cost numeric,
  backup_power_cost numeric,
  cooling_cost numeric,
  water_storage_cost numeric,
  drainage_cost numeric,
  transport_cost numeric,
  maintenance_cost numeric,
  operation_start date,
  escalation_rate numeric,
  currency char(3) not null,
  estimate_date date,
  source text not null,
  assumptions text,
  created_at timestamptz not null default now()
);

create table public.site_feasibility_assessments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null,
  status text not null default 'draft',
  weights jsonb not null default '{}'::jsonb,
  results jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.data_sources (
  id text primary key,
  name text not null,
  kind text not null,
  status text not null,
  docs_url text,
  licence text,
  geography text,
  resolution text,
  attribution text,
  limitations text not null,
  updated_at timestamptz not null default now()
);

create table public.data_ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  source_id text not null references public.data_sources (id),
  status text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  error_summary text,
  checksum text,
  record_count integer,
  metadata jsonb not null default '{}'::jsonb
);

create table public.external_api_cache (
  id uuid primary key default gen_random_uuid(),
  source_id text not null references public.data_sources (id),
  cache_key text not null unique,
  retrieved_at timestamptz not null,
  expires_at timestamptz not null,
  payload jsonb not null,
  licence text not null
);

create table public.weather_forecasts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  location_id uuid references public.business_locations (id) on delete set null,
  supplier_location_id uuid references public.supplier_locations (id) on delete set null,
  latitude numeric(9, 6) not null,
  longitude numeric(9, 6) not null,
  source_id text not null references public.data_sources (id),
  retrieved_at timestamptz not null,
  valid_from date,
  valid_to date,
  timezone text,
  units jsonb not null default '{}'::jsonb,
  model text,
  horizon_days integer,
  payload jsonb not null,
  licence text not null
);

create table public.historical_weather_observations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  location_id uuid references public.business_locations (id) on delete set null,
  source_id text not null references public.data_sources (id),
  retrieved_at timestamptz not null,
  period_start date,
  period_end date,
  payload jsonb not null,
  licence text not null,
  resolution text not null
);

create table public.climate_projection_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  source_id text not null references public.data_sources (id),
  geocode text not null,
  scenario text not null,
  period text not null,
  retrieved_at timestamptz not null,
  coverage_status text not null,
  payload jsonb not null,
  limitations text not null
);

create table public.hazard_indicators (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  assessment_id uuid,
  location_id uuid references public.business_locations (id) on delete set null,
  hazard_type text not null,
  indicator_key text not null,
  score numeric check (score is null or score between 0 and 100),
  status text not null,
  unit text,
  summary text not null,
  limitations text[] not null default '{}',
  provenance jsonb not null default '{}'::jsonb
);

create table public.spatial_exposure_summaries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  location_id uuid references public.business_locations (id) on delete cascade,
  source_id text not null references public.data_sources (id),
  summary text not null,
  resolution text not null,
  used_in_score boolean not null default false,
  limitations text not null
);

create table public.satellite_observations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  location_id uuid references public.business_locations (id) on delete set null,
  assessment_id uuid,
  indicator text not null,
  status text not null,
  value numeric,
  acquisition_time timestamptz,
  product text,
  resolution_m numeric,
  cloud_cover_pct numeric,
  buffer_m numeric,
  formula text,
  limitations text not null,
  provenance jsonb not null default '{}'::jsonb
);

create table public.utility_reliability_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  location_id uuid references public.business_locations (id) on delete cascade,
  utility_type text not null,
  information_origin text not null check (information_origin in ('external_observed', 'business_reported', 'model_estimated', 'hypothetical')),
  description text not null,
  occurred_at timestamptz,
  duration_hours numeric
);

create table public.official_alerts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  source_id text not null references public.data_sources (id),
  event text not null,
  severity text not null,
  issued_at timestamptz not null,
  valid_from timestamptz,
  valid_to timestamptz,
  area text,
  authority text not null,
  payload jsonb not null default '{}'::jsonb
);

create table public.background_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  job_type text not null,
  status text not null,
  payload jsonb not null default '{}'::jsonb,
  result jsonb,
  attempts integer not null default 0,
  error_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.uploaded_data_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  bucket text not null,
  object_path text not null,
  filename text not null,
  content_type text not null,
  size_bytes integer not null check (size_bytes >= 0),
  checksum text,
  status text not null,
  validation_report jsonb not null default '{}'::jsonb,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.risk_assessments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  methodology_version text not null,
  status text not null,
  input_snapshot jsonb not null,
  score numeric check (score is null or score between 0 and 100),
  score_band text,
  evidence_completeness numeric check (evidence_completeness is null or evidence_completeness between 0 and 100),
  previous_assessment_id uuid references public.risk_assessments (id),
  score_delta numeric,
  change_explanation jsonb not null default '{}'::jsonb,
  limitations text[] not null default '{}',
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.hazard_indicators
  add constraint hazard_indicators_assessment_fk
  foreign key (assessment_id) references public.risk_assessments (id) on delete cascade;

alter table public.satellite_observations
  add constraint satellite_observations_assessment_fk
  foreign key (assessment_id) references public.risk_assessments (id) on delete cascade;

create table public.risk_assessment_locations (
  assessment_id uuid not null references public.risk_assessments (id) on delete cascade,
  location_id uuid not null references public.business_locations (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  primary key (assessment_id, location_id)
);

create table public.risk_features (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  assessment_id uuid not null references public.risk_assessments (id) on delete cascade,
  feature_key text not null,
  value numeric,
  unit text,
  source text,
  evidence_type text,
  normalization text,
  contribution numeric
);

create table public.risk_component_scores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  assessment_id uuid not null references public.risk_assessments (id) on delete cascade,
  component text not null,
  score numeric,
  baseline_weight numeric not null,
  effective_weight numeric,
  included boolean not null,
  explanation text not null
);

create table public.assessment_recommendations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  assessment_id uuid not null references public.risk_assessments (id) on delete cascade,
  action text not null,
  evidence text not null,
  dependency text,
  priority text not null,
  benefit text not null,
  cost_status text not null,
  horizon text,
  owner_label text,
  verification_metric text not null,
  status text not null default 'proposed'
);

create table public.risk_alerts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  assessment_id uuid references public.risk_assessments (id) on delete cascade,
  location_id uuid references public.business_locations (id) on delete set null,
  rule text not null,
  severity text not null,
  rationale text not null,
  evidence_origin text not null,
  source_evidence jsonb not null default '{}'::jsonb,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table public.generated_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  assessment_id uuid not null references public.risk_assessments (id) on delete cascade,
  version integer not null default 1,
  content jsonb not null,
  created_at timestamptz not null default now(),
  unique (assessment_id, version)
);

create table public.financial_stress_scenarios (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  assessment_id uuid references public.risk_assessments (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  disruption_days integer not null check (disruption_days in (1, 3, 7, 14)),
  assumptions jsonb not null,
  result jsonb not null,
  hypothetical boolean not null default true check (hypothetical),
  created_at timestamptz not null default now()
);

create index businesses_org_idx on public.businesses (organization_id);
create index locations_business_idx on public.business_locations (business_id);
create index locations_geom_idx on public.business_locations using gist (geom);
create index preferences_geom_idx on public.location_preferences using gist (geom);
create index supplier_locations_geom_idx on public.supplier_locations using gist (geom);
create index assessments_business_idx on public.risk_assessments (business_id, created_at desc);
create index jobs_status_idx on public.background_jobs (organization_id, status);
create index alerts_org_idx on public.risk_alerts (organization_id, created_at desc);

create trigger locations_geom before insert or update of latitude, longitude on public.business_locations
for each row execute function app_private.sync_point();
create trigger preferences_geom before insert or update of latitude, longitude on public.location_preferences
for each row execute function app_private.sync_point();
create trigger supplier_geom before insert or update of latitude, longitude on public.supplier_locations
for each row execute function app_private.sync_point();

create trigger profiles_touch before update on public.profiles
for each row execute function app_private.touch_updated_at();
create trigger organizations_touch before update on public.organizations
for each row execute function app_private.touch_updated_at();
create trigger businesses_touch before update on public.businesses
for each row execute function app_private.touch_updated_at();
create trigger assessments_touch before update on public.risk_assessments
for each row execute function app_private.touch_updated_at();
create trigger jobs_touch before update on public.background_jobs
for each row execute function app_private.touch_updated_at();

create or replace function app_private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app_private.handle_new_user();

create or replace function app_private.is_org_member(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = target
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

create or replace function app_private.has_org_role(target uuid, allowed text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = target
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role = any (allowed)
  );
$$;

create or replace function app_private.organization_has_member(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members m where m.organization_id = target
  );
$$;

create or replace function app_private.is_org_creator(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organizations o where o.id = target and o.created_by = auth.uid()
  );
$$;

grant execute on function app_private.is_org_member(uuid) to authenticated;
grant execute on function app_private.has_org_role(uuid, text[]) to authenticated;
grant execute on function app_private.organization_has_member(uuid) to authenticated;
grant execute on function app_private.is_org_creator(uuid) to authenticated;
revoke all on function app_private.handle_new_user() from public, anon, authenticated;
revoke all on function app_private.sync_point() from public, anon, authenticated;
revoke all on function app_private.touch_updated_at() from public, anon, authenticated;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.invitations enable row level security;
alter table public.user_consents enable row level security;
alter table public.audit_logs enable row level security;
alter table public.businesses enable row level security;
alter table public.onboarding_drafts enable row level security;
alter table public.business_locations enable row level security;
alter table public.location_preferences enable row level security;
alter table public.operational_profiles enable row level security;
alter table public.financial_profiles enable row level security;
alter table public.monthly_financial_records enable row level security;
alter table public.resilience_measures enable row level security;
alter table public.suppliers enable row level security;
alter table public.supplier_locations enable row level security;
alter table public.supplier_dependencies enable row level security;
alter table public.property_cost_assumptions enable row level security;
alter table public.site_feasibility_assessments enable row level security;
alter table public.data_sources enable row level security;
alter table public.data_ingestion_runs enable row level security;
alter table public.external_api_cache enable row level security;
alter table public.weather_forecasts enable row level security;
alter table public.historical_weather_observations enable row level security;
alter table public.climate_projection_records enable row level security;
alter table public.hazard_indicators enable row level security;
alter table public.spatial_exposure_summaries enable row level security;
alter table public.satellite_observations enable row level security;
alter table public.utility_reliability_records enable row level security;
alter table public.official_alerts enable row level security;
alter table public.background_jobs enable row level security;
alter table public.uploaded_data_assets enable row level security;
alter table public.risk_assessments enable row level security;
alter table public.risk_assessment_locations enable row level security;
alter table public.risk_features enable row level security;
alter table public.risk_component_scores enable row level security;
alter table public.assessment_recommendations enable row level security;
alter table public.risk_alerts enable row level security;
alter table public.generated_reports enable row level security;
alter table public.financial_stress_scenarios enable row level security;

alter table public.profiles force row level security;
alter table public.organizations force row level security;
alter table public.organization_members force row level security;
alter table public.businesses force row level security;
alter table public.financial_profiles force row level security;
alter table public.generated_reports force row level security;
alter table public.risk_assessments force row level security;

create policy profiles_select_own on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_update_own on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy organizations_select on public.organizations for select to authenticated using (app_private.is_org_member(id));
create policy organizations_insert on public.organizations for insert to authenticated with check (created_by = auth.uid());
create policy organizations_update on public.organizations for update to authenticated
  using (app_private.has_org_role(id, array['owner', 'admin']))
  with check (app_private.has_org_role(id, array['owner', 'admin']));

create policy members_select on public.organization_members for select to authenticated using (app_private.is_org_member(organization_id) or user_id = auth.uid());
create policy members_insert_self_owner on public.organization_members for insert to authenticated
  with check (
    user_id = auth.uid()
    and role = 'owner'
    and status = 'active'
    and app_private.is_org_creator(organization_id)
    and not app_private.organization_has_member(organization_id)
  );
create policy members_insert_by_admin on public.organization_members for insert to authenticated
  with check (
    app_private.has_org_role(organization_id, array['owner', 'admin'])
    and role <> 'owner'
  );
create policy members_update_by_admin on public.organization_members for update to authenticated
  using (app_private.has_org_role(organization_id, array['owner', 'admin']))
  with check (app_private.has_org_role(organization_id, array['owner', 'admin']) and role <> 'owner');

create policy invitations_select on public.invitations for select to authenticated using (app_private.has_org_role(organization_id, array['owner', 'admin']));
create policy invitations_write on public.invitations for insert to authenticated
  with check (app_private.has_org_role(organization_id, array['owner', 'admin']) and invited_by = auth.uid());

create policy consents_own on public.user_consents for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy audit_select on public.audit_logs for select to authenticated using (app_private.has_org_role(organization_id, array['owner', 'admin']));
create policy audit_insert on public.audit_logs for insert to authenticated with check (app_private.is_org_member(organization_id) and actor_id = auth.uid());

create policy businesses_select on public.businesses for select to authenticated using (app_private.is_org_member(organization_id));
create policy businesses_write on public.businesses for insert to authenticated
  with check (app_private.has_org_role(organization_id, array['owner', 'admin', 'analyst', 'member']) and created_by = auth.uid());
create policy businesses_update on public.businesses for update to authenticated
  using (app_private.has_org_role(organization_id, array['owner', 'admin', 'analyst', 'member']))
  with check (app_private.has_org_role(organization_id, array['owner', 'admin', 'analyst', 'member']));
create policy businesses_delete on public.businesses for delete to authenticated using (app_private.has_org_role(organization_id, array['owner', 'admin']));

create policy drafts_own on public.onboarding_drafts for all to authenticated
  using (user_id = auth.uid() and app_private.is_org_member(organization_id))
  with check (user_id = auth.uid() and app_private.is_org_member(organization_id));

-- Shared org-scoped tables. Financial tables are restricted again below.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'business_locations',
    'location_preferences',
    'operational_profiles',
    'resilience_measures',
    'suppliers',
    'supplier_locations',
    'supplier_dependencies',
    'site_feasibility_assessments',
    'weather_forecasts',
    'historical_weather_observations',
    'climate_projection_records',
    'hazard_indicators',
    'spatial_exposure_summaries',
    'satellite_observations',
    'utility_reliability_records',
    'official_alerts',
    'background_jobs',
    'risk_assessments',
    'risk_assessment_locations',
    'risk_features',
    'risk_component_scores',
    'assessment_recommendations',
    'risk_alerts'
  ]
  loop
    execute format('create policy %I on public.%I for select to authenticated using (app_private.is_org_member(organization_id))', table_name || '_select', table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check (app_private.has_org_role(organization_id, array[''owner'',''admin'',''analyst'',''member'']))', table_name || '_insert', table_name);
    execute format('create policy %I on public.%I for update to authenticated using (app_private.has_org_role(organization_id, array[''owner'',''admin'',''analyst'',''member''])) with check (app_private.has_org_role(organization_id, array[''owner'',''admin'',''analyst'',''member'']))', table_name || '_update', table_name);
    execute format('create policy %I on public.%I for delete to authenticated using (app_private.has_org_role(organization_id, array[''owner'',''admin'']))', table_name || '_delete', table_name);
  end loop;
end $$;

create policy cost_select on public.property_cost_assumptions for select to authenticated using (app_private.has_org_role(organization_id, array['owner', 'admin', 'analyst']));
create policy cost_write on public.property_cost_assumptions for insert to authenticated with check (app_private.has_org_role(organization_id, array['owner', 'admin', 'analyst']));
create policy cost_update on public.property_cost_assumptions for update to authenticated
  using (app_private.has_org_role(organization_id, array['owner', 'admin', 'analyst']))
  with check (app_private.has_org_role(organization_id, array['owner', 'admin', 'analyst']));

create policy uploads_meta_select on public.uploaded_data_assets for select to authenticated using (app_private.has_org_role(organization_id, array['owner', 'admin', 'analyst']));
create policy uploads_meta_write on public.uploaded_data_assets for insert to authenticated
  with check (app_private.has_org_role(organization_id, array['owner', 'admin']) and created_by = auth.uid());

create policy financial_profiles_select on public.financial_profiles for select to authenticated using (app_private.has_org_role(organization_id, array['owner', 'admin', 'analyst']));
create policy financial_profiles_write on public.financial_profiles for insert to authenticated with check (app_private.has_org_role(organization_id, array['owner', 'admin', 'analyst']));
create policy financial_profiles_update on public.financial_profiles for update to authenticated
  using (app_private.has_org_role(organization_id, array['owner', 'admin', 'analyst']))
  with check (app_private.has_org_role(organization_id, array['owner', 'admin', 'analyst']));

create policy monthly_financial_select on public.monthly_financial_records for select to authenticated using (app_private.has_org_role(organization_id, array['owner', 'admin', 'analyst']));
create policy monthly_financial_write on public.monthly_financial_records for insert to authenticated with check (app_private.has_org_role(organization_id, array['owner', 'admin', 'analyst']));

create policy reports_select on public.generated_reports for select to authenticated using (app_private.has_org_role(organization_id, array['owner', 'admin', 'analyst']));
create policy reports_write on public.generated_reports for insert to authenticated with check (app_private.has_org_role(organization_id, array['owner', 'admin', 'analyst']));

create policy stress_select on public.financial_stress_scenarios for select to authenticated using (app_private.has_org_role(organization_id, array['owner', 'admin', 'analyst']));
create policy stress_write on public.financial_stress_scenarios for insert to authenticated with check (app_private.has_org_role(organization_id, array['owner', 'admin', 'analyst']));

create policy data_sources_read on public.data_sources for select to authenticated using (true);
-- external_api_cache has RLS and no authenticated policy, so clients cannot read it.

create policy ingestion_select on public.data_ingestion_runs for select to authenticated
  using (organization_id is null or app_private.has_org_role(organization_id, array['owner', 'admin']));
create policy ingestion_write on public.data_ingestion_runs for insert to authenticated
  with check (app_private.has_org_role(organization_id, array['owner', 'admin']));

insert into public.data_sources (id, name, kind, status, docs_url, licence, geography, resolution, attribution, limitations)
values
  ('open-meteo-forecast', 'Open-Meteo Forecast API', 'forecast_api', 'needs_configuration', 'https://open-meteo.com/en/docs', 'Free API is non-commercial. Commercial use needs a paid plan. Attribute Open-Meteo.', 'Global, model dependent', 'Model grid, not premises', 'Weather data by Open-Meteo.com', 'Forecasts are uncertain. Not an official warning.'),
  ('open-meteo-archive', 'Open-Meteo Historical Weather API', 'historical_api', 'needs_configuration', 'https://open-meteo.com/en/docs/historical-weather-api', 'Same Open-Meteo terms as the forecast API.', 'Global reanalysis', 'ERA5 about 0.25°, ERA5-Land about 0.1°', 'Weather data by Open-Meteo.com', 'Reanalysis is not a station observation at the premises.'),
  ('open-meteo-geocoding', 'Open-Meteo Geocoding API', 'live_api', 'needs_configuration', 'https://open-meteo.com/en/docs/geocoding-api', 'Same Open-Meteo terms.', 'Place names', 'Place match, not rooftop', 'Geocoding by Open-Meteo.com', 'Candidates require user confirmation.'),
  ('world-bank-cckp', 'World Bank Climate Change Knowledge Portal', 'historical_api', 'implemented_unverified', 'https://climateknowledgeportal.worldbank.org/index.php/download-data', 'World Bank dataset terms. Attribute The World Bank.', 'Country, subnational, watershed', 'Aggregated, collection dependent', 'The World Bank: Climate Change Knowledge Portal', 'Projections are not forecasts. Coverage must be checked on each response.'),
  ('world-bank-global-flood-exposure', 'Global Flood Exposure', 'static_raster', 'needs_download', 'https://datacatalog.worldbank.org/search/dataset/0062763/global-flood-exposure-gridded-exposure-headcounts-by-country', 'CC BY 4.0 stated by the catalog.', 'Global', '3 arcseconds', 'World Bank Global Flood Exposure', 'Population exposure for a modelled 1-in-100-year event. Not a business flood probability.'),
  ('copernicus-sentinel-2-l2a', 'Sentinel-2 Level-2A', 'satellite_catalog', 'needs_configuration', 'https://documentation.dataspace.copernicus.eu/APIs/STAC.html', 'Copernicus data policy. Confirm before redistribution.', 'Global', '10 m, 20 m, and 60 m bands', 'Copernicus Sentinel data', 'A catalog item is not NDVI. NDVI is not flood probability or loss.'),
  ('chirps-v3', 'CHIRPS v3', 'batch_dataset', 'needs_download', 'https://www.chc.ucsb.edu/data/chirps3', 'Confirm current CHC citation and licence before redistribution.', '60°N to 60°S', 'About 0.05°', 'Climate Hazards Center, UC Santa Barbara', 'Precipitation only. Not water-supply reliability.'),
  ('chirps-v2-research-citation', 'CHIRPS v2 citation from the research note', 'batch_dataset', 'unavailable', 'https://www.chc.ucsb.edu/data/chirps', 'Research document cited v2. Implementation default is v3.', '50°S to 50°N in the research note', '0.05°', 'Climate Hazards Center', 'Not the default integration. Do not mix v2 and v3 without recording the version.'),
  ('nasa-gpm-imerg', 'NASA GPM IMERG', 'batch_dataset', 'needs_credentials', 'https://gpm.nasa.gov/data/imerg', 'NASA product terms. Earthdata account required for many routes.', 'Near global', 'About 0.1°', 'NASA GPM IMERG', 'Precipitation estimate, not flood depth. Run latency and quality differ.'),
  ('era5-land', 'ERA5-Land', 'batch_dataset', 'needs_credentials', 'https://cds.climate.copernicus.eu/datasets/reanalysis-era5-land', 'CC BY stated for the inspected dataset. Recheck the selected product.', 'Global land', '0.1° / native about 9 km', 'Copernicus Climate Change Service / ECMWF', 'Reanalysis, not an in-situ measurement.'),
  ('wri-aqueduct-4', 'WRI Aqueduct Water Risk Atlas 4.0', 'batch_dataset', 'needs_download', 'https://www.wri.org/data/aqueduct-water-risk-atlas', 'Confirm current Aqueduct 4.0 terms. Older Aqueduct releases used CC BY 4.0.', 'Global basins and administrative units', 'Indicator specific', 'World Resources Institute Aqueduct', 'Regional water-risk context, not a utility outage.'),
  ('global-flood-database', 'Global Flood Database', 'batch_dataset', 'requires_license_check', 'https://www.nature.com/articles/s41597-021-00819-1', 'Download route and redistribution terms were not verified.', 'Selected events, 2000–2018', 'About 250 m', 'Tellman et al. 2021', 'Not a current warning or a complete flood inventory.'),
  ('official-alerts', 'Official meteorological or hydrological warnings', 'live_api', 'needs_configuration', null, 'Only a documented authority feed selected by the operator.', 'Deployment country or region', 'Alert polygon or area', 'Issuing authority', 'No global warning API is assumed. Forecasts are not warnings.'),
  ('utility-reliability', 'Utility reliability', 'future_integration', 'unavailable', null, 'No global public outage API is integrated.', 'Business or utility area', 'Depends on a future authorized feed', 'Business report or named utility', 'Heat or rain is not evidence that a named utility failed.'),
  ('unidentified-organizer-reference-2', 'Unidentified organizer reference', 'future_integration', 'unavailable', null, 'Not identifiable from the supplied research text.', 'Unknown', 'Unknown', 'Unknown', 'The research note says two of three organizer references were absent. They were not guessed.'),
  ('unidentified-organizer-reference-3', 'Unidentified organizer reference', 'future_integration', 'unavailable', null, 'Not identifiable from the supplied research text.', 'Unknown', 'Unknown', 'Unknown', 'The research note says two of three organizer references were absent. They were not guessed.')
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit)
values
  ('business-uploads', 'business-uploads', false, 52428800),
  ('assessment-reports', 'assessment-reports', false, 20971520)
on conflict (id) do nothing;

create policy uploads_select on storage.objects for select to authenticated
using (
  bucket_id = 'business-uploads'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and app_private.is_org_member(((storage.foldername(name))[1])::uuid)
);
create policy uploads_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'business-uploads'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and app_private.has_org_role(((storage.foldername(name))[1])::uuid, array['owner', 'admin', 'analyst'])
);
create policy uploads_update on storage.objects for update to authenticated
using (
  bucket_id = 'business-uploads'
  and app_private.has_org_role(((storage.foldername(name))[1])::uuid, array['owner', 'admin', 'analyst'])
)
with check (
  bucket_id = 'business-uploads'
  and app_private.has_org_role(((storage.foldername(name))[1])::uuid, array['owner', 'admin', 'analyst'])
);
create policy reports_object_select on storage.objects for select to authenticated
using (
  bucket_id = 'assessment-reports'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and app_private.has_org_role(((storage.foldername(name))[1])::uuid, array['owner', 'admin', 'analyst'])
);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'risk_assessments') then
      alter publication supabase_realtime add table public.risk_assessments;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'background_jobs') then
      alter publication supabase_realtime add table public.background_jobs;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'risk_alerts') then
      alter publication supabase_realtime add table public.risk_alerts;
    end if;
  end if;
end $$;
