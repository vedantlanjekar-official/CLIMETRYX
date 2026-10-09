"""Sentinel-2 NDVI worker.

This process is not runnable in the current environment: the Python launcher
points at a missing interpreter. When Python, rasterio, and Copernicus
credentials exist, the worker should:

1. Read a STAC item id recorded by lib/integrations/copernicus/stac.ts.
2. Download B04 and B08 at 10 m, plus the scene classification layer.
3. Mask cloud and shadow classes.
4. Compute (B08 - B04) / (B08 + B04) inside the documented buffer.
5. Write the mean, acquisition time, cloud filter, and item id to the
   satellite_observations row.

Until that happens the application status remains not_available.
Do not print credentials.
"""

import sys

sys.stderr.write("NDVI worker needs a working Python environment and rasterio.\n")
sys.exit(1)
