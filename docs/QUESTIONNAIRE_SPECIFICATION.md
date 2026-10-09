# Questionnaire specification

Template `climetryx-business-assessment`, version `2026.10.1`. Scored with methodology `fin05-vulnerability-1.2.0`.

The question set is defined in code (`lib/questionnaire/steps-profile.ts`, `steps-risk.ts`, `industries.ts`) and registered in `lib/questionnaire/registry.ts`. Every question carries its label, type, unit, required flag, level, source category, sensitivity, scoring dimensions, database target and materiality. The per-question table, including the field → database → source → component mapping, is generated into `metadata/DATA_DICTIONARY.md` by `npm run export:questionnaire`. Do not edit that section by hand.

## Steps

| # | Step id | Title |
| --- | --- | --- |
| 1 | `purpose` | Purpose and context |
| 2 | `profile` | Identity, industry and operating profile |
| 3 | `locations` | Operating locations |
| 4 | `prospects` | Prospective locations and expansion (optional) |
| 5 | `operations` | Operational sensitivity and dependencies |
| 6 | `incidents` | Historical incidents |
| 7 | `hazards` | Hazard-specific sensitivity |
| 8 | `utilities` | Utility reliability |
| 9 | `suppliers` | Suppliers and inputs |
| 10 | `financials` | Financial resilience |
| 11 | `measures` | Continuity and adaptation measures |
| 12 | `costs` | Property and investment costs (optional) |
| 13 | `uploads` | Supporting documents (optional) |
| 14 | `monitoring` | Monitoring and reassessment |
| 15 | `review` | Review, consent and submission |

15 steps and 223 question paths. Repeating sections (sites, prospects, incidents, suppliers, assets, cost items) store rows under `answers.groups[groupKey]`, each with a client-generated `id`. Paths in group rows are written `group[].field`.

## Levels and branches

- Level A is the core assessment. Level B adds detail questions and Level B-only groups. The level is chosen with `purpose.depth`.
- Industry branches come from the selected activity in `profile.activity` (36 activities mapped to ISIC sections) and from answers:
  - `water_intensive` when water dependency is critical or high;
  - `outdoor_work` when staff work outdoors;
  - `food_cold_chain` when perishable inventory is held;
  - `new_site` when the purpose includes a new site or prospects are planned;
  - `financial` when the business chooses to include financial figures.
- Branch list: agriculture, manufacturing, food_cold_chain, retail, it_services, water_intensive, outdoor_work, hospitality, logistics, construction, healthcare, new_site, financial.
- A question is shown when its level is allowed, its industry filter matches an active branch, and its `visibleWhen` condition holds (`equals`, `in`, `includes`, `level`, combined with all/any/not). Hidden questions are never required and their values are not validated.

## Validation

Zod schemas in `lib/questionnaire/validation.ts`. Two modes:

- **Draft** (autosave): type and range errors only. Incomplete answers are accepted.
- **Submit**: every visible required question, plus the cross-field rules below.

Cross-field rules:

- Coordinates: latitude within ±90, longitude within ±180, and 0,0 rejected. Each operating site needs the pin confirmed or accepted as approximate.
- With more than one site, exactly one is primary. Selecting a primary site clears the flag on the others.
- Financial period: end after start; a monthly basis spans 28–31 days and an annual basis 360–371 days.
- Supplier spend shares may not total more than 100%. When any prospect criterion weight is entered, the weights must total 100.
- Dates marked `notFuture`, such as incident `occurred_on`, may not be in the future.
- Free text is rejected if it contains a 12-digit Aadhaar-like number or a 13–19 digit number that passes the Luhn card check. The form never asks for ID, card or bank details.
- `sanitizeAnswers` keeps only registered keys, trims each group to its `maxItems`, and runs on the server before every save, preview and submission.

Restricted financial fields (sensitivity `restricted_financial`) are split from the general answers before storage. They are only stored, read and shown for owner, admin and analyst roles.

## Interface

