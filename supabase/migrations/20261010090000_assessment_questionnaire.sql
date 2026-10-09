-- CLIMETRYX business assessment: question registry, versioned inputs, job progress.
-- Additive only. Existing tables gain nullable or defaulted columns; no data is removed.
-- Entity tables (locations, preferences, suppliers) are upserted by client_row_id and
-- soft-removed with removed_at. Event-style rows are scoped to an input version.

-- Question registry ---------------------------------------------------------

create table public.assessment_templates (
  key text not null,
  version text not null,
  status text not null default 'active' check (status in ('active', 'retired')),
  step_count integer not null check (step_count > 0),
  question_count integer not null check (question_count > 0),
  published_at timestamptz not null default now(),
  primary key (key, version)
);

create table public.question_definitions (
  template_key text not null,
  template_version text not null,
  question_path text not null,
  step_id text not null,
  step_number integer not null,
  label text not null,
  question_type text not null,
  unit text,
  required boolean not null,
  level text not null check (level in ('A', 'B')),
  source_category text not null,
  sensitivity text not null check (sensitivity in ('internal', 'confidential', 'restricted_financial')),
  dimensions text[] not null,
  persistence_table text not null,
  persistence_column text not null,
  material boolean not null,
  display_order integer not null,
  definition jsonb not null,
  primary key (template_key, template_version, question_path),
  foreign key (template_key, template_version) references public.assessment_templates (key, version) on delete cascade
);

-- Drafts ----------------------------------------------------------------------

alter table public.onboarding_drafts drop constraint if exists onboarding_drafts_step_check;
alter table public.onboarding_drafts add constraint onboarding_drafts_step_check check (step between 1 and 15);
alter table public.onboarding_drafts
  add column revision integer not null default 1 check (revision >= 1),
  add column template_version text,
  add column current_step text,
  add column status text not null default 'draft' check (status in ('draft', 'submitted')),
  add column created_at timestamptz not null default now();

-- Versioned inputs ------------------------------------------------------------

create table public.assessment_input_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  version_number integer not null check (version_number >= 1),
  template_key text not null,
  template_version text not null,
  methodology_version text not null,
  level text not null check (level in ('A', 'B')),
  answers jsonb not null,
  answers_hash text not null,
  completeness jsonb not null default '{}'::jsonb,
  changed_fields text[] not null default '{}',
  material_changes text[] not null default '{}',
  previous_version_id uuid references public.assessment_input_versions (id),
  submitted_by uuid not null references public.profiles (id),
  submitted_at timestamptz not null default now(),
  unique (business_id, version_number)
);

create table public.assessment_input_financials (
  input_version_id uuid primary key references public.assessment_input_versions (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  answers jsonb not null,
  created_at timestamptz not null default now()
);

create table public.assessment_missing_data (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  input_version_id uuid not null references public.assessment_input_versions (id) on delete cascade,
  step_id text not null,
  question_path text not null,
  row_id text,
  dimension text not null,
  reason text not null check (reason in ('unanswered', 'unknown'))
);

-- New domain tables ---------------------------------------------------------

create table public.business_incidents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  input_version_id uuid not null references public.assessment_input_versions (id) on delete cascade,
  location_id uuid references public.business_locations (id) on delete set null,
  hazard_type text not null check (hazard_type in ('flood', 'heat', 'drought', 'storm', 'power_outage', 'supplier_disruption', 'other')),
  occurred_on date not null,
  duration_hours numeric check (duration_hours is null or duration_hours >= 0),
  impacts text[] not null default '{}',
  recovery_days numeric check (recovery_days is null or recovery_days >= 0),
  estimated_loss numeric check (estimated_loss is null or estimated_loss >= 0),
  loss_currency char(3),
  insurance_claim_paid text check (insurance_claim_paid is null or insurance_claim_paid in ('yes', 'no', 'unknown')),
  evidence_type text not null,
  description text,
  information_origin text not null default 'business_reported' check (information_origin = 'business_reported'),
  created_at timestamptz not null default now()
);

create table public.business_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  input_version_id uuid not null references public.assessment_input_versions (id) on delete cascade,
  location_id uuid references public.business_locations (id) on delete set null,
  asset_type text not null check (asset_type in ('machinery', 'inventory', 'building', 'vehicle', 'it_equipment', 'cold_storage', 'other')),
  description text not null,
  replacement_value numeric check (replacement_value is null or replacement_value >= 0),
  currency char(3),
  value_basis text check (value_basis is null or value_basis in ('invoice', 'insurance_valuation', 'quotation', 'estimate')),
  at_or_below_ground text check (at_or_below_ground is null or at_or_below_ground in ('yes', 'no', 'unknown')),
  temperature_sensitive text check (temperature_sensitive is null or temperature_sensitive in ('yes', 'no', 'unknown')),
  created_at timestamptz not null default now()
);

