# FIN-05: Climate-Adjusted Business Risk for MSMEs
## Research-backed learning document and feasibility assessment

**Prepared:** 9 October 2026  
**Purpose:** Understand the challenge, verify candidate datasets, and decide what can credibly be demonstrated before architecture or coding begins.  
**Status:** Research and concept assessment only — no application code or production design.

> **Scope and source-integrity note.** The pasted brief available for this review begins partway through an earlier section. It explicitly names the World Bank dataset **“Global Flood Exposure: Gridded exposure headcounts by country,”** but the names or links for the other two institution-provided references do not appear in the supplied text. I have not guessed which sources the challenge organizer intended. The inventory below marks this gap and includes documented, practical alternatives. Before implementation, compare this inventory against the original, complete challenge brief and restore the two missing references.

---

## Contents

1. [Executive Explanation](#section-1-executive-explanation)
2. [One Concrete Example](#section-2-one-concrete-example)
3. [Problem Statement Decomposition](#section-3-problem-statement-decomposition)
4. [Essential Concepts Glossary](#section-4-essential-concepts-glossary)
5. [Climate-to-Financial-Risk Relationship](#section-5-climate-to-financial-risk-relationship)
6. [Input-by-Input Requirements Analysis](#section-6-input-by-input-requirements-analysis)
7. [Research Findings on the Three Supplied Resources](#section-7-research-findings-on-the-three-supplied-resources)
8. [Verified Dataset Inventory](#section-8-verified-dataset-inventory)
9. [Data-to-Score Pipeline](#section-9-data-to-score-pipeline)
10. [Scoring Approaches](#section-10-scoring-approaches)
11. [Example Output](#section-11-example-output)
12. [Lending and Early Intervention Use Cases](#section-12-lending-and-early-intervention-use-cases)
13. [Risks and Limitations](#section-13-risks-and-limitations)
14. [Recommended MVP Scope](#section-14-recommended-mvp-scope)
15. [Major Unknowns and Research Gaps](#section-15-major-unknowns-and-research-gaps)
16. [Key Takeaways](#section-16-key-takeaways)
17. [Next-Stage Research Checklist](#section-17-next-stage-research-checklist)

**Reference list:** [Sources and research references](#sources-and-research-references)

---

## Section 1: Executive Explanation

FIN-05 is about helping a lender or small business understand how climate hazards could disrupt a micro, small, or medium-sized enterprise (MSME), and how that disruption might affect the business's ability to pay its bills and repay financing. A flood can damage stock, block access, interrupt electricity, or keep customers away. Extreme heat can increase cooling costs, reduce worker productivity, spoil temperature-sensitive goods, or lower demand. Drought can constrain water supply or affect agricultural inputs. These events do not automatically mean that a business will default: the financial outcome depends on the hazard, where and how the business operates, its dependencies, insurance and adaptation, available cash, and the duration of disruption.

The central technical challenge is **linking environmental exposure to business-specific consequences without pretending that broad environmental data are precise borrower-level loss estimates**. Public datasets can often characterize weather, climate conditions, flood hazard in some regions, population exposure, land cover, and regional water stress. Public data usually cannot reveal a specific shop's building condition, stock value, exact outage history, supplier contracts, insurance terms, revenue trajectory, cash balance, or loan repayment capacity. Those inputs must be supplied with consent by the owner or lender, or explicitly marked synthetic in a demonstration.

The intended users are:

- **Business owners:** understand likely disruption pathways and take practical preparedness steps.
- **Loan officers and portfolio risk teams:** add climate context to normal credit assessment and identify cases needing review.
- **Risk managers or development programs:** identify regional or sector patterns and target resilience support.

A defensible MVP should therefore produce an **explainable climate-disruption and business-vulnerability assessment**, not a supposedly predictive credit score. It should show individual risk drivers, data sources, dates, uncertainty, and actions alongside any composite indicator. It can support human review and early intervention. It must not automatically approve or reject a loan, claim default probability, or claim measured financial losses without appropriate labels and validation.

The recommended initial approach is a transparent rules-based assessment using a small number of well-documented variables, one or two public environmental sources, and a manually entered fictional business profile. Add machine learning only after the team obtains representative, consented, historical business outcomes and can conduct credible out-of-time validation.

## Section 2: One Concrete Example

Consider a **fictional food-and-bakery business** with a shop and small cold-storage room in a low-lying district. All financial values below are invented for explanation, not real observations.

1. **Hazard signal:** a public weather service forecasts unusually heavy rain over the next three days. A suitable flood-hazard layer also suggests that low-lying parts of the district can be inundated. The forecast is a short-range weather signal; the flood layer is a separate hazard-context source. Neither alone tells us whether this shop will flood.
2. **Exposure:** the shop's coordinates fall inside or near an area flagged by a flood-hazard product. That result must be interpreted at the grid's true resolution and positional accuracy. If only a broad district or population-exposure layer is available, the output is regional context—not a statement that the premises are inside floodwater.
3. **Operational pathway:** the shop could close for two days, receive fewer customers, lose perishable ingredients during a power outage, and pay for cleanup. A supplier road could also be disrupted even if the shop itself remains dry.
4. **Business vulnerability:** the owner reports that refrigeration is essential, there is no backup power, the primary ingredient supplier has no immediate substitute, and the business has only a few days of operating cash. These are business-specific facts, not variables that a weather API can infer.
5. **Financial sensitivity:** the same closure has different implications for a business with three months of cash reserves than for one that cannot cover payroll and rent for a week. The model should represent this difference without asking for more sensitive financial data than needed.
6. **Output:** the system shows “Elevated near-term disruption concern” because forecast rainfall is high relative to the chosen local baseline, the available flood layer indicates possible area-level exposure, and the owner-reported resilience indicators are weak. It lists the evidence and its age, confidence limits, and steps such as moving stock above floor level, testing backup power, confirming alternate suppliers, and reviewing insurance.
7. **Lending use:** a loan officer may contact the borrower, discuss a temporary cash-flow scenario, or consider a resilience investment. The indicator is not a loan decision, does not estimate default probability, and should not raise the borrower's price or deny credit solely because the business is in a disadvantaged region.

**Core lesson:** climate hazard is only the beginning of the causal chain. The business's actual exposure, sensitivity, coping capacity, and financial position determine whether a hazard becomes a material financial disruption.

## Section 3: Problem Statement Decomposition

The available brief describes a solution that combines business location, satellite/weather/climate information, selected flood/heat/drought indicators, utility and supply-chain dependencies, and financial indicators to help support lending decisions and early intervention. The table below translates that intent into engineering requirements. It is a decomposition of the supplied brief, not a claim that the institution mandates a particular algorithm.

| Requirement | Meaning | Technical implication | Demonstrable output |
|---|---|---|---|
| Identify business location | Know where the premises or important assets are. | Validate address, country, latitude/longitude, geocoding source, and positional accuracy; support multiple sites where needed. | A verified map pin and geolocation-quality label. |
| Use satellite imagery | Add observed evidence about land surface, vegetation, flood extent, or site context. | Obtain imagery for a defined region/date; mask clouds for optical imagery; use radar for flood mapping where appropriate; do not claim the image alone measures loss. | A dated imagery layer or derived indicator with resolution and limitations. |
| Use weather forecasts | Warn about near-term conditions that may cause disruption. | Fetch only documented variables and forecast horizons; preserve issue time and valid time; show model/provider. | A time-bounded alert and source timestamp. |
| Assess flood exposure | Understand whether premises or operations may overlap modeled/observed flood hazards. | Separate flood extent/depth from the people living in the hazard area; use local hazard datasets where possible. | A hazard/exposure layer and explicit resolution caveat. |
| Assess heat and drought | Identify heat stress and moisture/water scarcity pathways. | Derive indicators from temperature, humidity, rainfall, soil moisture, evapotranspiration, or vetted drought indices. | Heatwave duration, rainfall anomaly, or drought context metric. |
| Consider utilities | Determine whether water or electricity disruption could amplify losses. | Use direct outage data only when available; otherwise label user reports or coarse regional proxies. | A dependency and resilience assessment. |
| Consider supply chains | Represent risks outside the shop's location. | Capture supplier locations, criticality, concentration, route dependency, and substitution options. | A supplier-dependency map or questionnaire summary. |
| Consider financial indicators | Estimate how disruption could strain cash flow and repayment ability. | Collect minimal, consented inputs; track units/time period; never assume banking access. | A liquidity sensitivity flag or user-reviewed stress scenario. |
| Produce a risk score | Summarize diverse evidence. | Normalize metrics, document weights, handle missingness, keep underlying sub-scores visible, and sensitivity-test choices. | A transparent index with risk drivers and data-quality score. |
| Support lending and intervention | Help people take appropriate action. | Keep human review, distinguish climate assessment from creditworthiness, log decisions, and monitor outcomes. | An explainable case report and practical next steps. |

**What the problem does not establish:** it does not establish access to lender portfolios, account-level transaction data, insurance claims, detailed utility-outage records, historical loan defaults, or a validated financial-loss label. It also does not prescribe a specific model, score range, feature weights, or production deployment. Treat those as open decisions.

## Section 4: Essential Concepts Glossary

| Term | Plain-English meaning | Why it matters here |
|---|---|---|
| MSME | Micro, small, or medium-sized enterprise; precise definitions vary by jurisdiction. | Business sizes, data coverage, and lending practices differ by country. |
| Climate hazard | A potentially damaging event or trend, such as flood, extreme heat, drought, or cyclone. | Describes the physical threat, not the resulting loss. |
| Hazard probability / return period | A statistical description of how often an event of a given magnitude may occur. | A “1-in-100-year” event is not a guarantee of one event every 100 years or a forecast for next year. |
| Exposure | People, assets, activities, or operations located where a hazard can affect them. | A flood map and a business point must be spatially aligned to estimate exposure. |
| Vulnerability / sensitivity | How badly the exposed business could be affected. | Stock on the floor, temperature-sensitive goods, weak buildings, and no backup power can change outcomes. |
| Adaptive capacity / resilience | The ability to prepare, absorb disruption, recover, and adapt. | Cash reserves, insurance, backup utilities, suppliers, and contingency plans can reduce consequences. |
| Physical climate risk | Risk caused by acute events (such as floods) and chronic changes (such as heat or water stress). | This is the main risk class for the proposed prototype. |
| Transition risk | Financial or operational impact from the shift to a lower-carbon economy, such as policy or technology changes. | Related to climate finance but distinct from the physical-hazard scope emphasized in the brief. |
| Hazard map | A spatial representation of where a hazard may occur or how intense it could be under a defined scenario. | Not the same as exposure or expected loss. |
| Population exposure | Estimated number of people living in areas exposed to a modeled hazard. | Useful for contextual screening; not a business-level loss estimate. |
| Reanalysis | A historical weather reconstruction combining observations with a numerical weather model. | Useful for long-term comparisons, but not identical to a local weather-station observation. |
| Forecast | A model-based estimate of future weather over a stated horizon. | Short-term and uncertain; not a climate projection. |
| Climate projection | A modeled range of future climate under specified emissions/socioeconomic scenarios. | Used for long-term planning, not next-week alerts. |
| Spatial resolution | The size of a grid cell or smallest represented geographic unit. | A 10 km weather cell cannot describe the exact conditions inside a single building. |
| Temporal resolution | How often values are reported, e.g. hourly, daily, monthly, annual. | Daily maxima and hourly heat stress answer different questions. |
| SPI / SPEI | Standardized Precipitation Index / Standardized Precipitation-Evapotranspiration Index. | Indicators of unusually dry or wet periods; SPEI accounts for evaporative demand, while SPI uses precipitation. They require a defined baseline and calculation method. |
| Soil moisture | Estimated water held in soil layers. | Useful for agricultural and land-surface drought signals; not equal to municipal water reliability. |
| Water stress | Pressure on available water supply relative to demand or other hydrological conditions. | Can contextualize water-dependent businesses but does not prove that a specific utility will fail. |
| Feature engineering | Turning raw variables into meaningful indicators, such as number of very hot days or rainfall anomaly. | Most business-relevant metrics are derived, not provided as a ready-made “business risk” field. |
| Label / target | A known historical outcome used to train or evaluate a model, such as documented interruption losses. | Without reliable outcomes, a machine-learning score cannot be validated as predicting loss or default. |
| Calibration | Agreement between predicted probabilities and observed event frequencies. | Essential before describing an output as probability or using it in credit decisions. |
| Data provenance | Record of source, version, date, transformations, and responsible party. | Makes the risk result traceable and auditable. |
| Synthetic data | Artificial data created for a demonstration or test. | Useful for a hackathon, but must never be presented as real borrower information. |

## Section 5: Climate-to-Financial-Risk Relationship

A practical conceptual chain is:

**Hazard → physical exposure → operational disruption → revenue/cost/cash-flow change → repayment-capacity pressure → possible credit risk.**

A second chain is **hazard → supplier or transport disruption → input shortage/delivery delay → lost production or sales → cash-flow pressure**. A third is **chronic heat/water stress → higher operating costs or lower productivity → reduced margins over time**.

Each arrow is conditional, not inevitable:

1. **Hazard:** a flood, heatwave, drought, or severe storm occurs or is forecast. Data may be modeled, forecast, observed, or projected; these are not interchangeable.
2. **Exposure:** the business, employees, inventory, customers, suppliers, roads, power infrastructure, or water systems are in the affected area. Location error or coarse grids can make this uncertain.
3. **Operational disruption:** the building may remain dry while roads close; an area may be hot while a refrigerated business is unaffected if power is reliable; a drought may be immaterial to a water-independent service firm but severe for a food processor.
4. **Business impact:** the disruption changes working hours, volume, prices, spoilage, repair costs, input costs, delivery, or demand. This is sector- and business-specific.
5. **Financial impact:** revenue can fall while rent, wages, interest, and debt payments remain due. Insurance, emergency financing, savings, government support, substitution, or rapid recovery can offset impact.
6. **Credit impact:** repayment capacity could deteriorate, but whether this becomes arrears or default also depends on loan terms, lender conduct, borrower behavior, and support mechanisms.

Do not use a hazard map as a substitute for business vulnerability. Do not use a climate risk metric as a substitute for credit risk. Those concepts can be linked only through transparent assumptions or validated evidence. Climate forecasts also should not be described as long-term climate projections. Basel Committee guidance notes that climate-related risk drivers can flow through traditional financial risk categories; it does not imply that any one climate score predicts a borrower outcome [14].

---

## Section 6: Input-by-Input Requirements Analysis

### 6.1 Business location

**Direct input:** a street address or owner-provided latitude/longitude for each site, with a site type (shop, warehouse, plant, farm, office, supplier, or other). Record who supplied it, when, the geocoding method, positional accuracy, and whether the point is the actual operating site or only a postal/registered address.

**Derivable variables:** distance to a river/coast if a relevant hydrographic layer exists; elevation from a digital elevation model; overlap with flood/heat/drought layers; local climate grid cell; and administrative-region identifiers. These require geospatial processing and suitable data.

**Failure modes:** geocoding can land on a district centroid, a street centerline, or an office rather than the asset. A coordinate may be in the wrong datum/order. A single business may have multiple premises. The UI should expose the pin and let the owner correct it. Do not output exact-building claims from a low-resolution raster.

### 6.2 Satellite imagery

Optical satellites can describe land cover, vegetation, surface water, and site surroundings. Copernicus Sentinel-2 provides 13 spectral bands at 10 m, 20 m, and 60 m resolutions; actual usable imagery depends on acquisition dates, cloud cover, viewing geometry, and processing level [6]. Radar imagery such as Sentinel-1 can be useful for flood extent because radar can collect observations through cloud cover and at night, but flood mapping still requires suitable algorithms, reference data, and care around urban surfaces and vegetation.

**Potential features:** normalized difference vegetation index (NDVI), surface-water extent, pre-/post-event change, vegetation anomaly, observed inundation area, or land-cover context. NDVI is conventionally calculated as `(near-infrared - red) / (near-infrared + red)`. This is a derived metric, not a “business vulnerability” variable supplied by the satellite provider.

**MVP recommendation:** do not download global imagery or build a computer-vision pipeline first. Choose a single demonstration region, retrieve a small set of dates for one fictional or consented site, and show a dated satellite layer. If the business is not agricultural, do not use a vegetation index as a generic business-risk measure. If imagery processing cannot be validated during the hackathon, present imagery as context rather than as a scored feature.

**Access:** Copernicus Data Space Ecosystem offers Sentinel data and programmatic services. API access and collection-specific usage instructions must be checked for the chosen service; do not assume every data product is available through a single simple API [6].

### 6.3 Weather forecasts and historical weather

A forecast provides a short-term estimate, not a promise. Open-Meteo's documented Weather Forecast API offers a default seven-day forecast and up to 16 days, with available fields including temperature, apparent temperature, precipitation, precipitation probability, wind/gusts, humidity, and other variables depending on model/product [3]. The Historical Weather API provides reanalysis-based series: ERA5 from 1940 at about 0.25 degrees, ERA5-Land from 1950 at about 0.1 degrees, and newer ECMWF IFS data at roughly 9 km from 2017. The documentation recommends using ERA5 or ERA5-Land consistently for multi-decade climate analysis because model changes can affect continuity [4].

**Direct variables when the selected product supports them:** air temperature, daily maximum/minimum temperature, precipitation, humidity, wind speed/gust, apparent or wet-bulb temperature, reference evapotranspiration, and certain soil variables. Availability differs by API product and model. Never assume a variable shown in one product can be requested from every API endpoint.

**Derived variables:** number of days above a chosen temperature threshold; consecutive hot days; cumulative rainfall over 1/3/7 days; rainfall anomaly against a baseline; intensity-duration flags; and comparisons with local seasonal percentiles. These require explicit thresholds, time aggregation, and a baseline.

**Access/terms:** Open-Meteo's free API is stated for non-commercial use and lists limits of fewer than 10,000 calls/day, 5,000/hour, and 600/minute; its terms refer to CC BY 4.0 for data and require attribution. Commercial product use requires an applicable paid plan. Confirm the terms against the planned use and current pricing page before release [5].

**MVP recommendation:** request a small, cached forecast for the business coordinates and a relevant historical baseline. Store issue time, valid time, model/provider, requested variables, units, and data freshness. When the forecast changes, show that the indicator was recalculated rather than labeling the system “real-time” by implication.

### 6.4 Flood risk

Flood **hazard** requires information about flood extent, depth, intensity, or probabilities/return periods. Flood **exposure** overlays a hazard with assets or people. For business-level assessment, the useful combination is a flood-hazard layer plus a sufficiently accurate business point/footprint. A historical satellite-detected flood layer can show observed events; it does not by itself estimate future probability. A return-period model can describe a modeled scenario; it is not a forecast for the next few days.

The specified World Bank resource measures population exposed to modeled inundation depths, at 3-arcsecond grid resolution, in a global coverage product. It is useful for contextual screening and comparing population exposure, but does not establish the flood depth at a named shop or quantify its losses [1, 2]. See Section 7 for its exact suitability judgment.

**Candidate additions:** local/national official flood maps, drainage/river flood models, and observed flood extent products. For a global historical complement, the Global Flood Database maps selected observed flood events for 2000–2018 from MODIS-derived information at about 250 m; coverage is of documented events in that period rather than a complete forward-looking flood probability surface [12]. Access methods and dataset status must be checked before building around it.

### 6.5 Heat and drought

**Heat indicators:** daily maximum temperature, consecutive days above a local threshold, apparent temperature, wet-bulb temperature, hot nights, or hot working hours. A fixed global threshold can misrepresent local adaptation; use locally appropriate thresholds if justified and disclosed. Humidity changes physiological heat stress. Outdoor workers, agriculture, construction, transport, restaurants, cold storage, and electricity-intensive businesses have different exposure pathways.

**Drought indicators:** precipitation anomalies; rolling rainfall totals; SPI (precipitation-only standardization over a defined time scale); SPEI (standardization using precipitation and potential evapotranspiration); modeled soil moisture; vegetation anomalies; and reference evapotranspiration. CHIRPS is a quasi-global gridded precipitation product at 0.05° covering 50°S–50°N, with data from 1981 to near-present according to the metadata; it combines satellite information, climatology, and station data and is useful for seasonal rainfall/drought analysis [7]. NASA's GPM IMERG provides precipitation estimates at about 0.1° and half-hourly products, with different latency and quality trade-offs by run [8].

These are **inputs or derived meteorological/agricultural indicators**, not a universal drought-risk score. SPI/SPEI require a baseline, accumulation window, distribution-fitting/standardization method, and quality review; the WMO provides official guidance on drought indicators and indices [13]. Some of the input datasets do not cover every location or variable equally well.

**Water scarcity versus water-supply disruption:** regional hydrological water stress is a longer-term context. A utility outage is the failure or restriction of a specific supply network. They are not the same. WRI Aqueduct 4.0 provides global water-risk indicators, including indicators relevant to water stress, with baseline and future exports through the Water Risk Atlas; its spatial unit and scenario assumptions must be read from the current data dictionary [9]. It cannot prove that a named shop's tap will stop flowing tomorrow.

### 6.6 Utility reliability

Electricity, water, telecommunications, fuel, and transport are often critical dependencies, but globally consistent and freely accessible site-level outage feeds are not established in the supplied brief. A prototype must not invent them.

Possible inputs, in descending order of strength:

1. **Direct records:** consented bills/outage notifications, meter records, utility status feeds, or owner-reported event logs. These are site-specific but require consent, integration, and quality checks.
2. **Public regional statistics:** country/state/utility service reliability reports or administrative indicators. Coverage and publication cadence vary.
3. **Business survey proxies:** World Bank Enterprise Surveys and similar firm surveys may include outage experiences in sampled firms/countries and periods, but a survey result is not a live local outage measure and may not represent a particular business [15].
4. **Explicit user-reported assessment:** “How many power interruptions occurred in the last 30 days?” or “Can this business operate without mains water?” Include the respondent, period, and confidence.
5. **Scenario assumptions:** assume a specified outage length for a tabletop scenario, labeled synthetic.

Each substitution increases uncertainty. Display “owner-reported,” “regional proxy,” or “scenario assumption” as part of the variable label. Do not silently blend these alternatives into an apparently precise numeric measurement.

### 6.7 Supply-chain exposure

A business may be disrupted even if its premises are safe. A critical supplier can be flooded; a road, port, bridge, or rail corridor can close; a drought can constrain raw materials; heat can affect workers or cold-chain systems; or an electricity interruption can disrupt a supplier upstream.

**Useful variables:** supplier coordinates or region; dependency criticality; proportion of spend/volume from each supplier; number of substitutes; estimated switching time; alternative route availability; lead-time variability; key input dependency (water/electricity/agricultural commodity); and whether suppliers are concentrated in one exposed region.

**MVP approach:** use a manually entered list of three suppliers for a fictional business, mark one as critical, and show whether supplier sites overlap the same coarse hazard area. Alternatively ask a few owner-reported questions and calculate a concentration indicator such as the share of a critical input supplied by the largest supplier. Clearly label supplier locations as user-provided and do not infer confidential supplier relationships from public data.

**Risks:** network data are private, addresses may be inaccurate, logistics routes change, and simple geographic distance does not equal a real transport route. A regional climate overlay is a screening signal, not a prediction that a delivery will fail.

### 6.8 Financial indicators

| Indicator | What it adds | Collection and quality caveat |
|---|---|---|
| Revenue and variability | Whether sales fluctuate seasonally or are vulnerable to closure/demand shocks. | Use owner-provided monthly ranges or synthetic values; specify currency and period. |
| Operating expenses | Estimates unavoidable burn rate (rent, payroll, utilities, debt service, essential inputs). | Separate fixed and variable costs; don't treat one month as normal if seasonal. |
| Cash reserves / liquidity | Approximate survival time during a revenue interruption. | An approximate range may be less invasive than an exact bank balance. Define availability and restrictions on funds. |
| Working capital | Ability to pay suppliers and meet short-term obligations. | Accounting definitions differ; data may be unavailable for informal businesses. |
| Debt obligations / repayment schedule | Timing of cash outflows and near-term payment pressure. | Sensitive; collect only with consent and restrict access. |
| Repayment history | Direct evidence of past payment behavior when lawfully available. | Requires lender access and reliable labels; not included by assumption. |
| Sector and business model | Provides context for climate sensitivity and seasonality. | Sector averages can stereotype individual businesses; let owners correct classifications. |
| Insurance and exclusions | May reduce some losses or support recovery. | Coverage limits, exclusions, deductibles, waiting periods, and claim eligibility matter. Having a policy is not proof of full protection. |
| Business-interruption tolerance | Owner's estimate of how long operations can stop before obligations become difficult. | Subjective but useful for preparedness; record as owner-reported and test sensitivity. |

Financial information is personal or commercially sensitive even when it is not a bank password or individual-level data. Ask for informed consent, collect the minimum necessary, explain purpose and retention, protect data in transit/at rest, restrict access, and provide deletion/correction paths where appropriate. Do not request direct banking credentials. Do not assume the team can query account aggregators, banks, lenders, insurers, or proprietary credit bureaus. For a hackathon, fictional values are usually sufficient to demonstrate the logic.

## Section 7: Research Findings on the Three Supplied Resources

### 7.1 Verified supplied reference: World Bank Global Flood Exposure

**Official title:** *Global Flood Exposure: Gridded exposure headcounts by country*. The World Bank Data Catalog says the global raster tiles have 3-arcsecond resolution and that each pixel indicates the number of people exposed to different inundation depths during a modeled 1-in-100-year flood event. The catalog records global coverage, marks the dataset public, links a Read Me and a 2022 technical paper, and states a Creative Commons Attribution 4.0 licence. The metadata page was last updated in August 2023; the resource entry shows an August 2022 dataset last-updated date [1].

**What “gridded exposure headcounts by country” means:** the gridded value represents an estimated count of people associated with a grid cell and a modeled flood-depth category; country/subnational aggregation provides totals for geographic units. It is a population exposure measure. The fact that it is published by country does not make it a business asset-level layer.

**Methodological meaning:** Rentschler, Salhab, and Jafino's peer-reviewed study estimates population exposure by harmonizing flood-hazard and population-density grids, classifying exposure by inundation depth, and aggregating exposed headcounts to administrative units. The paper discusses “significant” flood exposure in relation to inundation depth above 0.15 m and studies exposure for a 1-in-100-year event [2]. For exact raster bands and any processing choices in the supplied downloadable files, use the resource's Read Me and technical documentation; do not derive category cutoffs from a map legend alone.

**Spatial/temporal interpretation:** 3 arcseconds is an angular grid interval, roughly on the order of 90 m at the equator, not a uniform exact 90 m cell everywhere. It is a modeled hazard/exposure scenario, not an hourly or daily observation series and not a short-term flood forecast. The inspected catalog page does not document a recurrent update cadence for the downloadable resource; treat the dataset version/date as fixed until verified otherwise.

**Limitations for FIN-05:**

- It counts people, not businesses, buildings, equipment, inventory, revenues, or collateral.
- It does not directly provide the flood probability, flood depth, or damage estimate for a specific business address.
- A cell can contain many buildings and land uses; positional accuracy and footprint information remain separate.
- A modeled 1-in-100-year scenario is not a claim that a flood will occur in the next 100 years on a regular schedule.
- Population exposure does not directly estimate financial loss, expected annual damage, credit default probability, or an MSME's interruption duration.

**Suitability verdict:** use it for **indirect regional context**, population vulnerability context, or a background layer explaining why flood risk matters in the area. Do **not** use it as the direct business-level flood score. For asset-level exposure, source a suitable flood-hazard depth/extent layer for the target geography and overlay it with verified business coordinates or footprints. If none is available, report flood hazard as “not available at business level” and keep the score incomplete rather than manufacturing precision.

**Access:** open the catalog entry and download the Read Me and raster tiles; the page links the associated paper. Credit the World Bank and preserve the CC BY 4.0 attribution and modification notice. Check file size and format before downloading all tiles; for a hackathon, a target-country or regional extract is sufficient if redistribution and extraction rules permit [1].

### 7.2 The other two organizer-provided references are not identifiable from the supplied text

The available paste instructs the researcher to investigate “all three institution-provided references,” but only the World Bank flood dataset is named in the readable portion. The other two URLs or exact titles are absent. Their status is therefore **not verified**, not “nonexistent.” This report does not assign those identities by inference. The most relevant alternatives for a public-data prototype are summarized below; compare them with the original challenge brief before calling any of them organizer-provided.

### 7.3 Recommended sources and their roles

- **Open-Meteo Forecast and Historical Weather APIs:** convenient coordinate-level API access to documented forecast and weather-reanalysis variables; useful for short-range alerts and historical baselines [3–5].
- **Copernicus Sentinel-2 / Sentinel-1 via Copernicus Data Space:** optical context and vegetation/land-cover features, plus radar observations useful for flood mapping under cloud cover [6]. Requires raster handling and a clear processing method.
- **CHIRPS precipitation:** long-term gridded rainfall time series, useful for rainfall anomalies and seasonal drought indicators within its geographic coverage [7].
- **NASA GPM IMERG:** higher-frequency precipitation estimates, useful for rainfall monitoring but with latency and product-run trade-offs [8].
- **World Bank Climate Change Knowledge Portal (CCKP):** country and subnational historical/projection indicators using documented collections including CMIP6 and historical datasets. Projection products are for long-term climate context, not weekly weather alerts [10].
- **WRI Aqueduct Water Risk Atlas:** water-related risk indicators and baseline/future exports; use as basin/region water-stress context rather than a local utility outage feed [9].
- **Global Flood Database:** historical observed flood event mapping for 2000–2018, useful as an event-history complement but not as a current forecast or universal return-period map [12].

No source above eliminates the need to check geographic coverage, resolution, current access conditions, terms, and suitability for the precise use case.

## Section 8: Verified Dataset Inventory

The original brief asks for a 17-field inventory. A single table with 17 very wide columns would be unreadable in a normal research document. To preserve the requested information without shrinking text to an unusable size, each dataset is recorded below using the same 17 fields in a compact per-dataset metadata table. “Not verified” means the inspected authoritative page did not settle the point.

### Dataset A — Global Flood Exposure: Gridded exposure headcounts by country

| Requested field | Verified finding |
|---|---|
| Dataset/service name | Global Flood Exposure: Gridded exposure headcounts by country [1]. |
| Provider | World Bank. |
| Official URL | https://datacatalog.worldbank.org/search/dataset/0062763/global-flood-exposure-gridded-exposure-headcounts-by-country |
| Purpose | Gridded population exposure by flood inundation depth under a modeled 1-in-100-year event. |
| Variables | Number of people exposed in a pixel for different inundation-depth categories; exact downloadable-band labels should be confirmed in the Read Me. |
| Geography | Global. |
| Spatial resolution | 3 arcseconds; roughly 90 m order-of-magnitude at equator; angular grids vary in ground size by latitude. |
| Temporal resolution | Scenario-based map, not hourly/daily time series. |
| Historical coverage | Hazard scenario and underlying population vintage should be checked in Read Me/paper; dataset entry last updated 24 Aug 2022. |
| Forecast horizon | None; it is not a forecast API. |
| Access method | World Bank Data Catalog download links; raster tiles and Read Me PDF. |
| Authentication | Not documented as required on the catalog page; downloads appear public. |
| License/restrictions | CC BY 4.0 stated by catalog [1]. |
| Update frequency | Not documented in the inspected catalog entry. |
| Intended role | Regional context only; not direct business-level scoring. |
| Limitations | People exposed, not business assets or financial losses; modeled event, not forecast. |
| Feasibility | Moderate: raster extraction and GIS overlay require geospatial processing; a small regional extract should be enough. |
| Verification status | Partially verified: official metadata page inspected; precise raster bands and download details require Read Me review. |

### Dataset B — Open-Meteo Weather Forecast API

| Requested field | Verified finding |
|---|---|
| Dataset/service name | Weather Forecast API [3]. |
| Provider | Open-Meteo, aggregating documented numerical weather models. |
| Official URL | https://open-meteo.com/en/docs |
| Purpose | Short-range forecast at requested coordinates. |
| Variables | Documented variables include temperature, apparent temperature, precipitation/probability, humidity, wind/gusts, and other fields depending on selected product/model [3]. |
| Geography | Global and regional model coverage varies by model. |
| Spatial resolution | Model-dependent; documentation lists high-resolution regional models and global models; “best match” is not a guarantee of street-level accuracy. |
| Temporal resolution | Hourly and daily summaries for supported fields. |
| Historical coverage | Forecast API's historical/archive options are separate products; do not treat standard forecast response as complete history. |
| Forecast horizon | Default 7 days; up to 16 days documented [3]. |
| Access method | HTTP API. |
| Authentication | Free non-commercial use may not require a key; commercial tier uses customer endpoint/key, verify current plan [5]. |
| License/restrictions | Free API restricted to non-commercial usage and stated rate limits; data attribution CC BY 4.0; commercial use requires applicable subscription [5]. |
| Update frequency | Model/service update schedules vary; check current model-update documentation and record retrieval timestamp. |
| Intended role | Short-term hazard alerts and preparedness signals. |
| Limitations | Forecast uncertainty; not local building conditions or long-term climate projection; field availability varies by model. |
| Feasibility | Easy to moderate: simple API request plus caching, error handling, timestamps, and attribution. |
| Verification status | Verified against official API and terms pages as inspected 9 Oct 2026. |

### Dataset C — Open-Meteo Historical Weather API

| Requested field | Verified finding |
|---|---|
| Dataset/service name | Historical Weather API [4]. |
| Provider | Open-Meteo using reanalysis/model datasets such as ERA5, ERA5-Land, and ECMWF IFS. |
| Official URL | https://open-meteo.com/en/docs/historical-weather-api |
| Purpose | Historical weather reconstruction for a location and time range. |
| Variables | Temperature, precipitation, humidity, wind, evapotranspiration, vapour-pressure deficit, and other fields depending on product/model [4]. |
| Geography | Global for ERA5/ERA5-Land/IFS; special regional products may differ. |
| Spatial resolution | ERA5 0.25° (~25 km); ERA5-Land 0.1° (~11 km); IFS about 9 km in current documentation [4]. |
| Temporal resolution | Hourly and daily aggregated fields where available. |
| Historical coverage | ERA5 from 1940; ERA5-Land from 1950; IFS from 2017 in inspected documentation [4]. |
| Forecast horizon | Not applicable; historical/reanalysis data. |
| Access method | HTTP API. |
| Authentication | Commercial usage uses customer endpoint/key; see current terms/pricing [5]. |
| License/restrictions | Free API non-commercial only; attribution required; commercial use requires subscription [5]. |
| Update frequency | Documentation describes daily updates for ERA5/ERA5-Land with delays; IFS update schedule differs [4]. |
| Intended role | Historical baseline, event-duration features, anomaly calculation, sector-sensitive heat indicators. |
| Limitations | Reanalysis is model-based, not a station observation; coarse grid may miss microclimates; changes in model can break long trends if inconsistent models are mixed. |
| Feasibility | Easy to moderate: API is straightforward; feature definition and baseline quality require care. |
| Verification status | Verified against official API page as inspected 9 Oct 2026. |

### Dataset D — Copernicus Sentinel-2 imagery (optional satellite source)

| Requested field | Verified finding |
|---|---|
| Dataset/service name | Sentinel-2 MSI imagery products, including Level-1C and Level-2A [6]. |
| Provider | European Union Copernicus Programme / ESA; access through Copernicus Data Space Ecosystem. |
| Official URL | https://documentation.dataspace.copernicus.eu/Data/SentinelMissions/Sentinel2.html |
| Purpose | Optical multispectral observations of land surface and vegetation. |
| Variables | Spectral bands (blue, green, red, near infrared, red-edge, SWIR, etc., depending on product); indices like NDVI are derived by user processing. |
| Geography | Global. |
| Spatial resolution | 10 m, 20 m, or 60 m depending on band/product [6]. |
| Temporal resolution | Constellation revisit is nominally several days; actual valid observation intervals vary with latitude, clouds, orbit, and acquisition availability. |
| Historical coverage | Level-1C products globally from 2015 onwards in the inspected documentation [6]. |
| Forecast horizon | None. |
| Access method | Copernicus Data Space browser and APIs; use the specific API and collection documentation. |
| Authentication | Programmatic services may require account/OAuth setup; verify for the chosen access route. |
| License/restrictions | Copernicus data are generally provided under open and free data policy; verify current collection and platform terms before redistribution. |
| Update frequency | New acquisitions depend on satellite acquisition schedule and product processing. |
| Intended role | Optional site/land context; vegetation or change detection only where meaningful. |
| Limitations | Clouds/haze, temporal gaps, processing burden, interpretation errors; optical imagery does not show underground utilities or financial sensitivity. |
| Feasibility | Moderate/difficult for automated analysis; moderate for a single-site visualization. |
| Verification status | Partially verified from official Sentinel documentation; exact API collection, auth, and terms should be reconfirmed before implementation. |

### Dataset E — CHIRPS rainfall time series (recommended drought input)

| Requested field | Verified finding |
|---|---|
| Dataset/service name | Climate Hazards Group InfraRed Precipitation with Station data (CHIRPS) Version 2.0 [7]. |
| Provider | Climate Hazards Center, University of California Santa Barbara; cataloged in data.gov/NOAA metadata. |
| Official URL | https://www.chc.ucsb.edu/data/chirps ; metadata: https://catalog.data.gov/dataset/chirps-version-2-0-precipitation-global-0-05-annual-1981-present |
| Purpose | Gridded precipitation time series for rainfall monitoring, trend analysis, and seasonal drought analysis. |
| Variables | Rainfall/precipitation accumulations, depending on temporal product (daily/pentad/monthly/annual product). |
| Geography | 50°S to 50°N, all longitudes—quasi-global, not full polar coverage [7]. |
| Spatial resolution | 0.05° (about 5 km near equator, with longitude cell dimensions varying by latitude). |
| Temporal resolution | Multiple time aggregations exist; choose the exact product and verify. |
| Historical coverage | 1981 to near-present in official metadata [7]. |
| Forecast horizon | None. |
| Access method | Data downloads and documented data services; no assumption of a simple one-call business API. |
| Authentication | Not documented as mandatory for public dataset downloads in inspected metadata. |
| License/restrictions | Data.gov metadata lists CC0 for the referenced dataset record; verify upstream data product terms and citation requirements before redistribution [7]. |
| Update frequency | Near-present products update according to release process; exact latency varies by temporal product. |
| Intended role | Historical rainfall anomaly and seasonal drought context. |
| Limitations | Precipitation only; not water supply availability, irrigation access, soil moisture, or business interruption. Coverage excludes latitudes poleward of 50°. |
| Feasibility | Moderate: file or cloud data extraction and rolling aggregation required. |
| Verification status | Partially verified from official/catalog metadata; exact product cadence and download workflow require checking for the selected format. |

### Dataset F — ERA5-Land (recommended direct Copernicus alternative)

| Requested field | Verified finding |
|---|---|
| Dataset/service name | ERA5-Land hourly data from 1950 to present [11]. |
| Provider | Copernicus Climate Change Service / ECMWF through the Copernicus Climate Data Store. |
| Official URL | https://cds.climate.copernicus.eu/datasets/reanalysis-era5-land |
| Purpose | Global historical land-surface reanalysis. |
| Variables | Multiple land, soil, temperature, moisture, radiation, and hydrology variables; exact subset depends on product. |
| Geography | Global land domain. |
| Spatial resolution | 0.1° x 0.1°; native resolution about 9 km [11]. |
| Temporal resolution | Hourly [11]. |
| Historical coverage | January 1950 to present, subject to latest data latency [11]. |
| Forecast horizon | None; historical reanalysis. |
| Access method | Climate Data Store download/API; analysis-ready Zarr offerings exist for selected data, depending on collection. |
| Authentication | CDS account/API key for programmatic retrieval, as applicable to the chosen service. |
| License/restrictions | CC BY licence stated on the dataset page; follow citation and attribution conditions [11]. |
| Update frequency | Daily as listed by the inspected catalogue [11]. |
| Intended role | Historical heat/soil-moisture context and consistent long-term baselines. |
| Limitations | Gridded model output, not in-situ measurements; some variables and grid-scale biases require scientific interpretation. |
| Feasibility | Moderate: API credentials, subset requests, formats, and data processing add setup time. |
| Verification status | Verified against Copernicus Climate Data Store metadata inspected 9 Oct 2026. |

### Dataset G — WRI Aqueduct Water Risk Atlas (recommended water context)

| Requested field | Verified finding |
|---|---|
| Dataset/service name | Aqueduct Water Risk Atlas (current public documentation refers to Aqueduct 4.0) [9]. |
| Provider | World Resources Institute (WRI). |
| Official URL | https://www.wri.org/aqueduct ; export guide: https://www.wri.org/aqueduct/help-center/how-use-analysis-features-water-risk-atlas |
| Purpose | Spatial indicators of water-related risk; helps compare locations and water dependencies. |
| Variables | Baseline and future indicators; exact names/units are defined in the current data dictionary. |
| Geography | Global; spatial units and coverage differ by indicator. |
| Spatial resolution | Indicator-specific hydrological or administrative units; inspect Aqueduct 4.0 data dictionary rather than assuming property-level precision. |
| Temporal resolution | Current documentation supports baseline, annual, monthly (for some indicators), and future scenario exports [9]. |
| Historical coverage | Indicator-specific; the export documentation must be consulted for chosen field. |
| Forecast horizon | Long-term scenario outputs for documented future timeframes, not short-term outage forecasts. |
| Access method | Water Risk Atlas and CSV/GPKG exports [9]. |
| Authentication | Not established as required for viewing/download from the inspected public pages; verify current platform behavior. |
| License/restrictions | WRI's older Aqueduct datasets carry CC BY 4.0; confirm current Aqueduct 4.0 terms and attribution before use [9]. |
| Update frequency | Not verified in the inspected help page; current version/data dictionary should be checked. |
| Intended role | Regional/basin water stress context. |
| Limitations | Does not establish real-time municipal supply, site-specific well yield, or outage occurrence. Future indicators depend on model/scenario assumptions. |
| Feasibility | Moderate: export and spatial join are feasible for a region but more complex than a weather API. |
| Verification status | Partially verified; current version-specific metadata and licence need review before redistribution. |

### Dataset H — NASA GPM IMERG (optional high-frequency precipitation)

| Requested field | Verified finding |
|---|---|
| Dataset/service name | Global Precipitation Measurement (GPM) Integrated Multi-satellitE Retrievals for GPM (IMERG), Version 07 family [8]. |
| Provider | NASA. |
| Official URL | https://gpm.nasa.gov/data/imerg |
| Purpose | Satellite/multisensor precipitation estimates for monitoring and research. |
| Variables | Precipitation rate/accumulation, depending on selected run/product. |
| Geography | Near-global to global, with coverage limitations at the extreme poles varying by product. |
| Spatial resolution | About 0.1° (around 10 km) [8]. |
| Temporal resolution | Half-hourly and daily/monthly products depending on version/run [8]. |
| Historical coverage | Product coverage varies by run; NASA's directory lists IMERG data back to January 1998 [8]. |
| Forecast horizon | None: it is an observation/estimation product, not a future forecast. |
| Access method | NASA GES DISC/PPS data services, downloads, and visualization/subsetting tools. |
| Authentication | Some programmatic download paths require Earthdata/registered access; verify the selected access route. |
| License/restrictions | Check the specific NASA data-product terms and citation rules; don't assume every service path has the same access conditions. |
| Update frequency | Run-dependent latency: early products lower latency; final research-quality products have longer latency [8]. |
| Intended role | Recent rainfall accumulation and heavy-rain monitoring, as a supplement to forecasts. |
| Limitations | Precipitation is indirect flood evidence; grid is coarse relative to a building; retrieval uncertainty and latency matter. |
| Feasibility | Moderate: raster retrieval and temporal aggregation needed. |
| Verification status | Verified against NASA GPM documentation, but product/run choice not yet fixed. |

### Dataset I — World Bank Climate Change Knowledge Portal (recommended long-term projections)

| Requested field | Verified finding |
|---|---|
| Dataset/service name | Climate Change Knowledge Portal (CCKP) historical and future climate data [10]. |
| Provider | World Bank. |
| Official URL | https://climateknowledgeportal.worldbank.org/ ; download/API guide: https://climateknowledgeportal.worldbank.org/index.php/download-data |
| Purpose | Historical climate context and modeled future climate projections. |
| Variables | Depends on collection: the documented API examples include temperature variables and other cataloged climate indicators. |
| Geography | Country, subnational, and other geographies supported by catalog collections. |
| Spatial resolution | Collection-dependent; examples include CMIP6 0.25° and other dataset grids [10]. |
| Temporal resolution | Annual or other temporal summaries depending on collection. |
| Historical coverage | Dataset-dependent; API catalog identifies collections including historical observations and reanalysis. |
| Forecast horizon | Long-term climate projections, scenario-specific—not short-range weather forecasts. |
| Access method | Download and documented CCKP API. |
| Authentication | Not established from the inspected download guide; verify any current service requirements. |
| License/restrictions | Not verified across all collections; check the metadata and terms for the selected dataset. |
| Update frequency | Collection-specific; not verified generically. |
| Intended role | Optional long-term regional climate context and scenario analysis. |
| Limitations | Coarse grids, model spread, baseline/scenario dependence, and possible mismatch with local assets and loan time horizons. |
| Feasibility | Moderate: API retrieval is possible but careful product/collection selection is required. |
| Verification status | Partially verified from official download/API guide; selected collection remains to be chosen. |

### Dataset J — Global Flood Database (historical event complement)

| Requested field | Verified finding |
|---|---|
| Dataset/service name | Global Flood Database, associated with Tellman et al. (2021) [12]. |
| Provider | Research dataset built from Dartmouth Flood Observatory event records and MODIS satellite data; hosted in public scientific-data environments. |
| Official URL | Paper/description: https://www.nature.com/articles/s41597-021-00819-1 (verify dataset landing/access at implementation time). |
| Purpose | Historical mapping of selected observed flood events. |
| Variables | Event inundation extent, event timing/duration and related event metadata, depending on file. |
| Geography | Global events documented for the 2000–2018 period, not necessarily complete coverage of every flood. |
| Spatial resolution | Approximately 250 m [12]. |
| Temporal resolution | Event-based. |
| Historical coverage | 2000–2018 in the cited dataset documentation [12]. |
| Forecast horizon | None. |
| Access method | Scientific data archive/associated product files; exact current download route not fully verified here. |
| Authentication | Not verified. |
| License/restrictions | Not verified for the exact distribution endpoint; confirm before redistribution. |
| Update frequency | Historical dataset; update cadence not verified. |
| Intended role | Historical event context, not a future flood-probability layer. |
| Limitations | Event inventory is not a complete loss catalogue; satellites can miss events; coarse resolution relative to buildings. |
| Feasibility | Moderate/difficult depending on download format, access status, and GIS workflow. |
| Verification status | Partially verified through secondary official/research descriptions; access and terms must be checked before selecting it. |

### How to sample before building a data pipeline

1. Pick one country and one demonstration city/district; do not begin with a global raster download.
2. Use one fictional business coordinate and two additional test points: one obviously outside the target region and one with missing/ambiguous location data.
3. Fetch a 7-day forecast for only the variables needed for one alert. Save the raw request/response, units, timestamp, and attribution.
4. Retrieve a 1–3 year rainfall/temperature subset for the same point for an initial baseline; use a consistent source and document missing values.
5. Download one small flood-exposure/hazard subset if permitted and view it in QGIS or another GIS tool. Verify coordinate reference system, grid cell size, nodata values, and legend.
6. Compare source timestamps, units, and spatial scales manually before coding a composite score.
7. Record every transformation in a small data dictionary. If the sample does not answer a defined business question, stop and change the feature before scaling.

## Section 9: Data-to-Score Pipeline

### Candidate pipeline diagram

```text
Business profile + consent
          ↓
Validate location and site type
          ↓
Fetch selected climate/hazard data
          ↓
Validate provenance, timestamps, units, CRS and missingness
          ↓
Align space and time (with resolution-aware rules)
          ↓
Feature engineering (heat, rainfall anomaly, flood overlap, supplier dependence)
          ↓
Hazard indicators ──┐
Business exposure ──┼→ Vulnerability / coping-capacity assessment
Financial sensitivity┘
          ↓
Transparent rule-based sub-scores + data-quality/confidence flags
          ↓
Explain drivers, uncertainty and actionable recommendations
          ↓
Human review / business-owner action / scheduled reassessment
```

This is a **candidate** processing sequence, not a fixed architecture or claim that all inputs will be available.

| Step | Inputs → output | Why it exists | Failure conditions and controls |
|---|---|---|---|
| 1. Business profile and consent | Site, sector, operating hours, optional financial ranges → normalized profile. | Defines the asset and context being evaluated. | Missing consent, ambiguous ownership, or overcollection: stop or run with synthetic values. |
| 2. Geolocation | Address/coordinates → coordinates with source and uncertainty. | Enables spatial lookups. | Poor geocode, wrong pin, multiple sites: request correction and label accuracy. |
| 3. Data retrieval | Coordinates/time → raw forecast, history, flood/land/water layers. | Gets environmental evidence. | API limits, unavailable region, authentication, provider outage: mark unavailable, retry safely, never silently substitute another source. |
| 4. Quality and provenance checks | Raw data → validated records. | Prevents invalid units, stale values, and missingness from appearing trustworthy. | Unknown CRS, unit mismatch, stale timestamps, unexpected nulls: quarantine the field or show low confidence. |
| 5. Space/time alignment | Data at different grids/periods → compatible records. | Allows fair comparison at a defined scale. | Resampling can introduce false precision; use conservative spatial joins and retain original resolution. |
| 6. Feature engineering | Raw time series/maps → indicators such as consecutive hot days or 7-day rainfall anomaly. | Translates measurements into meaningful operating signals. | Arbitrary thresholds, inadequate baseline, data leakage: document and test each calculation. |
| 7. Exposure/vulnerability | Hazard indicators + asset/site dependencies → impact pathways. | Identifies how hazard could reach the business and how sensitive it is. | Population counts substituted for asset overlap; generic sector assumptions: separate data fields and disclose proxies. |
| 8. Financial sensitivity | Minimal consented or synthetic financial profile → liquidity/revenue pressure flag. | Contextualizes a physical disruption in operational terms. | Unverified finances or false precision: use ranges and scenarios rather than exact forecasts. |
| 9. Score calculation | Normalized indicators, disclosed weights → sub-scores and optional composite index. | Creates a consistent review aid. | Missing inputs, weight instability, duplicate correlated indicators: show unavailable components and sensitivity ranges. |
| 10. Explanation/action | Source records + drivers → report and actions. | Makes the result usable and contestable. | Generic recommendations or unsupported certainty: link each action to a specific driver and uncertainty. |
| 11. Monitoring | New forecast/data or owner update → changed report. | Keeps the assessment relevant. | No actual refresh, stale cache, or broken feed: display “last checked” and degrade visibly. |

### Compatibility issues to manage

- **Spatial resolution:** flood grids may be around 90 m, Sentinel-2 bands 10–60 m, CHIRPS 0.05 degrees, and weather reanalysis around 9–25 km. Resampling all layers to 10 m does not create 10 m knowledge. Keep native resolution and choose an appropriate intersection strategy.
- **Coordinate systems:** geospatial rasters may use geographic WGS84 or projected UTM/WGS84. Reproject deliberately; always verify coordinate axis order, cell alignment, and nodata encoding.
- **Temporal mismatch:** a 2022 exposure raster, a daily forecast, and an annual climate projection do not represent one common timestamp. Show the date/reference period for each.
- **Units:** temperature may be Celsius/Kelvin; precipitation may be mm per interval or a rate; coordinates degrees; soil moisture may be volumetric fraction. Convert once, test the conversion, and store canonical units.
- **Baseline mismatch:** rainfall anomalies require a historical distribution for the same season and a defined baseline. Mixing model datasets can cause artifacts.
- **Administrative boundaries:** region names, codes, and boundaries may change. Use standard identifiers and versions, not names alone.
- **Data missingness:** “not available” is not “zero risk.” The output must distinguish low hazard from no data.
- **Licensing:** maintain source attribution, license identifiers, and whether a source permits redistribution/commercial use. API terms can differ from underlying data licences.
- **Update frequency:** cache forecasts and monitor scheduled products according to provider rules. A periodic pull is not continuous live monitoring.

**Essential inputs for MVP:** verified location; one forecast product; a historical weather/rainfall baseline; a small, relevant business questionnaire; clear source timestamps and data-quality flags. **Enhancements:** satellite visualization, a suitable asset-level flood-hazard layer, water-stress context, suppliers, and regional outage proxies. **Defer:** global imagery pipelines, detailed transport network routing, supplier-network inference, and machine learning until data feasibility is proven.

## Section 10: Scoring Approaches

### Approach A — Rule-based weighted scoring

The system turns each input into a transparent normalized indicator, applies documented weights, and calculates a composite or category. An illustrative formula is:

`Indicator score = 100 × normalized indicator value`  
`Composite indicator = Σ(weight_i × indicator_score_i)`

Weights should sum to 1 (or 100%) for a weighted average. “Normalized” means transformed to a known range; it should not conceal how a value was transformed. Some indicators are categorical rather than continuous, and missing values should not automatically receive zero.

**Strengths:** interpretable, feasible without labels, straightforward to test, explainable to an owner, and suitable for a prototype.  
**Weaknesses:** weights and thresholds are design choices, may embed bias, can double-count correlated indicators, and do not establish empirical prediction.  
**Requirements:** documented thresholds, units, baseline, weights, missing-data rules, case tests, sensitivity analysis, and review by climate/risk domain experts.

**Weight selection process:** begin with a conceptual causal model and literature/domain review; distinguish hazard from exposure and resilience; assign initial weights as explicit hypotheses; convene a review including business-owner/lender perspectives; test scenarios and counterexamples; vary each weight across plausible ranges; observe whether rankings and recommendations change; publish the rationale and version. Do not present hackathon weights as scientifically established. If a minor weight change radically reverses results, report the score as unstable.

### Approach B — Statistical or machine-learning risk modelling

A supervised model learns a relationship between features and a defined outcome. Possible labels might include verified interruption days, insured loss amount, revenue drop, arrears, or default—but these are different targets and should not be conflated.

**Strengths:** can learn complex relationships if data are representative and labels are reliable; performance can be quantified on held-out examples.  
**Weaknesses:** usually needs substantial historical, consistently measured outcomes; risks geographic/sector bias, leakage, drift, opaque decisions, and poor calibration; a model trained on one country or lending portfolio may not generalize.  
**Requirements:** consented/lawful records, explicit target definition and time horizon, sufficient sample sizes, feature provenance, train/validation/test separation by time and possibly geography, calibration, group/fairness checks, baselines, external validation, monitoring, and governance.

If the target is default, it requires actual default/repayment labels with the appropriate observation window and outcome definitions. Environmental data alone cannot train a model to predict default. Synthetic records can test code paths but cannot validate a predictive model.

### Approach C — Hybrid

A hybrid may use documented physical-risk indicators plus borrower-specific vulnerability and, only if validated models become available, a predictive component. It can also use rule-based screening to decide which cases require more detailed analysis.

**Strengths:** preserves known physical-hazard information and can add validated prediction later.  
**Weaknesses:** more complex to govern; a poorly validated model does not become sound because a rules layer surrounds it.  
**Requirements:** all rule-based requirements plus model validation and clear separation between empirical predictions and expert-designed assumptions.

### Recommendation for an international hackathon

Use **Approach A** for the MVP, with a hybrid-ready data model. Given no established access to labeled losses or loan defaults, machine learning is not justified as the central scoring method. It is reasonable to use AI for summarizing source evidence or generating contextual recommendations only if outputs are grounded in validated fields, checked for unsupported claims, and clearly separated from the numeric scoring logic.

Keep at least three outputs distinct:

1. **Hazard/context indicators** — what public environmental sources say.
2. **Business vulnerability/resilience assessment** — what is known or reported about operations and coping capacity.
3. **Financial sensitivity scenario** — what a defined disruption could mean for a supplied cash-flow profile.

An optional composite “climate-related business disruption indicator” can summarize them, but it should never silently turn into a default probability or a credit decision.

## Section 11: Example Output

### Fictional case: “Riverside Foods”

All details and values in this example are **synthetic and illustrative**. Scores are not calibrated to losses or defaults.

| Field | Example value | Source/status |
|---|---|---|
| Business | Riverside Foods, small food retailer | Synthetic profile |
| Location | Fictional pin in a low-lying district | Synthetic; no real address |
| Sector | Food retail / cold storage | Owner profile, synthetic |
| Forecast | Unusually heavy rainfall in next 72 hours | Illustrative only; real implementation must show provider issue time/forecast valid time |
| Historical baseline | 7-day rainfall compared with same-season distribution | Derived variable; baseline period must be specified in a real system |
| Flood context | Population-exposure grid suggests the region has modeled flood-exposed residents | Indirect contextual signal only; not shop-level hazard proof |
| Electricity dependence | Refrigeration required; backup power unavailable | Synthetic owner report |
| Supplier dependence | One primary supplier provides 70% of a critical ingredient | Synthetic owner report |
| Cash runway | Approximately 8 days of fixed operating costs | Synthetic financial input |
| Insurance | Unknown | Missing; not scored as no coverage |

### Sample report card

**Overall indicator:** Elevated near-term disruption concern *(illustrative label, not statistically validated)*.

**Drivers shown:** (1) forecast rainfall signal; (2) area-level flood context with a note that it is population exposure, not premises-level hazard; (3) no backup electricity for cold storage; (4) supplier concentration; (5) short reported cash runway. The system should separately show that the weather forecast is short-term, the flood grid is a scenario-based contextual dataset, and the operational/financial data are synthetic.

**Actions:** confirm official local weather/flood warnings; check drainage and move stock above floor level; test refrigeration contingencies and backup power; confirm an alternate supplier; review insurance scope/exclusions; estimate a two-day and five-day closure scenario with the owner; schedule reassessment after the forecast window or a material change.

**Data-quality statement:** “Illustrative scenario. One near-term weather source and one regional flood-context layer are assumed for the example. The regional flood data do not confirm flooding at the premises. Supplier, utility and liquidity details are synthetic. No loss or default probability is estimated.”

### Illustrative score mechanics (not validated)

Suppose a demo team sets an initial 0–100 index using four separate components: hazard signal 30%, direct asset exposure 25%, operational vulnerability 25%, and financial sensitivity 20%. Those weights are merely placeholders. In this case direct asset-level flood data are absent, so the system must not fill the missing component with a value that implies measured low risk. It should display “asset-level flood exposure unavailable” and either calculate a visibly partial result with a data-coverage warning or refrain from showing one composite score. A responsible prototype may be more impressive by showing the missing evidence honestly than by producing a deceptively complete number.

## Section 12: Lending and Early Intervention Use Cases

### Lending support

The indicator can provide additional climate context in a lender's normal underwriting or portfolio-monitoring workflow. Examples include:

- Flagging a case for additional review when the premises may be exposed to a plausible hazard and the business has few continuity options.
- Discussing how repayment would work under a temporary revenue decline or operating-cost increase.
- Considering loan uses that improve resilience, such as drainage, elevated storage, cooling efficiency, backup power, water efficiency, or supplier diversification.
- Identifying borrowers who may benefit from insurance review or technical assistance.
- Monitoring a consenting borrower's location-specific hazard signals without assuming a forecast is a realized loss.

The system should not automatically approve or reject credit. A lender needs its own validated underwriting rules, lawful data use, governance, and human review. Geographic risk is not the same as poor creditworthiness. It would be especially problematic to penalize businesses in vulnerable areas without considering adaptation, community disadvantage, available protections, and possible resilience finance.

### Early intervention

Interventions should map to a specific signal and time window:

| Signal | Actionable intervention | Caveat |
|---|---|---|
| Heavy rain forecast within a few days | Check drains, move stock, confirm contact/evacuation plan, review official warnings. | Weather prediction is uncertain; avoid claims that a flood will happen. |
| High heat forecast for several days | Check cooling, worker exposure, hydration, opening hours, cold-chain capacity. | Thresholds must account for local conditions and business type. |
| Sustained rainfall deficit / drought context | Review water consumption, alternate supply, inventory/input plans. | Regional drought does not establish a utility outage. |
| Critical supplier in an exposed area | Contact supplier, identify substitute, check inventory and lead time. | A regional overlay does not mean the supplier is actually disrupted. |
| Short cash runway under a defined interruption scenario | Owner/lender discussion of contingency cash flow and support options. | Scenario calculations are not forecasts of actual revenue or default. |
| No data or stale data | Ask owner for updated information or state that the assessment is incomplete. | Missing data must never be rendered as “safe.” |

### Refresh semantics

- **Real-time:** only use this phrase if a data feed and pipeline genuinely update in real time and the user can see source timestamps and latency.
- **Near-real-time:** may fit a specific low-latency product, such as some precipitation estimates, but only with the actual latency stated.
- **Scheduled refresh:** a periodic job checks a provider on a schedule.
- **Manual refresh:** the user requests an update.
- **Simulated demo:** values or alerts are preloaded or generated for presentation; label them as simulation.

A short-range weather forecast changing is not proof that observed risk or business impact has changed. Recalculate the forecast-driven component and explain exactly what changed; do not silently rewrite a long-term hazard layer.

---

## Section 13: Risks and Limitations

### Data and scientific limitations

- **Different kinds of evidence:** forecast, reanalysis, observed satellite event, modelled return-period hazard, population exposure, and future climate projection describe different things. Do not merge them without retaining source type and time reference.
- **Scale mismatch:** the nearest grid cell is not necessarily the exact site condition. Rural topography, urban drainage, building elevation, microclimates, and river defenses may be absent or generalized.
- **Coverage mismatch:** “global” is not synonymous with equal quality for every country, hazard, season, or business type. Some products exclude latitudes, lack local stations, or update at different rates.
- **Proxy risk:** regional water stress, population exposure, or survey averages can be useful context but can become misleading if labeled as direct measurements of a company.
- **Threshold arbitrariness:** a heat threshold, rainfall anomaly threshold, or risk band is a choice unless grounded in an accepted standard or local evidence. Explain its source and effects.
- **Missingness:** no data, unknown insurance, and unreported utility status should stay “unknown.” They must not reduce a score by being interpreted as zero.
- **Double counting:** heavy rainfall, flood context, and recent observed flood may be correlated evidence for the same physical process. Combining them with large independent weights can exaggerate risk.
- **No outcome labels:** without verified interruption/loss/default outcomes, a model cannot establish predictive accuracy, probability calibration, or financial materiality.
- **Model uncertainty:** thresholds, source choice, geolocation, and weights all affect rankings. Sensitivity testing is necessary.

### Financial and operational limitations

- Cash flow and repayment capacity depend on many non-climate variables: management, markets, competition, contracts, working capital, borrower support, loan terms, and other shocks.
- Disruption estimates are not loss estimates unless the system has a validated damage function, exposure values, and evidence about insurance/mitigation. Population headcounts are not money.
- Forecast APIs, imagery services, and external datasets can change availability, schemas, versions, quotas, or terms. Build failure states and make a provider change visible.
- A score can become stale if the business relocates, changes suppliers, buys backup power, receives insurance, or changes its financial position.
- An attractive dashboard can conceal that the underlying data are too coarse or the model unvalidated. Show evidence before polish.

### Privacy, security, fairness, and governance

- Minimize collected personal/commercial information; obtain clear consent or another lawful basis; define retention and deletion; encrypt sensitive information and restrict access.
- Do not collect bank credentials or assume private lender, insurer, utility, or supplier data are accessible.
- Avoid making geography act as a disguised proxy for borrower quality. Apply proportionate human review, challenge/appeal routes, and bias checks by region, sector, size, gender/ownership where lawful and appropriate, and data-availability group.
- Show why an output changed, what is known versus inferred, and which sources are stale or missing.
- Prevent false confidence: “confidence” should be grounded in data coverage, source quality, geolocation quality, uncertainty ranges, or calibration results—not an invented percentage.
- Keep an audit trail of inputs, source versions, transformations, score version, user corrections, and decisions.

NIST's AI Risk Management Framework groups risk work under Govern, Map, Measure, and Manage and emphasizes characteristics including validity/reliability, safety, security, accountability/transparency, explainability, privacy, and fairness [14]. It is voluntary, general guidance rather than a climate-finance-specific law. The Basel Committee's climate-risk principles are relevant context for banks because they address how climate-related drivers can flow into conventional risk categories; local regulators and laws still govern real lending use [14].

## Section 14: Recommended MVP Scope

The MVP should demonstrate one complete, honest journey: a user enters a business profile, the product retrieves limited public climate evidence, combines it with transparent owner-reported/synthetic business vulnerability, explains the major drivers, and recommends preventive action. Keep it narrow enough to inspect and validate.

### Tier 1 — Essential prototype

| Feature | User problem | Data required | Difficulty | Demo value | Dependencies / main risks |
|---|---|---|---|---|---|
| Business profile and geolocation | Assessment needs a defined site and context. | Address/coordinates, sector, site type; fictional data acceptable. | Easy | High: anchors every assessment. | Geocoding mistakes; privacy if a real address is used. |
| Environmental evidence panel | Users need to see source data, not an unexplained score. | One forecast source and one historical baseline. | Easy–moderate | High: shows live/public data integration. | API terms, quotas, stale responses, source differences. |
| Simple weather feature engineering | Raw values are hard to interpret. | Forecast precipitation/temperature; historical data for a baseline. | Moderate | High: demonstrates actual analysis. | Thresholds and baselines must be documented. |
| Vulnerability questionnaire | Public maps cannot reveal a business's dependencies. | Backup power, water dependence, inventory sensitivity, supplier alternatives, continuity duration. | Easy | High: adds business specificity. | Self-report error; keep labels visible. |
| Transparent rules-based indicator | Users want an understandable summary. | Normalized environmental features and vulnerability answers. | Moderate | High if explanations are reproducible. | Arbitrary weights; avoid default probability claims. |
| Data provenance and missing-data display | Users need to know what can be trusted. | Source, timestamps, location quality, resolution, missingness. | Moderate | Very high: demonstrates responsible engineering. | Requires discipline across all data flows. |
| Explanation and action report | Score must translate into useful response. | Driver-to-action mapping and source citations. | Easy–moderate | High: connects climate to early intervention. | Avoid generic or overly confident recommendations. |
| Synthetic demonstration case | Hackathon team lacks private financial data. | Clearly fictional business profile and financial ranges. | Easy | High: enables a complete demo safely. | Must be visibly labeled synthetic throughout. |

### Tier 2 — High-value enhancements

| Feature | Why it matters | Additional data/difficulty | Demo value / risk |
|---|---|---|---|
| Regional flood context map | Makes flood risk spatially understandable. | World Bank population-exposure layer and/or local flood hazard layer; moderate GIS work. | High value if the display explicitly distinguishes population exposure from asset-level flood hazard. |
| Heatwave/drought indicators | Expands beyond rainfall. | Daily temperature, rainfall, optionally CHIRPS or ERA5-Land; moderate feature work. | Useful for sector differentiation; indicators need baselines and appropriate thresholds. |
| Water-risk context | Helps water-dependent businesses. | Aqueduct data for chosen location; moderate spatial join. | Useful context, but not a utility outage alert. |
| Supplier concentration assessment | Captures indirect climate risk. | User-entered supplier regions and criticality. | Differentiating because it captures an off-site pathway; privacy and incomplete-network risk. |
| Scenario-based financial stress view | Connects disruption duration to liquidity. | Revenue/cost ranges and user-selected interruption scenarios. | High explanatory value if values are synthetic/user supplied and not presented as predictions. |
| Change log / reassessment | Shows whether a new forecast changed the case. | Cached versions and timestamps. | Strong operational credibility; must not imply full real-time monitoring. |

### Tier 3 — Advanced extensions

- Verified business-level flood inundation/depth for the target region, using suitable local hazard sources and footprints.
- Satellite-derived flood extent or agricultural stress after validating algorithms against reference evidence.
- Supplier-network and logistics-route modelling with consented data.
- Utility reliability integrations for regions where trustworthy granular feeds exist.
- Multi-country coverage with jurisdiction-aware MSME definitions, hazards, data-quality tiers, and privacy requirements.
- A validated loss-severity or default model after securing sufficient consented historical records and a governance process.
- Portfolio-level aggregation and stress testing for a participating lender.
- Climate-projection-based long-horizon adaptation planning, separate from short-term operational alerts.

### What is a credible hackathon scope?

For a small team, a defensible demo can use public weather data, historical rainfall/temperature, one regional flood-context layer, and synthetic business/financial profiles. It can show traceable retrieval, basic features, a clear rules engine, data-quality warnings, and actionable recommendations. It cannot credibly claim to estimate real loss, predict default, or identify precise local flood depth unless those outputs are supported by suitable hazard/asset data and validation. A **functional prototype** demonstrates data flow, UI behavior, and explainable outputs. A **production-ready financial-risk product** also needs data contracts, reliability and security controls, jurisdiction-specific compliance, model governance, user consent, formal validation, monitoring, incident handling, service support, and evidence of utility in actual decisions.

### Existing landscape and differentiation

The project should not claim to be the first climate-risk scoring system. Several capability classes already exist:

- **Climate/weather services:** coordinate-level forecasts and historical weather APIs provide the raw environmental information.
- **Public geospatial risk tools:** WRI Aqueduct supports water-risk mapping and downloadable analysis outputs [9]; World Bank CCKP offers historical and projected climate indicators [10].
- **Satellite/climate analytics in finance and agriculture:** IFC's 2024 mapping report explicitly surveys digital solutions used by financial-service providers to assess climate impacts on agricultural portfolios, including satellite/weather-linked approaches [15]. That is evidence that the broader market already exists, although it is not a full audit of every product capability.
- **Institutional risk approaches:** banks and financial supervisors are integrating climate risk into traditional risk management; Basel guidance documents this as a financial-risk governance issue [14].

The defensible differentiation for a hackathon is not simply “AI + weather + dashboard.” It could be the combination of: (1) MSME-specific operational dependencies, (2) a transparent bridge from hazard indicators to owner actions and cash-flow scenarios, (3) a provenance-first interface that distinguishes measured data, regional proxies, owner reports, and synthetic values, and (4) a human-reviewed early-intervention workflow. Those are proposed product differentiators, not a claim of novelty or proven business value. Demonstrate value by testing whether an owner or reviewer can identify the top drivers, correct inaccurate inputs, and choose a concrete preventive action faster or more consistently than with an unstructured review.

## Section 15: Major Unknowns and Research Gaps

These unresolved questions may materially change the data strategy:

1. **Missing official references:** what are the two other resource titles/URLs named in the complete organizer brief? The currently supplied text does not identify them.
2. **Target geography:** is the MVP India-only, another country, or global? This determines relevant flood maps, administrative boundaries, utility data, MSME definitions, and privacy rules.
3. **Primary user:** business owner, loan officer, portfolio risk manager, development agency, or several roles? Their consent, data access, and decision needs differ.
4. **Exact decision scope:** is the primary output early warning, resilience recommendation, underwriting context, portfolio stress analysis, or an actual credit-risk model? The last two require much stronger evidence.
5. **Definition of “risk”:** hazard severity, business interruption, expected loss, probability of repayment stress, or default risk? Those require different data and labels.
6. **Financial-input availability:** will users manually supply ranges, or is there an authorized financial-data integration? Do not assume one exists.
7. **Flood source for the target area:** is there a suitable asset-level hazard map with depth/probability metadata, valid coverage, and acceptable terms? The World Bank exposure grid alone does not satisfy this requirement.
8. **Historical outcomes:** are there verified interruption records, insurance losses, revenue declines, arrears, or defaults? What entity, date, unit and consent support the labels?
9. **Utility granularity:** can an appropriate public or consented outage source be obtained for the chosen region, and how often does it update?
10. **Feature validation:** what experts or users will assess whether heat/rainfall thresholds and sector sensitivities make sense?
11. **Operational constraints:** permitted API volume, service reliability, data retention, hosting region, security, and offline/demo behavior.
12. **License for demo and future use:** can every dataset be cached, processed, displayed, redistributed, and used commercially if the project evolves?
13. **Impact measurement:** what evidence will show that the product improves preparation or review rather than merely producing a score? Possible metrics include useful alert lead time, correction rate, action completion, and reviewer agreement.

## Section 16: Key Takeaways

1. **Climate hazard is not credit risk.** Credit consequences require a defensible pathway through exposure, business operations, finances, and repayment capacity.
2. **Exposure is not damage.** A population-exposure dataset is not a direct asset-loss estimate.
3. **The supplied World Bank flood resource is contextual for this use case.** It reports modeled population exposure at 3-arcsecond resolution for a 1-in-100-year scenario; it is not a business-address flood probability or MSME loss model [1, 2].
4. **Forecasts, reanalysis, historical observed floods, and climate projections are different evidence types.** Preserve type, time, source, and uncertainty in outputs.
5. **Most business-specific inputs are not public environmental data.** Supplier criticality, backup power, stock sensitivity, cash reserves, and insurance need owner/lender data or explicit synthetic values.
6. **A rules-based index is the defensible starting point.** Without reliable labeled outcomes, ML does not provide validated default prediction.
7. **Missing data must remain visible.** Unknown does not mean zero risk; coarse regional proxies do not equal direct business measurements.
8. **Data provenance is a core feature.** Users should see what drove the result, when it was retrieved, how it was calculated, and how certain it is.
9. **Lending support must be governed and human-reviewed.** Do not automatically approve/deny, impose adverse decisions from geography alone, or present an unvalidated score as a probability.
10. **The strongest MVP demonstrates one honest, end-to-end use case.** It is better to support a small region and a fictional business transparently than to claim global, real-time, predictive coverage that has not been built or validated.

## Section 17: Next-Stage Research Checklist

### Priority 0 — Resolve brief and scope before implementation

- [ ] Obtain the complete FIN-05 problem statement and the exact titles/URLs of all three institution-provided references.
- [ ] Confirm the target geography, target user, and the primary outcome: early warning, business resilience, lending support, or predictive credit risk.
- [ ] Define what “risk score” means and explicitly exclude unsupported interpretations (e.g., default probability) from the prototype.
- [ ] Decide which values will be public observations, modeled data, owner-reported data, regional proxies, or synthetic demonstration values.

### Priority 1 — Verify the minimum data slice

- [ ] Test one documented weather API request for a fictional business coordinate and record provider, model, units, issue time, valid times, source terms, and attribution.
- [ ] Retrieve a small, consistent historical temperature/rainfall baseline for the same location and define an anomaly/heat feature with an explicit period and threshold.
- [ ] Download the World Bank flood resource Read Me and a small regional sample; verify its exact value bands, nodata, coordinate reference, grid interpretation, licence, and processing notes.
- [ ] Determine whether a separate asset-level flood-hazard layer is available and acceptable for the chosen region. If not, label the flood assessment contextual/incomplete.
- [ ] Inspect satellite acquisition dates/clouds only if imagery will materially support the chosen business use case; otherwise defer automated imagery analysis.
- [ ] Verify all chosen sources' current access, authentication, licensing, rate limits, redistribution and commercial-use conditions.

### Priority 2 — Define modeling and validation rules

- [ ] Write a one-page causal model from hazard to operations to finances, identifying every inferred link.
- [ ] Create a data dictionary including units, source version, spatial/temporal resolution, baseline, missing-value rules, update frequency, and provenance.
- [ ] Specify feature formulas and tests with hand-checkable examples.
- [ ] Choose a rules-based baseline; document thresholds, weights, rationale, review process, and version.
- [ ] Perform sensitivity tests by varying weights/thresholds and comparing business cases.
- [ ] Ensure low risk, high risk, unavailable data, stale data, and conflicting data remain distinct states.
- [ ] Have a domain reviewer challenge regional proxies, hazard thresholds, sector assumptions, and recommendation mappings.

### Priority 3 — Responsible-use checks

- [ ] Define consent, data minimization, retention, access roles, correction/deletion, and security handling for financial/business data.
- [ ] Document why the tool supports rather than replaces human credit decisions.
- [ ] Test for potential adverse effects on businesses in vulnerable regions and underrepresented sectors.
- [ ] Keep uncertainty descriptions grounded in measurable data quality or validation, not arbitrary confidence percentages.
- [ ] Record all inputs, changes, explanations, and score versions so a reviewer can reconstruct an assessment.

### Priority 4 — Define a credible demo and impact test

- [ ] Build one fictional case end to end and at least two counterfactuals (same hazard but stronger resilience; same business but different hazard exposure).
- [ ] Verify that the change in output follows from changed inputs and displays which driver changed.
- [ ] Test behavior when an API fails, a location is ambiguous, data are stale, a variable is missing, and a provider changes units or schema.
- [ ] Ask a business-oriented reviewer to identify the top three risk drivers and select an action without coaching; record whether the explanation was understandable.
- [ ] Clearly label simulated alerts, synthetic data, and illustrative scores during the demo.
- [ ] Do not begin model training until appropriate historical outcome labels and a validation plan are actually available.

---

## Sources and research references

**[1] World Bank Data Catalog.** *Global Flood Exposure: Gridded exposure headcounts by country.* Official metadata, coverage, resolution, scenario description, update date, and CC BY 4.0 licence. https://datacatalog.worldbank.org/search/dataset/0062763/global-flood-exposure-gridded-exposure-headcounts-by-country

**[2] Rentschler, J., Salhab, M., & Jafino, B. (2022).** “Flood exposure and poverty in 188 countries.” *Nature Communications* 13, 3527. Methodology and interpretation of population exposure. https://www.nature.com/articles/s41467-022-30727-4

**[3] Open-Meteo.** Weather Forecast API documentation. Forecast variables and horizon. https://open-meteo.com/en/docs

**[4] Open-Meteo.** Historical Weather API documentation. Reanalysis variables, spatial resolutions and historical periods. https://open-meteo.com/en/docs/historical-weather-api

**[5] Open-Meteo.** Terms and pricing. Non-commercial API conditions, rate limits, attribution and commercial plan requirements. https://open-meteo.com/en/terms and https://open-meteo.com/en/pricing

**[6] Copernicus Data Space Ecosystem.** Sentinel-2 mission and product documentation. Spectral bands, resolutions, coverage and product processing. https://documentation.dataspace.copernicus.eu/Data/SentinelMissions/Sentinel2.html

**[7] Climate Hazards Center, UCSB / data.gov metadata.** CHIRPS Version 2.0 precipitation data. Geographic coverage, resolution and historical period. https://www.chc.ucsb.edu/data/chirps and https://catalog.data.gov/dataset/chirps-version-2-0-precipitation-global-0-05-annual-1981-present

**[8] NASA Global Precipitation Measurement Mission.** IMERG data and data directory. Resolution, temporal products, history and latency differences by run. https://gpm.nasa.gov/data/imerg and https://gpm.nasa.gov/data/directory

**[9] World Resources Institute.** Aqueduct Water Risk Atlas help and data exports, including current export formats and indicator documentation references. https://www.wri.org/aqueduct/help-center/how-use-analysis-features-water-risk-atlas and https://www.wri.org/aqueduct

**[10] World Bank.** Climate Change Knowledge Portal: data download and API documentation. https://climateknowledgeportal.worldbank.org/index.php/download-data

**[11] Copernicus Climate Data Store.** ERA5-Land hourly data from 1950 to present. Spatial and temporal resolution, coverage, update frequency, licence. https://cds.climate.copernicus.eu/datasets/reanalysis-era5-land

**[12] Tellman et al. (2021).** Global Flood Database and flood-event mapping, as referenced in research descriptions. Scientific article: https://www.nature.com/articles/s41597-021-00819-1. A secondary description of period/resolution was also inspected; confirm the exact current data download and license before use.

**[13] World Meteorological Organization.** *Handbook of Drought Indicators and Indices* (WMO-No. 1173) and *Standardized Precipitation Index User Guide* (WMO-No. 1090). https://community.wmo.int/site/knowledge-hub/programmes-and-initiatives/agricultural-meteorology/agmp-proceedings

**[14] NIST and Basel Committee on Banking Supervision.** NIST AI Risk Management Framework 1.0 and Basel Committee Principles for the supervision of climate-related financial risks. https://www.nist.gov/itl/ai-risk-management-framework and https://www.bis.org/committees/bcbs/basel-consolidated-guidelines/module/rma/60

**[15] International Finance Corporation (IFC).** *Mapping of Digital Solutions to Support Financial Services Providers in Assessing Climate Impact on Agricultural Portfolios* (2024). Evidence that digital climate-risk solutions are already used in financial/agricultural contexts. https://www.ifc.org/en/insights-reports/2024/mapping-of-digital-solutions-to-support-financial-services-providers-in-assessing-climate-impact-on-agricultural-portfolios

**Research cutoff:** 9 October 2026. Dataset properties, APIs, terms, versions, and availability may change. Recheck the primary documentation before implementation. This report is a learning and feasibility document, not financial, legal, credit-underwriting, or engineering certification advice.
