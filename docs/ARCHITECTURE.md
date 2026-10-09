# Architecture

FIN-05 is a Next.js App Router application. The workspace root is the application root. `FIN-05_Research_Learning_Document.md` is preserved research context and is not generated documentation.

## Layers

1. Pages in `app/` render server components by default.
2. Client components are limited to forms, the map, charts, and the stress calculator.
3. `proxy.ts` refreshes the Supabase session and sends unsigned users away from workspace routes when Supabase is configured.
4. Domain scoring lives in `lib/scoring`, `lib/hazards`, `lib/financial`, and `lib/recommendations`. It does not import provider payloads.
5. Provider adapters in `lib/integrations` validate responses and return typed records or a configuration error.
6. `lib/assessments/pipeline.ts` combines those records. Missing inputs stay missing.
7. `lib/actions/workspace.ts` persists a run only when a signed-in Supabase user exists.
8. Reports are JSON documents rendered on screen and exported to PDF or CSV.
9. `lib/intelligence` builds an analytical snapshot from a saved assessment (engines for normalisation, climate summary, revenue-weather history, exposure, financial scenarios, risk, resilience and adaptation) and composes ten report documents from it. AI writes only their narrative. See `docs/REPORTS.md`.

The signed-in workspace has no side navigation, only a top bar with the account and sign-out. It consists of the business list (`/businesses`), the new-business form (`/businesses/new`), a business page with its AI reports (`/businesses/[id]`), the report viewer (`/reports/[id]`) and the climate analysis detail (`/assessments/[id]`). Settings pages remain at `/settings` but are not linked. The earlier dashboard, Reports Centre, data sources, locations, map, suppliers, alerts, resilience, feasibility, costing, stress and admin pages were moved to `_archive/removed-sections/` (outside `app/`, excluded from type checking). Their URLs redirect to `/businesses`.

## What is not claimed

The app uses the dedicated Supabase project `FIN-05 Climate Risk` (ref `oqhnjuqjmqmmpfpegfet`) with the initial migration applied. `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are read from `.env.local`. The two other projects in the account, VALMET Project Control and Valmet Site Netra, were not modified.

Open-Meteo is not called until `OPEN_METEO_MODE` is explicitly `non_commercial` or `commercial`. Cache Components are turned off because session reads are request-specific.

A Sentinel catalog hit is not an NDVI value. NDVI processing is a separate worker step and is currently `not_available`.
