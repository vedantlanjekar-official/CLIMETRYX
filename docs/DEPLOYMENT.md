# Deployment and local setup

Requirements: Node.js 22 and npm. Python is not available through the `py` launcher on this machine, so raster processing is not runnable here.

## Local app

```bash
npm install
copy .env.example .env.local
npm run dev
```

The app builds without the environment variables. Configured features stay disabled until the values are present.

## Supabase

The intended account email recorded by the brief is `valmet.intern@gmail.com`. That does not select a project. Create a new FIN-05 project in that account, then set:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` only on the server

In the Supabase Auth settings, allow `http://localhost:3000/auth/callback` and the deployed `/auth/callback` and `/reset-password` URLs.

Apply the migration with the Supabase CLI after linking the new project:

```bash
npx supabase link --project-ref <fin05-project-ref>
npx supabase db push
```

Do not point `--project-ref` at `ranbedbfeqgzmktzwzpp` or `buqnvmaabtgtkyjqnxin`.

## Providers

Set `OPEN_METEO_MODE` before forecast calls. Use `commercial` plus `OPEN_METEO_CUSTOMER_API_KEY` for commercial use.

Set `NEXT_PUBLIC_MAP_STYLE_URL` only after accepting the basemap licence. MapTiler is one option; the key stays server-side if a style URL already contains it, so prefer a style URL that does not embed a secret, or accept that a public style URL is visible to the browser.

The default map style is OpenFreeMap Liberty, which needs no key. `npm install`, `npm run dev` and `npm run build` copy MapLibre's worker to `public/vendor/maplibre-gl-worker.mjs`; without it maps show a blank background, because the bundled library cannot find its worker.

Set `AI_GATEWAY_API_KEY` (server only) to let an AI model write the assessment summary. Without it the rules summary is used.

The AI Reports Centre uses OpenAI directly. Set these in `.env.local` or the host's secret settings, never in a `NEXT_PUBLIC_*` variable, a form or a chat:

| Variable | Required | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | For AI narratives | Server-only key for the Responses API. Without it every report is still generated, with a rules-written narrative, and the UI says AI is not configured. |
| `OPENAI_MODEL` | No | Model id, default `gpt-5.4-mini`. |
| `OPENAI_PRICE_INPUT_PER_MTOK`, `OPENAI_PRICE_OUTPUT_PER_MTOK` | No | Your contracted USD price per million tokens. When both are set, `ai_usage_events.estimated_cost_usd` is filled; otherwise it stays empty rather than guessed. |
| `AI_REPORTS_DISABLED` | No | `true` switches AI narratives off without removing the key. |

Report generation runs after the response through `after()`; the reports page sets `maxDuration = 300`. On a host with a shorter function limit, generate fewer reports per batch.

Apply `supabase/migrations/20261011090000_intelligence_reports.sql` before using the Reports Centre. It has been applied to the FIN-05 project `oqhnjuqjmqmmpfpegfet`.

Copernicus credentials are required only to download scenes. Catalog search uses `https://stac.dataspace.copernicus.eu/v1/`.

## Host

Bind a hosted Next.js service to the platform port. On Render that is `0.0.0.0:$PORT`; Vercel sets this for Next.js automatically. Do not deploy until the owner asks. This repository has not been deployed.

## Jobs

`POST /api/jobs/process` with `Authorization: Bearer $CRON_SECRET` lists queued jobs. It does not download global rasters. Heavy raster work belongs in a separate worker. `scripts/workers/ndvi_worker.py` documents that step and is not runnable until Python and the raster libraries exist.

## Rollback

Keep the migration file. To roll back a remote project, restore a Supabase backup or write a forward migration. Do not drop the existing VALMET databases.
