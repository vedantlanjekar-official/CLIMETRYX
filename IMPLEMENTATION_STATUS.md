# Implementation status

Updated 9 October 2026 after the initial build.

## Preserved context

`FIN-05_Research_Learning_Document.md` was read in full and left unchanged. It names one organizer dataset, World Bank Global Flood Exposure, and states that the other two organizer references were not in the supplied text. Those two are registered as unidentified.

## Verified in this run

- `npx tsc --noEmit` completed with no errors.
- `npx vitest run` — 3 files, 33 tests, all passed (16 climatology tests).
- Open-Meteo forecast HTTP 200 for 18.5204, 73.8567 on 9 Oct 2026. Example values included 29.9°C current temperature and daily maxima near 34°C. This was a research probe. The running app does not call Open-Meteo until `OPEN_METEO_MODE` is set.
- Copernicus STAC search HTTP 200. Collection `sentinel-2-l2a` returned item `S2B_MSIL2A_20261005T052659_N0513_R105_T43QCA_20261005T091454` with cloud cover 0.77. NDVI was not computed.
- CCKP documented India route HTTP 200, `metadata.status` success, and only time key `1995-07`. Treated as partial coverage.

## Commands

- `npx tsc --noEmit`: passed.
- `npx vitest run`: 33 tests passed.
- `npm run lint`: passed after ignoring `node_modules`.
- `npm run build`: passed. 39 routes generated.
- Browser walkthrough on `http://localhost:3000`: landing, sign-up validation, onboarding, dashboard, source registry, and the stress calculator rendered. Sign-up with a short password returned “Use at least 8 characters.” Preview of an incomplete form returned a validation error. The dashboard showed no invented counts.
- `GET /api/health`: returned configuration flags only, with Supabase and Open-Meteo unset.

## Supabase project

- Created `FIN-05 Climate Risk` (ref `oqhnjuqjmqmmpfpegfet`, ap-south-1) in the Valmet Technologies organization after the owner confirmed the $10/month cost. VALMET Project Control and Valmet Site Netra were not changed.
- Applied `fin05_initial`. Checked afterwards: 40 public tables, 0 without RLS, 128 policies, 16 data source rows, private buckets `business-uploads` and `assessment-reports`, PostGIS in schema `gis`, realtime on `risk_assessments`, `background_jobs`, `risk_alerts`.
- Security advisor: one INFO finding, `external_api_cache` has RLS and no policy. Intentional; only the server-side service client reads it.
- Before applying, the migration was corrected so authenticated users can insert locations: `gis` usage is granted to `authenticated` and `app_private.sync_point()` is `security definer`.
- `.env.local` holds the project URL, publishable key and `SUPABASE_SECRET_KEY` (server-only; never prefixed `NEXT_PUBLIC_`).

## Frontend design

- Design tokens in `app/globals.css` (`@theme`), Plus Jakarta Sans and Fraunces fonts, dark brand sidebar with grouped icon navigation, shared public header and footer, split-screen auth layout, and restyled primitives, chart, map placeholder, wizard, and dashboard.
- `next.config.ts` now registers the `@tailwindcss/turbopack` CSS loader. It had been dropped earlier, so Tailwind utilities were not compiled in the previous build.

## CLIMETRYX homepage (9 October 2026)

`app/page.tsx` now renders the full editorial homepage. Sections live in `components/marketing/home/`, styles in `home.css` (tokens `#0B1D29`, `#071B2B`, `#536471`, `#FAFBF8`, `#F2F5F2`, `#0B896B`, `#35BEB4`, `#DCE5DE`; Fraunces and Plus Jakarta Sans only).

- Order: hero (existing video and brand copy) → problem chain → location (real ERA5 1991–2020 thresholds for Delhi, Mumbai, Pune, Chennai read from `data/models/climatology/*.json`) → four hazards → five-stage process (`#platform`) → financial vulnerability flow using the real component weights from `lib/scoring/types.ts` → Sentinel-2 before/after (`#data-intelligence`) → dependency network → dynamic-assessment switcher → findings-to-actions → feasibility and costing worksheet → data and methodology from `metadata/source-registry.json` (`#methodology`) → audiences (`#applications`) → dark closing CTA → footer.
- Navigation: `marketingNav` in `lib/navigation.ts` feeds the hero nav and `PublicHeader` (Platform, Methodology, Data Intelligence, Applications, Sign in, Get started). The footer is shared by all public pages.
- Motion: one `RevealObserver` adds `.cx-js` to `<html>` and reveals `[data-reveal]` elements. Content is visible without JavaScript and with `prefers-reduced-motion`.
- Illustrative content is labelled on the page: the problem sequence, dependency network, dynamic-assessment values and example findings. No statistics, testimonials or prices are invented. The costing worksheet only totals user-entered figures and is not saved.
- The old standalone pages (`/methodology`, `/glossary`, `/attribution`, `/help`, `/privacy`, `/terms`, `/credits`) were removed at the owner's request, along with every link to them. Image attribution remains in each homepage caption and in `public/images/editorial/credits.json`.
- Hero copy keeps the owner-supplied CLIMETRYX headline rather than the master prompt's alternative wording.

