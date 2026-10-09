-- AI Reports Centre: analytical snapshots, report generation batches, versioned reports and AI usage.
-- Additive only. Reports can contain restricted financial figures, so every table is limited to
-- owner, admin and analyst roles, matching generated_reports and assessment_input_financials.

create table if not exists public.analytical_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  assessment_id uuid not null references public.risk_assessments (id) on delete cascade,
  engine_version text not null,
  snapshot_hash text not null,
  payload jsonb not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (assessment_id, engine_version, snapshot_hash)
);

create table if not exists public.intelligence_report_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  assessment_id uuid not null references public.risk_assessments (id) on delete cascade,
  requested_types text[] not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'completed_with_limitations', 'failed')),
  error_summary text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.intelligence_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  assessment_id uuid not null references public.risk_assessments (id) on delete cascade,
  snapshot_id uuid references public.analytical_snapshots (id) on delete set null,
  batch_id uuid references public.intelligence_report_batches (id) on delete set null,
  report_type text not null,
  version integer not null check (version >= 1),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'completed_with_limitations', 'failed')),
  engine_version text not null,
  document jsonb,
  generation jsonb not null default '{}'::jsonb,
  error_summary text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (assessment_id, report_type, version)
);

create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  report_id uuid references public.intelligence_reports (id) on delete set null,
  provider text not null,
  model text not null,
  operation text not null,
  outcome text not null check (outcome in ('accepted', 'rejected_validation', 'error', 'skipped')),
  input_tokens integer,
  output_tokens integer,
  total_tokens integer,
  latency_ms integer,
  estimated_cost_usd numeric,
  detail text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists analytical_snapshots_assessment_idx on public.analytical_snapshots (assessment_id, created_at desc);
create index if not exists intelligence_reports_business_idx on public.intelligence_reports (organization_id, business_id, created_at desc);
create index if not exists intelligence_reports_assessment_type_idx on public.intelligence_reports (assessment_id, report_type, version desc);
create index if not exists intelligence_report_batches_assessment_idx on public.intelligence_report_batches (assessment_id, created_at desc);
create index if not exists ai_usage_events_org_idx on public.ai_usage_events (organization_id, created_at desc);

alter table public.analytical_snapshots enable row level security;
alter table public.intelligence_report_batches enable row level security;
alter table public.intelligence_reports enable row level security;
alter table public.ai_usage_events enable row level security;
alter table public.analytical_snapshots force row level security;
alter table public.intelligence_report_batches force row level security;
alter table public.intelligence_reports force row level security;
alter table public.ai_usage_events force row level security;

create policy analytical_snapshots_select on public.analytical_snapshots for select to authenticated
  using (app_private.has_org_role(organization_id, array['owner', 'admin', 'analyst']));
create policy analytical_snapshots_insert on public.analytical_snapshots for insert to authenticated
  with check (app_private.has_org_role(organization_id, array['owner', 'admin', 'analyst']));

create policy report_batches_select on public.intelligence_report_batches for select to authenticated
  using (app_private.has_org_role(organization_id, array['owner', 'admin', 'analyst']));
create policy report_batches_insert on public.intelligence_report_batches for insert to authenticated
  with check (app_private.has_org_role(organization_id, array['owner', 'admin', 'analyst']));
create policy report_batches_update on public.intelligence_report_batches for update to authenticated
  using (app_private.has_org_role(organization_id, array['owner', 'admin', 'analyst']))
  with check (app_private.has_org_role(organization_id, array['owner', 'admin', 'analyst']));

create policy intelligence_reports_select on public.intelligence_reports for select to authenticated
  using (app_private.has_org_role(organization_id, array['owner', 'admin', 'analyst']));
create policy intelligence_reports_insert on public.intelligence_reports for insert to authenticated
  with check (app_private.has_org_role(organization_id, array['owner', 'admin', 'analyst']));
create policy intelligence_reports_update on public.intelligence_reports for update to authenticated
  using (app_private.has_org_role(organization_id, array['owner', 'admin', 'analyst']))
  with check (app_private.has_org_role(organization_id, array['owner', 'admin', 'analyst']));

create policy ai_usage_select on public.ai_usage_events for select to authenticated
  using (app_private.has_org_role(organization_id, array['owner', 'admin']));
create policy ai_usage_insert on public.ai_usage_events for insert to authenticated
  with check (app_private.has_org_role(organization_id, array['owner', 'admin', 'analyst']));

-- Monthly revenue history is upserted from the questionnaire, which needs an update policy.
create policy monthly_financial_update on public.monthly_financial_records for update to authenticated
  using (app_private.has_org_role(organization_id, array['owner', 'admin', 'analyst']))
  with check (app_private.has_org_role(organization_id, array['owner', 'admin', 'analyst']));
