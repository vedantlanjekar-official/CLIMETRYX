-- Follow-up to the questionnaire migration, from the Supabase performance advisor.
-- Policies evaluate auth.uid() once per statement, the two upload insert policies
-- are merged into one, and foreign keys on the new columns get covering indexes.

drop policy if exists uploads_meta_insert_analyst on public.uploaded_data_assets;
drop policy if exists uploads_meta_write on public.uploaded_data_assets;
create policy uploads_meta_insert on public.uploaded_data_assets for insert to authenticated
  with check (app_private.has_org_role(organization_id, array['owner', 'admin', 'analyst']) and created_by = (select auth.uid()));

drop policy if exists input_versions_insert on public.assessment_input_versions;
create policy input_versions_insert on public.assessment_input_versions for insert to authenticated
  with check (app_private.has_org_role(organization_id, array['owner', 'admin', 'analyst', 'member']) and submitted_by = (select auth.uid()));

create index if not exists input_versions_org_idx on public.assessment_input_versions (organization_id);
create index if not exists input_versions_previous_idx on public.assessment_input_versions (previous_version_id);
create index if not exists input_versions_submitted_by_idx on public.assessment_input_versions (submitted_by);
create index if not exists input_financials_org_idx on public.assessment_input_financials (organization_id);
create index if not exists missing_data_org_idx on public.assessment_missing_data (organization_id);
create index if not exists incidents_version_idx on public.business_incidents (input_version_id);
create index if not exists incidents_location_idx on public.business_incidents (location_id);
create index if not exists incidents_org_idx on public.business_incidents (organization_id);
create index if not exists assets_version_idx on public.business_assets (input_version_id);
create index if not exists assets_location_idx on public.business_assets (location_id);
create index if not exists assets_org_idx on public.business_assets (organization_id);
create index if not exists hazard_profiles_business_idx on public.hazard_sensitivity_profiles (business_id);
create index if not exists hazard_profiles_org_idx on public.hazard_sensitivity_profiles (organization_id);
create index if not exists monitoring_version_idx on public.monitoring_preferences (input_version_id);
create index if not exists monitoring_org_idx on public.monitoring_preferences (organization_id);
create index if not exists jobs_business_idx on public.background_jobs (business_id);
create index if not exists operational_version_idx on public.operational_profiles (input_version_id);
create index if not exists financial_version_idx on public.financial_profiles (input_version_id);
create index if not exists measures_version_idx on public.resilience_measures (input_version_id);
create index if not exists consents_version_idx on public.user_consents (input_version_id);
create index if not exists uploads_business_idx on public.uploaded_data_assets (business_id);
create index if not exists assessments_location_idx on public.risk_assessments (location_id);
create index if not exists assessments_superseded_idx on public.risk_assessments (superseded_by);