### Image assets

- `public/images/editorial/*.webp` — ten Wikimedia Commons images (CC BY 2.0, CC BY-SA 3.0/4.0, public domain), resized to WebP. Author, licence and source URL for each are in `public/images/editorial/credits.json` and shown in every caption and on `/credits`. Unsplash's API returned HTTP 401 without a key, so it was not used.
- `public/images/satellite/khadakwasla-2025-04-28.webp` and `khadakwasla-2025-11-14.webp` — Sentinel-2 L2A `visual` renders from the Microsoft Planetary Computer for the same tile (43QCA), orbit, platform (Sentinel-2C) and processing baseline. Metadata and limitations in `public/images/satellite/scenes.json`. A seasonal comparison only; NDVI and water extent are not computed.

### Checked

- `npx tsc --noEmit`, `npx eslint app components lib`, `npm run build` (43 routes) and `npm test` (41 tests) passed.
- Production server visual review at 1440, 820 and 390 px wide: all sections rendered, no horizontal overflow at 820 or 390 px. Tab switcher, before/after slider and costing totals were exercised (₹1,50,000 one-time, ₹8,000 yearly, ₹60,000 avoided gave a 2.9-year payback). Every internal link and in-page anchor on `/` resolved; `/onboarding` and `/feasibility` redirect to sign-in as designed.

### Outstanding

- No real map tiles or flood-hazard raster, so the location section uses reanalysis statistics rather than a map.
- There is no privacy or terms page. Add reviewed versions before any public or commercial use.

## Data APIs and local climatology

- `OPEN_METEO_MODE=non_commercial` is set. Open-Meteo forecast, historical (ERA5) and geocoding are verified live and marked `verified` in the registry and in `data_sources`.
- `lib/climatology` fits a per-grid-cell model from ERA5 1991–2020: temperature, wet-day rain and gust percentiles, empirical 2-year and 10-year levels, and monthly SPI-30/SPI-90 gamma fits. Heat, flood, storm and drought modules use these local thresholds alongside the fixed ones. Methodology version is now `fin05-vulnerability-1.1.0`.
- Applied migration `climatology_models` to `oqhnjuqjmqmmpfpegfet`: table with RLS and 3 policies, plus the `open-meteo-era5-climatology` source. Security advisor unchanged (only the intentional `external_api_cache` INFO).
- `npm run train:climatology` produced reference fits in `data/models/climatology/` for Pune, Mumbai, Delhi and Chennai. Every grid had 10,958 days and no gaps.

Out-of-time check (fit 1991–2010, test 2011–2020; 5% expected for P95 thresholds):

| City | Heat P95 exceeded | Wet-day P95 exceeded | Gust P95 exceeded | SPI-90 to 30 Sep 2026 |
| --- | --- | --- | --- | --- |
| Pune | 7.6% (shift) | 5.3% | 5.3% | 0.93 |
| Mumbai | 6.5% | 5.1% | 4.6% | 1.58 |
| Delhi | 4.5% | 4.2% | 3.9% | 1.1 |
| Chennai | 6.5% | 5.2% | 5.2% | −1.3 (moderately dry) |

- An earlier run compared a window ending 3 October with October month-end fits, which pushed Chennai to −3. Current SPI now uses the latest complete month, matching the fits, and a test covers it.
- No supervised model was trained. There are no labelled business-disruption outcomes to train on.

## Business assessment (9 October 2026)

The 15-step, 223-question business assessment (Level A and B depth, industry branches) is embedded in `/dashboard`; there is no separate assessment page. Job progress appears in the same place at `/dashboard?job=<id>`. The old `/onboarding` URLs redirect there. The design is described in `docs/QUESTIONNAIRE_SPECIFICATION.md`, the per-question mapping is in `metadata/DATA_DICTIONARY.md`, the scoring mapping is in `docs/SCORING_METHODOLOGY.md`, and the tables and policies are in `docs/DATABASE.md`.