create table public.hazard_sensitivity_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  input_version_id uuid not null references public.assessment_input_versions (id) on delete cascade,
  hazard text not null check (hazard in ('flood', 'heat', 'drought', 'storm', 'other')),
  responses jsonb not null default '{}'::jsonb,
  user_threshold numeric,
  threshold_unit text,
  unique (input_version_id, hazard)
);

create table public.monitoring_preferences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  business_id uuid not null unique references public.businesses (id) on delete cascade,
  input_version_id uuid references public.assessment_input_versions (id) on delete set null,
  enabled boolean not null default false,
  hazards text[] not null default '{}',
  channels text[] not null default '{}',
  responsible_role text,
  thresholds jsonb not null default '{}'::jsonb,
  reassessment_frequency text check (reassessment_frequency is null or reassessment_frequency in ('quarterly', 'semiannual', 'annual', 'on_change')),
  next_reassessment_due date,
  updated_at timestamptz not null default now()
);

-- Extensions to existing tables ----------------------------------------------

alter table public.business_locations
  add column is_primary boolean not null default false,
  add column lowest_occupied_level text check (lowest_occupied_level is null or lowest_occupied_level in ('basement', 'ground', 'raised', 'mixed', 'unknown')),
  add column staff_count integer check (staff_count is null or staff_count >= 0),
  add column client_row_id text,
  add column removed_at timestamptz,
  add constraint business_locations_client_row_unique unique (business_id, client_row_id);

alter table public.location_preferences
  add column client_row_id text,
  add column removed_at timestamptz,
  add constraint location_preferences_client_row_unique unique (business_id, client_row_id);

alter table public.suppliers
  add column client_row_id text,
  add column removed_at timestamptz,
  add constraint suppliers_client_row_unique unique (business_id, client_row_id);

alter table public.supplier_locations
  add column client_row_id text,
  add constraint supplier_locations_client_row_unique unique (supplier_id, client_row_id);

alter table public.operational_profiles
  add column details jsonb not null default '{}'::jsonb,
  add column input_version_id uuid references public.assessment_input_versions (id) on delete set null;

alter table public.financial_profiles
  add column period_start date,
  add column period_end date,
  add column figures_basis text check (figures_basis is null or figures_basis in ('audited', 'management', 'tax_return', 'estimate')),
  add column undrawn_credit numeric check (undrawn_credit is null or undrawn_credit >= 0),
  add column lost_revenue_share numeric check (lost_revenue_share is null or lost_revenue_share between 0 and 100),
  add column continuing_fixed_share numeric check (continuing_fixed_share is null or continuing_fixed_share between 0 and 100),
  add column input_version_id uuid references public.assessment_input_versions (id) on delete set null,
  add constraint financial_profiles_period_order check (period_start is null or period_end is null or period_end > period_start);

alter table public.resilience_measures
  add column implementation_status text check (implementation_status is null or implementation_status in ('implemented', 'partial', 'planned', 'not_in_place', 'not_applicable', 'unknown')),
  add column hazards text[] not null default '{}',
  add column last_tested date,
  add column evidence_type text,
  add column input_version_id uuid references public.assessment_input_versions (id) on delete set null;

alter table public.utility_reliability_records
  add column outage_frequency_band text check (outage_frequency_band is null or outage_frequency_band in ('none', 'yearly', 'monthly', 'weekly', 'daily', 'unknown')),
  add column typical_duration_hours numeric check (typical_duration_hours is null or typical_duration_hours >= 0),
  add column backup_level text check (backup_level is null or backup_level in ('none', 'partial', 'full')),
  add column backup_runtime_hours numeric check (backup_runtime_hours is null or backup_runtime_hours >= 0),
  add column evidence_type text,
  add column input_version_id uuid references public.assessment_input_versions (id) on delete cascade;

alter table public.property_cost_assumptions
  add column cost_item text,
  add column description text,
  add column amount numeric check (amount is null or amount >= 0),
  add column cost_nature text check (cost_nature is null or cost_nature in ('capex', 'opex')),
  add column recurrence text check (recurrence is null or recurrence in ('monthly', 'quarterly', 'annual')),
  add column estimate_type text check (estimate_type is null or estimate_type in ('quotation', 'internal_estimate', 'published_rate', 'assumption')),
  add column valid_until date,
  add column input_version_id uuid references public.assessment_input_versions (id) on delete cascade;

alter table public.uploaded_data_assets
  add column business_id uuid references public.businesses (id) on delete set null,
  add column document_type text,
  add column related_step text,
  add column removed_at timestamptz;

alter table public.user_consents
  add column input_version_id uuid references public.assessment_input_versions (id) on delete set null;

alter table public.risk_assessments
  add column input_version_id uuid references public.assessment_input_versions (id) on delete set null,
  add column location_id uuid references public.business_locations (id) on delete set null,
  add column stale boolean not null default false,
  add column stale_reason text,
  add column stale_since timestamptz,
  add column superseded_by uuid references public.risk_assessments (id);

