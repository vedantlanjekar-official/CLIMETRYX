# AI reports

Each business page (`/businesses/[id]`) shows ten professionally structured reports built from the business's saved assessment. Every figure, chart and table is computed by deterministic engines. AI, when configured, rewrites only the narrative and is checked against those figures. Reports are decision support: they never contain a probability of default (PD), exposure at default (EAD), loss given default (LGD), a credit rating or a loan decision.

## Flow

1. The user submits the new-business form (`/businesses/new`). The job runner saves the climate analysis as `generated_reports.content.detail` (the report model: forecast, hazard screens, flood exposure, river discharge, projections, warnings, satellite, score).
2. At the end of the same job, `queueReportBatch` (`lib/intelligence/service.ts`) queues all ten core reports for the primary site's assessment, if the submitter has an owner, admin or analyst role (reports contain restricted financial figures); otherwise a limitation is recorded on the job. It creates an `intelligence_report_batches` row and one `intelligence_reports` row per type with the next version number. **Regenerate all** and **Retry** on the business page go through `generateReports` (`lib/actions/reports.ts`), which adds input checks and a rate limit of 8 batches per 10 minutes.
3. `runReportBatch` (`lib/intelligence/service.ts`) loads the assessment, answers (restricted financials merged only for permitted roles) and monthly revenue; fetches ERA5 monthly weather for the revenue months when at least 12 exist; builds the analytical snapshot; stores it in `analytical_snapshots` (deduplicated by hash); and composes the reports, three at a time.
4. Each report moves pending → processing → completed or completed with limitations, or failed. A failure affects only that version. Earlier versions are never overwritten or deleted.
5. The business page refreshes every 4 seconds while any report is queued or being written.

## Engines

| Engine | File | Output |
| --- | --- | --- |
| A Normalisation | `normalize.ts` | One business profile in monthly units (annual ÷ 12), cleaned revenue history, suppliers, incidents, costs, explicit data gaps. Financials are dropped when consent is "no". |
| C Climate summary | `climate.ts` | Forecast statistics, official warnings, flood exposure, river, CMIP6 changes, satellite, climatology, from the saved report model. |
| D History match | `history.ts` | Revenue index against monthly rainfall, temperature, hot days and heavy-rain days. Pearson r with n and strength. Needs 12 months; reports association, never causation. |
| E Exposure | `exposure.ts` | Per hazard: climate signal × business sensitivity, preparedness (measures in place, gaps, unknown), incident history and impact pathways. Unknown stays unknown. |
| F Financial | `financial.ts` | Baseline (daily figures = monthly ÷ 30, runway, debt-service coverage, working capital, downtime tolerance) and six hypothetical scenarios. Cash impact = margin lost + one-off recovery cost; fixed costs are not added again. Platform assumptions (heatwave days and output loss) are labelled as such. |
| G Risk | `risk.ts` | Climate-adjusted risk from eight weighted dimensions (hazard 15, exposure 15, operational 15, adaptive capacity 10, supply chain 10, liquidity 15, debt service 10, revenue at risk 10), renormalised over available dimensions. Resilience from seven equal-weight dimensions. |
| H Adaptation | `adaptation.ts` | Prioritised measures for exposed hazards with horizon and the scenario each targets. Costs appear only when the business entered them. No payback or avoided loss is estimated. |
| Profiles | `profiles.ts` | Supplier flags, input gap days, concentration (HHI); operational dependencies. |

`snapshot.ts` combines them into the analysis package and hashes it (SHA-256, stable key order, creation time excluded), so identical inputs produce the same snapshot.

## Core reports

| Type | Report | Main content |
| --- | --- | --- |
| `msme_360` | MSME 360° Risk Profile | Business profile, indicators, top threats, financial vulnerabilities, data quality, sources |
| `climate_exposure` | Climate Exposure Assessment | Hazard overview, forecast outlook, warnings, one section per hazard, regional context, long-term change |
| `climate_adjusted_financial_risk` | Climate-Adjusted Financial Risk | Baseline, risk dimensions, debt-service pressure, insurance position, monitoring, methodology |
| `revenue_at_risk` | Revenue-at-Risk | Revenue baseline, revenue at risk by scenario, tolerance, seasonality, revenue and weather history |
| `operational_vulnerability` | Operational Vulnerability | Dependencies, utility reliability, downtime tolerance, workforce exposure, impact pathways, past incidents |
| `supply_chain` | Supply-Chain Climate Risk | Supplier register, concentration, buffers and switching time, supplier scenario, actions |
| `stress_test` | Climate Stress-Test | Scenario results, liquidity under stress, parameters and their origin, insurance |
| `resilience` | Resilience Score & Assessment | Seven resilience dimensions, strengths, weaknesses |
| `adaptation_plan` | Adaptation & Investment Plan | Prioritised measures, action timeline, investment summary |
| `executive_one_page` | Executive One-Page | Profile, indicators, key threats and vulnerabilities, top five actions |

