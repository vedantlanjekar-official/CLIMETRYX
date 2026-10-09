import type { AdapterHealth } from "@/lib/integrations/types";

export function era5Health(): AdapterHealth {
  const configured = Boolean(process.env.CDSAPI_KEY);
  return {
    sourceId: "era5-land",
    status: configured ? "needs_credentials" : "needs_credentials",
    configured,
    detail: configured
      ? "A CDS key is present. Interactive requests do not download ERA5-Land. Submit a regional subset through the CDS workflow."
      : "ERA5-Land via the Climate Data Store needs CDSAPI_URL and CDSAPI_KEY. Historical Open-Meteo reanalysis is a different access path and is not relabelled as a CDS download.",
  };
}