alter table public.background_jobs
  add column business_id uuid references public.businesses (id) on delete cascade,
  add column input_version_id uuid references public.assessment_input_versions (id) on delete cascade,
  add column stage text,
  add column progress jsonb not null default '[]'::jsonb,
  add column started_at timestamptz,
  add column completed_at timestamptz;

create index input_versions_business_idx on public.assessment_input_versions (business_id, version_number desc);
create index missing_data_version_idx on public.assessment_missing_data (input_version_id);
create index incidents_business_idx on public.business_incidents (business_id, input_version_id);
create index assets_business_idx on public.business_assets (business_id, input_version_id);
create index hazard_profiles_version_idx on public.hazard_sensitivity_profiles (input_version_id);
create index utility_records_version_idx on public.utility_reliability_records (input_version_id);
create index cost_assumptions_version_idx on public.property_cost_assumptions (input_version_id);
create index assessments_input_version_idx on public.risk_assessments (input_version_id);
create index jobs_input_version_idx on public.background_jobs (input_version_id);

create trigger monitoring_touch before update on public.monitoring_preferences
for each row execute function app_private.touch_updated_at();

-- Row-level security ----------------------------------------------------------

alter table public.assessment_templates enable row level security;
alter table public.question_definitions enable row level security;
alter table public.assessment_input_versions enable row level security;
alter table public.assessment_input_financials enable row level security;
alter table public.assessment_missing_data enable row level security;
alter table public.business_incidents enable row level security;
alter table public.business_assets enable row level security;
alter table public.hazard_sensitivity_profiles enable row level security;
alter table public.monitoring_preferences enable row level security;

alter table public.assessment_input_versions force row level security;
alter table public.assessment_input_financials force row level security;
alter table public.business_incidents force row level security;
alter table public.business_assets force row level security;

-- Registry is readable by any signed-in user and written only by migrations.
create policy templates_read on public.assessment_templates for select to authenticated using (true);
create policy question_definitions_read on public.question_definitions for select to authenticated using (true);

-- Input versions are immutable: no update or delete policy.
create policy input_versions_select on public.assessment_input_versions for select to authenticated
  using (app_private.is_org_member(organization_id));
create policy input_versions_insert on public.assessment_input_versions for insert to authenticated
  with check (app_private.has_org_role(organization_id, array['owner', 'admin', 'analyst', 'member']) and submitted_by = auth.uid());

create policy input_financials_select on public.assessment_input_financials for select to authenticated
  using (app_private.has_org_role(organization_id, array['owner', 'admin', 'analyst']));
create policy input_financials_insert on public.assessment_input_financials for insert to authenticated
  with check (app_private.has_org_role(organization_id, array['owner', 'admin', 'analyst']));

-- Loss amounts and replacement values are financial, so incidents and assets use the financial roles.
do $$
declare
  table_name text;
begin
  foreach table_name in array array['business_incidents', 'business_assets'] loop
    execute format('create policy %I on public.%I for select to authenticated using (app_private.has_org_role(organization_id, array[''owner'',''admin'',''analyst'']))', table_name || '_select', table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check (app_private.has_org_role(organization_id, array[''owner'',''admin'',''analyst'',''member'']))', table_name || '_insert', table_name);
    execute format('create policy %I on public.%I for delete to authenticated using (app_private.has_org_role(organization_id, array[''owner'',''admin'']))', table_name || '_delete', table_name);
  end loop;
  foreach table_name in array array['assessment_missing_data', 'hazard_sensitivity_profiles', 'monitoring_preferences'] loop
    execute format('create policy %I on public.%I for select to authenticated using (app_private.is_org_member(organization_id))', table_name || '_select', table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check (app_private.has_org_role(organization_id, array[''owner'',''admin'',''analyst'',''member'']))', table_name || '_insert', table_name);
    execute format('create policy %I on public.%I for update to authenticated using (app_private.has_org_role(organization_id, array[''owner'',''admin'',''analyst'',''member''])) with check (app_private.has_org_role(organization_id, array[''owner'',''admin'',''analyst'',''member'']))', table_name || '_update', table_name);
    execute format('create policy %I on public.%I for delete to authenticated using (app_private.has_org_role(organization_id, array[''owner'',''admin'']))', table_name || '_delete', table_name);
  end loop;
end $$;

-- Analysts upload to storage already; let them record metadata and link files to a business.
create policy uploads_meta_insert_analyst on public.uploaded_data_assets for insert to authenticated
  with check (app_private.has_org_role(organization_id, array['analyst']) and created_by = auth.uid());
create policy uploads_meta_update on public.uploaded_data_assets for update to authenticated
  using (app_private.has_org_role(organization_id, array['owner', 'admin', 'analyst']))
  with check (app_private.has_org_role(organization_id, array['owner', 'admin', 'analyst']));

-- The template row and its question definitions are generated from code by
-- scripts/export-questionnaire.ts into supabase/seed/question_definitions.sql.
