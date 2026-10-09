# Data sources

The machine-readable registry is `metadata/source-registry.json`. The research note's dataset tables remain in `FIN-05_Research_Learning_Document.md`.

Every source named in that note is represented:

- World Bank Global Flood Exposure, the only named organizer dataset.
- Two further organizer references, recorded as unidentified.
- Open-Meteo forecast, historical weather, and geocoding. All three are verified and configured for non-commercial use.
- ERA5 1991–2020 climatology, fitted from the Open-Meteo historical API (`open-meteo-era5-climatology`). Reference fits for Pune, Mumbai, Delhi and Chennai are in `data/models/climatology/`.
- Sentinel-2 through the current Copernicus STAC endpoint.
- CHIRPS. The note verified version 2. The implementation target is version 3, and version 2 is kept as a citation with status `unavailable` for new work.
- ERA5-Land, Aqueduct, IMERG, CCKP, and the Global Flood Database.
- Official warnings, utility reliability, and user-supplied costs, each without a pretended global API.

Verification details and licences are in `docs/API_INTEGRATIONS.md`.