- Three regions: a step navigator (a select below 600 px), the form, and a context rail. The rail shows why the step is asked, what it informs, the external data retrieved after submission, input completeness by dimension, unresolved answers, evidence quality, and the locations ready for analysis.
- The form is the new-business page (`app/(workspace)/businesses/new/page.tsx`), which always starts a fresh business. After submission the user goes to the business page (`/businesses/<id>`), which shows the job progress and then the AI reports.
- An action bar pinned to the bottom of the panel has Back, Save draft, Save and continue, and Submit on the last step.
- The navigator shows each step as Not started, In progress, Needs attention, Complete or Optional. A step is only marked Needs attention after the user has left it or tried to submit.
- Completeness is the share of applicable questions answered with a known value. It is not a risk score, and no score appears until a preview or a submitted job produces one.
- The review step lists answers per step with Edit links. Restricted currency figures are hidden in the summary. A preview runs the scoring for the primary site with live provider data and stores nothing.

## Autosave and conflicts

`components/assessment/use-autosave.ts` and `saveAssessmentDraft` in `lib/actions/assessment.ts`:

1. Changes are debounced for 1.2 s, then sent with the revision the client last saw.
2. Every change is also written to `localStorage`. If that copy is newer than the server draft on load, the user can restore it.
3. The server updates `onboarding_drafts` only where `revision` still matches and increments it. A mismatch returns `conflict` with the saved answers. The user chooses Keep my version (forced save) or Load the saved version.
4. Failed saves retry with exponential backoff from 2 s up to 30 s.
5. Without Supabase or without a session, drafts stay in the browser and submission is disabled.
6. Viewers cannot save. Saving is rate limited to 120 requests per 10 minutes per user.

## Submission and versioning

`submitAssessmentAnswers`:

1. Sanitize and validate in submit mode. Check the role; financial figures need owner, admin or analyst.
2. Create or update the business.
3. Insert an immutable `assessment_input_versions` row with the version number, template and methodology versions, level, answers hash, completeness, changed fields and material changes compared with the previous version. Restricted answers go to `assessment_input_financials`.
4. Persist answers into the domain tables (`lib/questionnaire/persist.ts`). Entity rows such as sites, prospects and suppliers are upserted by `client_row_id` and soft-removed with `removed_at`. Event rows such as incidents, assets, utility records and costs are scoped to the input version.
5. If any material field changed, mark the current results stale with the reason. Earlier results stay readable.
6. Queue a `background_jobs` row and run it after the response (`after()` from `next/server`).

Draft saves also mark results stale when a material field differs from the last submitted version.

## Analysis job

`lib/assessments/job-runner.ts`. Stages are written to `background_jobs.progress`, and the business page progress view subscribes to them through Supabase Realtime, polling every 4 s as a fallback.

| Stage | Work |
| --- | --- |
| validating | Re-validate the frozen input version and select up to five sites with valid coordinates, primary first |
| collecting | Open-Meteo forecast and ERA5 archive, the cached climatology fit, and a Sentinel-2 L2A catalogue search per site |
| scoring | `runAssessment` per site |
| saving | Store one `risk_assessments` row per site with the score change against the previous assessment of that site; mark the previous one superseded |
| reporting | Store a `generated_reports` row per assessment |

The job ends as `completed`, `completed_with_limitations` (provider gaps or partial scores) or `failed` with a short error summary.

## Registry export and seed

- `npm run export:questionnaire` writes `supabase/seed/question_definitions.sql` and the generated section of `metadata/DATA_DICTIONARY.md`.
- `npm run seed:questionnaire` upserts the template and definitions into `question_definitions` using `SUPABASE_SECRET_KEY` from `.env.local`. It refuses to run against any project other than `oqhnjuqjmqmmpfpegfet`.
- Re-run both after changing any question, and bump `TEMPLATE_VERSION` when a change alters meaning.

## Tests

`tests/unit/questionnaire.test.ts` covers definitions, branches, visibility, draft and submit validation, coordinates, financial periods, supplier shares, prospect weights, restricted identifiers, sanitization, mapping, change detection, site ordering and exclusion, deterministic scoring, uploads and reassessment dates. `tests/security/questionnaire-migration.test.ts` checks the migration statically.
