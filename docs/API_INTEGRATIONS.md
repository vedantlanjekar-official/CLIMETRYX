# API integrations

Statuses below are from checks on 9 October 2026. They are also recorded in `metadata/source-registry.json`.

| Source | Status | What was checked |
| --- | --- | --- |
| Open-Meteo forecast | Verified, configured | HTTP 200 for 18.5204, 73.8567. Daily maximum temperature, precipitation, gusts, and probability were present. `OPEN_METEO_MODE=non_commercial` is set in `.env.local`. The adapter also requests daily `wet_bulb_temperature_2m_max`, `et0_fao_evapotranspiration`, `precipitation_hours`, `cape_max` and hourly `soil_moisture_27_to_81cm`; all returned values with the expected units at 18.52, 73.86. `lightning_potential` returned no data for India (it comes from a European model) and is not requested. |
| Open-Meteo archive (ERA5) | Verified | `models=era5` returned 10,958 non-null days of maximum temperature, precipitation and gusts for 1991–2020 at grid 18.5, 73.75. `era5_land` returned null daily precipitation and gusts on this route, so it is not used. |
| ERA5 climatology | Verified | `fetchEra5Daily` feeds `lib/climatology`. Fits are cached in `climatology_models`. Reference fits are in `data/models/climatology/`. |
| Open-Meteo geocoding | Verified | Search for Pune returned Pune, India at 18.51957, 73.85535. |
| CCKP | Partial verification | The documented India climatology URL returned success with a single time key, `1995-07`, not the full 1995–2014 period. The adapter marks that coverage partial and does not fill the gap. |
| Microsoft Planetary Computer, Sentinel-2 L2A | Verified, used | STAC search, then `/item/statistics` for NDVI and NDWI from B03, B04 and B08 over a 1 km square, and a categorical scene-classification histogram for cloud over that square (classes 0, 3, 8, 9, 10 count as cloudy). The latest scene within 120 days with at most 10% local cloud is used, plus the clearest scene within 30 days of the same date a year earlier. At Pune the 5 October 2026 scene had 0% local cloud and NDVI mean 0.158. True-colour and NDVI tile templates feed the report map. Context only; not scored. |
| Copernicus STAC `sentinel-2-l2a` | Catalog verified, fallback | Used only when Planetary Computer returns nothing. Bands are not downloaded there, so NDVI stays `not_available` on this path. |
| World Bank flood exposure (DR0089139) | Verified, used | Country GeoTIFFs are read in small windows over HTTP with `geotiff`, using `data/catalog/floodpop-index.json`. Within about 556 m of Pune, 22.3% of residents live where the modelled 1-in-100-year depth exceeds 0.15 m. Bands 1–5 are read as none, low, moderate, high and very high depth classes; that labelling is inferred and should be confirmed against the dataset Read Me. Context only; zero weight. |
| Open-Meteo Flood API (GloFAS) | Verified, used | Daily river discharge from 1991 to last year plus a 30-day forecast with the ensemble median and maximum at the nearest river cell. Complete years need at least 330 days and at least 15 years are required. At Pune: 29 years, typical annual peak 1136.63 m³/s, 10-year level 2688.06 m³/s. Context only. |
| Open-Meteo Climate API (CMIP6 HighResMIP) | Verified, used | Three models (EC_Earth3P_HR, MRI_AGCM3_2_S, MPI_ESM1_2_XR), 2000–2014 against 2036–2050, at the nearest 0.25° cell. Reports the median change, the model range and whether models agree on the sign. Projections, not forecasts; context only. |
| NDMA SACHET CAP feed | Verified, used | The RSS feed lists CAP 1.2 alerts; each alert and its polygons are fetched and the site is tested against them. India only. On 9 October 2026, 41 alerts were active and none covered Pune. Flood scoring only takes alerts whose event mentions rain, flood, inundation, cloudburst, cyclone, storm surge or dam; storm scoring only takes storm, wind, cyclone, squall or gust events. |
| Basemaps | Verified | OpenFreeMap Liberty street style (OpenStreetMap data, ODbL). EOX Sentinel-2 cloudless 2023 mosaic, CC BY-NC-SA 4.0, non-commercial only. |
| AI Gateway (report summary) | Needs a key | With `AI_GATEWAY_API_KEY` set, `AI_NARRATIVE_MODEL` (default `google/gemini-3.8-flash`) writes the summary from an evidence pack. Every number and evidence id is checked against the pack and banned phrasing is rejected; otherwise, and whenever no key is set, a rules-written summary is shown. The AI never changes the score. |
| OpenAI Responses API (AI Reports Centre) | Needs a key; not verified live | `lib/ai/openai.ts` and `lib/intelligence/reports/openai-provider.ts`, server-only. `generateText` with `Output.object` (structured output against `aiReportSchema`), 90 s timeout, 2 SDK retries, then one repair round with the validation errors. The model only rewrites the narrative from an evidence list built from the deterministic report; numbers, citations, section ids and banned phrasing are checked, and anything ungrounded falls back to the rules narrative. Every call is logged to `ai_usage_events` (tokens, latency, outcome, estimated cost when prices are configured), never the key or the prompt. No request was sent during development because no key is configured. |
| ERA5 monthly weather for revenue history | Verified route, used when 12+ months exist | `fetchEra5Daily` for the months the business entered, aggregated to monthly rainfall, mean maximum temperature, days at or above 35 °C and days with at least 64.5 mm. Used for association only, never causation. |
| CHIRPS v3 | Needs download | v2 remains only as the research-note citation. |
| IMERG | Needs NASA Earthdata credentials | No product request was sent. |
| ERA5-Land through Copernicus CDS | Needs a CDS key | Not required for the current climatology, which uses ERA5 through Open-Meteo. |
| Aqueduct 4.0 | Needs an export | CSV rows are schema-checked. There is no invented API. |
| Global Flood Database | Licence and download not verified | Paper URL only. |
| Official warnings outside India | Not configured | SACHET covers India only. Forecasts are never labelled as warnings. |
| Two organizer references | Unavailable | The research note could identify only the flood dataset. They were not guessed. |

Free Open-Meteo use is non-commercial, and so is the EOX mosaic. Set `OPEN_METEO_MODE=commercial` and a customer key, and replace or license the mosaic, before a commercial deployment. World Bank data is CC BY 4.0; Sentinel-2 data needs the Copernicus attribution shown in the report.

## Rate limits

The free tier has a weighted per-minute limit. A 30-year daily request is heavy, so fitting several cities in a row returns HTTP 429. `fetchJson` honours `Retry-After` up to 5 seconds and then reports the limit. The training script waits 65 seconds and retries up to three times. In the app, a fitted model is reused from memory for 7 days and from `climatology_models` after that, so each grid cell is fetched once per organization.

Long multi-variable requests count as several calls, so climate projections are requested last, as two 15-year windows for three models, and cached for 30 days. After a burst of test runs the hourly quota can still be spent; the report then lists the 429 as a limitation and shows the affected layer as unavailable rather than guessing.

## Freshness

Forecasts are fresh for 3 hours and stale after 12. Historical series use a longer window. Static hazard extracts are not refreshed on every assessment.
