import type { AdapterHealth } from "@/lib/integrations/types";

export function imergHealth(): AdapterHealth {
  const configured = Boolean(process.env.NASA_EARTHDATA_USERNAME && process.env.NASA_EARTHDATA_PASSWORD);
  return {
    sourceId: "nasa-gpm-imerg",
    status: configured ? "needs_credentials" : "needs_credentials",
    configured,
    detail: configured
      ? "Earthdata credentials are present, but no IMERG product request has been verified. Rainfall estimates are not flood depth."
      : "IMERG Early, Late, or Final retrieval needs an Earthdata account. No product is selected until credentials and a run choice exist.",
  };
}