A report is still produced when inputs are missing. Its status becomes **completed with limitations**, and the first limitation lists the missing inputs. It is also limited when the assessment itself is incomplete or stale.

## Catalogue

`lib/intelligence/catalogue.ts` lists every report type from the 24 categories. Each entry is either a core report, a named section inside a core report, or **needs data** with the missing input stated (peer datasets, portfolio data, a validated credit model, asset values, metered consumption, production records, a sub-seasonal forecast, streaming monitoring). Unavailable reports are never shown as functional.

## AI narrative

- Server-only (`lib/ai/openai.ts`, `openai-provider.ts`); the key is never sent to the browser, logged or stored.
- The writer receives an evidence list (metric values, findings, section text, table rows, actions) inside `<evidence>` tags, with business free text cleaned of control characters and markup.
- Structured output (`aiReportSchema`): headline, executive summary, key findings with evidence ids, section narratives, recommendations with evidence ids.
- Validation rejects any number not present in the evidence, unknown evidence or section ids, and banned phrasing: PD, EAD, LGD, default probability, credit score or rating, approve or reject a loan, guarantees, "caused" or "proves", certainty claims, invented percentage chances, and industry, sector or peer benchmarks.
- One repair round with the errors; if still invalid, or on a provider error or timeout, the rules narrative is used and the reason is shown on the report.
- Figures, charts and tables always come from the template, whatever the AI returns.
- `ai_usage_events` records model, outcome, tokens, latency and estimated cost per call.

## Viewer and exports

`/reports/[id]` shows the contents, executive summary, key metrics (each with value type and source), sections with charts (title, unit, period, source and explanation on every chart; missing data is not drawn as zero), tables, callouts, recommended actions, methodology, assumptions, limitations, data gaps, sources and the disclaimer. Versions can be compared metric by metric.

`/api/intelligence/[id]/pdf|xlsx|csv` read through the signed-in user's row-level security:

- **PDF**: cover, contents with page numbers, vector charts, tables, and a footer with title, version, generation time and page x of y. Text is transliterated to the fonts' character set.
- **Excel**: Summary, Metrics, one sheet per table, Chart data, Actions, Method & limits, Sources.
- **CSV**: one row per metric, table row, chart point, action, limitation and source.

Spreadsheet cells that start with `=`, `+`, `-` or `@` are prefixed so they are not executed as formulas.

## Database

`supabase/migrations/20261011090000_intelligence_reports.sql` adds `analytical_snapshots`, `intelligence_report_batches`, `intelligence_reports` and `ai_usage_events`, with forced row-level security. Owner, admin and analyst can read and write reports; usage events are readable by owner and admin. "Outdated" is computed when the page loads (the assessment is stale or superseded) and is not stored.

## Tests

- `tests/unit/intelligence.test.ts`: catalogue integrity, normalisation, scenario arithmetic (no double counting of fixed costs), withheld finances, Pearson correlation and monthly aggregation, AI validation, and an end-to-end run for a **synthetic** manufacturing MSME (`tests/fixtures/synthetic-manufacturer.ts`): deterministic snapshot hash, all ten reports, stale handling, accepted AI narrative, rejected AI narrative and provider error fallback.
- `tests/unit/intelligence-exports.test.ts`: PDF page count and metadata for all ten reports, Excel sheets, CSV structure, formula neutralisation.
- `tests/security/client-boundary.test.ts`: no OpenAI key or server AI module in client code, server-only guards, no public AI key variables, and no key name or value in built client bundles.

## Known limitations

- The OpenAI path has been tested with a test double only, because no key is configured. Set `OPENAI_API_KEY` server-side to use it.
- Generation runs inside the request's `after()` window. Very large batches on hosts with short function limits should be split, or moved to a queue worker.
- The rate limiter is in memory and per server instance.
- Revenue and weather comparisons need at least 12 months of business-entered revenue.