- Layout: a dashboard panel with step navigator, form and context rail, plus an action bar pinned to the bottom of the panel (Back, Save draft, Save and continue, Submit). Columns follow the panel width: three columns when it is at least 1060 px wide (1440 px window), steps as a dropdown above the form below 720 px (1024 px window and phones). Measured with no horizontal overflow at 1440, 1024 and 390 px. Palette `#FFFFFF`, `#F7FAF7`, `#EEF7EF`, `#16865B`, `#0B5940`, `#14271F`, `#64736A`, `#DDE8DF`.
- Autosave with revision-based conflict handling and a browser copy; immutable input versions; stale results kept with the reason; background job with Realtime stage progress; per-site score change against the previous assessment.
- Restricted financial answers are stored separately and limited to owner, admin and analyst.
- The workspace dashboard and the locations, suppliers, map and feasibility pages ignore soft-removed rows.

### Checked

- `npx tsc --noEmit`, `npx eslint`, `npx vitest run` (6 files, 75 tests) and `npm run build` passed.
- Migrations `assessment_questionnaire` and `assessment_questionnaire_tuning` applied to `oqhnjuqjmqmmpfpegfet`. 223 question definitions seeded.
- Live RLS check by impersonation in a rolled-back transaction: financial inputs and incidents visible only to owner, admin and analyst; input versions cannot be updated or deleted; viewers and outsiders cannot submit. Security advisor shows no new findings.
- Browser review against a local server with Supabase disabled:
  - Level B reveals extra questions, and the navigator states update.
  - Adding a site works. 0,0 is rejected, and valid coordinates show the confirmation choice. After the pin is confirmed, the rail shows the site as ready.
  - Save and continue marks an incomplete step as needing attention.
  - On the review step, the summary lists open items per step, and Submit flags every incomplete step and names the first missing field.
  - The browser copy was restored after a reload.
  - Layout measured at 1440, 1024 and 390 px with no horizontal overflow.

### External dependencies

- Map tiles: `NEXT_PUBLIC_MAP_STYLE_URL` is empty, so the location field shows coordinates without a basemap. Choose a style whose licence you accept.
- Alerts: `OFFICIAL_ALERTS_FEED_URL` and `CRON_SECRET` are empty, so official warnings are not ingested and scheduled checks are not protected. No email or SMS provider is configured; monitoring preferences are stored but nothing is sent.
- Leaked-password protection is off in Supabase Auth settings. It is a dashboard setting and was left unchanged.
- There are no privacy or terms pages. The consent text on the review step has not been legally reviewed.
- Open-Meteo is used under its non-commercial terms. Commercial use needs a subscription.

## Not verified

- An authenticated end-to-end submission (save draft, submit, job run, dashboard progress view, results) against the live project. No test accounts were created, so the server actions, `after()` job and Realtime updates have not run live. The RLS policies they rely on were checked directly in SQL.
- Signed-in workspace pages against the new project, including the app's write path to `climatology_models`.
- Document upload to the `business-uploads` bucket.
- Raster imports, IMERG (needs Earthdata), ERA5-Land through CDS (needs a key), CHIRPS v3, Aqueduct, official warnings, and the Global Flood Database download.
- Row-level security for tables created by `fin05_initial` against a live database. That SQL is statically checked; the business assessment tables were checked live.
- Email delivery, SMS, and deployment.

## Manual owner actions

1. Keep `SUPABASE_SECRET_KEY` out of version control and out of any `NEXT_PUBLIC_` variable.
2. Set Auth Site URL and redirect URLs (`http://localhost:3000/auth/callback`, `http://localhost:3000/reset-password`).
3. `OPEN_METEO_MODE` is `non_commercial`. Buy an Open-Meteo subscription and switch to `commercial` before any commercial use.
4. Choose a basemap style URL only after accepting its licence.
5. Install Python and raster libraries before attempting NDVI.

## Analytical limits

The score is a rules indicator. Hazard thresholds are calibrated to local climate, but the score is not calibrated against business losses. Weights and fixed thresholds are methodology assumptions. Population exposure is not business flood depth. A catalog item is not NDVI. Forecasts are not official warnings. Stress results are hypothetical.
