# Data directory

`raw/`, `staging/`, and `processed/` are for acquired files and are ignored by Git. Do not commit rasters, NetCDF, credentials, or business uploads.

`samples/` holds synthetic fixtures only. Each file is labelled synthetic and is not loaded as an observation.

`catalog/` records where a dataset would be downloaded. It does not mean the file is present.
