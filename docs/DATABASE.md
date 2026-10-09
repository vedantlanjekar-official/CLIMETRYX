# Database

Migration: `supabase/migrations/20261009045332_fin05_initial.sql`.

Applied on 9 October 2026 to the dedicated project `FIN-05 Climate Risk` (ref `oqhnjuqjmqmmpfpegfet`, ap-south-1). Do not apply it to VALMET Project Control or Valmet Site Netra.

## PostGIS

The migration creates schema `gis` and installs PostGIS there when the extension is absent. If PostGIS already exists in another schema, the migration stops. Supabase documents that PostGIS is not relocatable after installation. System spatial tables are not created in `public`, and table privileges on `gis` are revoked from `anon` and `authenticated`. `authenticated` keeps schema usage so the `geography` column type resolves, and the point trigger runs as `security definer`.

## Authorization

Roles are rows in `organization_members`: owner, admin, analyst, member, viewer. Policies do not read `user_metadata`.

- Members can read business, location, supplier, and assessment rows in their organization.
- Financial profiles, monthly figures, property costs, stress scenarios, and generated reports are limited to owner, admin, and analyst.
- The first organization insert is followed by an owner membership insert. A security-definer check allows that owner row only for the creator and only while the organization has no members.
- `external_api_cache` has RLS and no authenticated policy.
- Storage buckets `business-uploads` and `assessment-reports` are private. Paths start with the organization id.

## Realtime

When the `supabase_realtime` publication exists, the migration adds `risk_assessments`, `background_jobs`, and `risk_alerts`. RLS still applies to those reads. Realtime delivers application events. It does not refresh weather providers.

## Business assessment migrations

`20261010090000_assessment_questionnaire.sql` and `20261010091000_assessment_questionnaire_tuning.sql`, applied on 9 October 2026 to `oqhnjuqjmqmmpfpegfet` as `assessment_questionnaire` and `assessment_questionnaire_tuning`. The remote assigned its own version timestamps. Both are additive: new tables, plus nullable or defaulted columns on existing ones. No data is removed.

New tables:

| Table | Purpose | Read | Write |
| --- | --- | --- | --- |
| `assessment_templates`, `question_definitions` | Question registry, seeded from code | any signed-in user | seed script only |
| `assessment_input_versions` | Immutable submitted answers (general part), hash, completeness, changed and material fields | members | insert by owner, admin, analyst, member as themselves; no update or delete |
| `assessment_input_financials` | Restricted financial answers of a version | owner, admin, analyst | owner, admin, analyst |
| `assessment_missing_data` | Unanswered and not-sure items per version | members | member and above |
| `business_incidents`, `business_assets` | Past incidents and asset values per version | owner, admin, analyst (loss and replacement values are financial) | insert member and above; delete owner, admin |
| `hazard_sensitivity_profiles` | Per-hazard responses and thresholds | members | member and above |
| `monitoring_preferences` | Alert hazards, channels, reassessment frequency | members | member and above |

Extended tables: `onboarding_drafts` (revision, status, template version, step 1–15), `business_locations`, `location_preferences`, `suppliers`, `supplier_locations` (`client_row_id`, `removed_at` soft removal, primary site, staff, lowest level), `operational_profiles`, `financial_profiles` (period, basis, credit, stress shares), `resilience_measures`, `utility_reliability_records`, `property_cost_assumptions`, `uploaded_data_assets`, `user_consents`, `risk_assessments` (`input_version_id`, `location_id`, `stale`, `stale_reason`, `superseded_by`) and `background_jobs` (`stage`, `progress`, timing).

The tuning migration merges the upload-metadata insert policies into one (`uploads_meta_insert`: owner, admin or analyst, and only as themselves), uses `(select auth.uid())` in policies, and adds indexes on the new foreign keys.

### Verification

Checked on 9 October 2026 inside a rolled-back transaction, impersonating users through `request.jwt.claims` and `set local role authenticated`:

- Owner and analyst read financial inputs and incidents. Member, viewer and a user from another organization read none.
- Nobody can update or delete an input version. Viewer and outsider cannot insert one. Nobody can insert a version with another user as `submitted_by`.
- The question registry is readable by any signed-in user.
- The transaction rolled back with no rows left behind.

Security advisor after applying: only the pre-existing findings (`external_api_cache` has no policy, by design; leaked-password protection is off in Auth settings). Performance advisor: findings on the new tables were fixed; older unindexed foreign keys and unused indexes remain.

`tests/security/questionnaire-migration.test.ts` checks statically that every new table enables RLS, financial policies are limited to owner, admin and analyst, input versions have no update or delete policy, and the migration drops nothing.

### Question registry seed

```powershell
npm run export:questionnaire   # regenerates supabase/seed/question_definitions.sql and the data dictionary
npm run seed:questionnaire     # upserts into the FIN-05 project; needs SUPABASE_SECRET_KEY in .env.local
```

The seed script stops unless the Supabase URL belongs to `oqhnjuqjmqmmpfpegfet`. Seeded on 9 October 2026: 15 steps, 223 questions.

## Manual steps

1. Create a Supabase project for FIN-05.
2. Set the site URL and redirect URLs to the app origin, including `/auth/callback` and `/reset-password`.
3. Run `npx supabase link` and `npx supabase db push` only after confirming the project ref.
4. Generate types with `npx supabase gen types typescript --linked`. The application currently uses the untyped client plus explicit selects.
