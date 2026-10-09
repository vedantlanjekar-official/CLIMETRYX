# Scoring methodology

Version: `fin05-vulnerability-1.2.0` (1.2.0 adds the wet-bulb heat screen and the CAPE storm context). Climatology model: `fin05-climatology-1.0.0`.

The indicator runs from 0 to 100. Higher means higher estimated climate-disruption vulnerability. It is not a probability of default, a credit score, or a lending decision.

## Components

| Component | Baseline weight |
| --- | --- |
| Hazard context | 30% |
| Operational sensitivity | 25% |
| Adaptive-capacity gap | 20% |
| Supply-chain vulnerability | 15% |
| Financial sensitivity | 10% |

Weights are assumptions. Evidence completeness is not inside the weighted score.

## Missing data

A missing component is removed. Remaining weights are renormalized and the removal is explained. A missing hazard does not become zero. If the remaining business-reported score is low, the result still says that this is not a low-risk finding.

Hazard context is the mean of the flood, heat, drought, and storm indicators that have values.

## Local climatology

Each site is snapped to the 0.25° ERA5 grid. The app fetches daily ERA5 data for 1991–2020 (the WMO standard normal period) from the Open-Meteo Historical Weather API and fits:

- Heat: 90th, 95th and 99th percentiles of daily maximum temperature.
- Rain: 95th and 99th percentiles of wet-day (≥1 mm) totals, the 99th percentile of 3-day totals, and empirical 2-year and 10-year 1-day levels from the 30 annual maxima.
- Wind: 95th and 99th percentiles of daily maximum gust, plus empirical 2-year and 10-year levels.
- SPI-30 and SPI-90 (Standardized Precipitation Index, McKee et al. 1993; WMO-No. 1090) per calendar month: a gamma distribution with a point mass at zero is fitted to the 30 month-end window totals, then mapped to a standard normal and clamped to ±3.

Fits are cached for each organization and grid cell in `climatology_models`. If the fit cannot be obtained, the assessment uses the fixed thresholds below, lists a limitation, and marks the optional `climatology` evidence slot as missing.

This is statistical calibration, not supervised machine learning. No labelled business-disruption outcomes exist yet, so nothing is trained to predict losses.

### Out-of-time check

`npm run train:climatology` fits 1991–2010 and counts exceedances in 2011–2020. For a stable climate, a 95th percentile threshold should be exceeded on about 5% of test days. A ratio above 1.5 is reported as a shift, below 0.5 as less frequent. At Pune, maximum temperature exceeded the 1991–2010 P95 on 7.6% of 2011–2020 days, so recent heat is more frequent than the training years suggest.

## Thresholds

- Heat uses the largest of three shares of forecast days: days above the fixed limit (35°C outdoor labour, 32°C food or cold chain, 38°C otherwise), days above the local P95 with days above the local P99 counted twice, and days whose forecast wet-bulb maximum reaches 31°C. The 31°C screen is the critical environmental limit Vecellio et al. (2022) measured for young, healthy adults at low workload. Wet-bulb is a shade value, not wet-bulb globe temperature, so sun, radiant heat and heavy work can make conditions unsafe below it.
- Rainfall screening flags 24-hour totals of at least 50 mm or the local wet-day P99, and 72-hour totals of at least 100 mm or the local 3-day P99. A day at or above the local 10-year level scores 80. An official warning scores 85. Screening is not an official warning.
- Drought uses the drier of SPI-30 and SPI-90: ≤ −1 moderately dry (45), ≤ −1.5 severely dry (70), ≤ −2 extremely dry (85), otherwise 15. Without SPI it falls back to 30-day percent of normal with at least five baseline years. Three dry days are not drought. SPEI is not calculated.
- Storm screening uses a 20 m/s gust or the local P99 (70), and 25 m/s or the local 10-year level (85). Forecast CAPE of at least 2500 J/kg, a common forecaster reading of strong instability, raises a quiet-wind score from 15 to 40. CAPE alone never reaches the gust bands.
- Context only, with zero weight: rain probability and daily rain hours (flood), and forecast rain minus FAO-56 reference evapotranspiration plus modelled 27–81 cm soil moisture (drought). They have no local baseline yet, and volumetric soil moisture depends on soil type.
- Population exposure from the World Bank flood grid is context only and has a zero weight in the business flood score.
- Financial sensitivity uses cash divided by daily fixed cost. Daily figures divide monthly amounts by 30 and annual amounts by 365. Missing cash is not zero runway.

## Stress tests

Scenarios of 1, 3, 7, and 14 days multiply user assumptions for lost revenue and continuing costs. The output is labelled hypothetical.

## Questionnaire inputs

`lib/questionnaire/mapping.ts` turns the business assessment into the scoring request. The same answers and provider data always produce the same score; a test checks this.

- Dependencies (electricity, water, cooling): critical or high → yes, moderate or low → no, not sure → unknown.
- Perishable inventory, outdoor work: yes, no or unknown as answered. Maximum tolerable downtime is used as entered.
- Measures: only `implemented` closes a gap. Partial, planned and not in place count as no. Not relevant and not sure are unknown and are left out rather than counted against the business.
- Suppliers: only when the business says it has critical suppliers. Spend share is entered as a percentage and passed as a fraction. Regional supplier hazard is not scored yet.
- Financial sensitivity: only when the business chooses to include figures. Stress scenarios use the entered lost-revenue and continuing-fixed-cost shares; when missing, both default to 100% and the output stays labelled hypothetical.
- Heat profile: outdoor when the outdoor work, agriculture or construction branch is active; food or cold chain when that branch is active; otherwise general.
- Utility outage answers are recorded as business-reported context.
- Not scored in 1.2.0: past incidents, hazard-specific sensitivity answers, assets and cost items. They are stored with the input version for later calibration and review.
- Official warnings come from the SACHET alerts whose polygons contain the site. Flood takes only rain, flood, inundation, cloudburst, cyclone, storm-surge or dam events, and storm takes only storm, wind, cyclone, squall or gust events, so a thunderstorm alert cannot raise the flood score.
- Flood population exposure comes from the World Bank grid around the pin and keeps its zero weight.
- The satellite evidence slot counts as present when a Sentinel-2 scene with NDVI was retrieved. NDVI and NDWI themselves are not scored.
- Water stress is still passed as unavailable, so that slot is reported as missing.

## Regional context and the report

River discharge (GloFAS), CMIP6 projections, flood exposure, satellite indices and official alerts are gathered in parallel for each site and shown beside the score in three separate sections: hazard and regional context, business vulnerability and resilience, and the hypothetical financial scenarios. Except for matching official warnings, none of these layers changes the score. The written summary is produced by rules, or by an AI model when a gateway key is configured; the AI draft is discarded unless every number and citation is found in the evidence pack.

Each operating site with valid coordinates is scored separately, up to five per submission, primary site first. A site whose pin is neither confirmed nor accepted as approximate cannot be submitted.

## Changes

A later run stores the previous score, component deltas, and the reason a component moved by at least 0.5 points or changed availability. For questionnaire submissions the comparison is made per site against that site's previous assessment, which is then marked superseded. When a material answer changes, existing results are marked stale with the reason and stay readable until the new job finishes.
