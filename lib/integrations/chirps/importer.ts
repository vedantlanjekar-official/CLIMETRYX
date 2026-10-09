import type { AdapterHealth } from "@/lib/integrations/types";

export const CHIRPS_V3_REPOSITORY = "https://data.chc.ucsb.edu/products/CHIRPS/v3.0/";
export const CHIRPS_V3_PRODUCT_PAGE = "https://www.chc.ucsb.edu/data/chirps3";

export function chirpsHealth(): AdapterHealth {
  return {
    sourceId: "chirps-v3",
    status: "needs_download",
    configured: false,
    detail:
      "CHIRPS v3 is the implementation target. No global rainfall archive is downloaded. The research note cited CHIRPS v2; that citation is kept in the registry and is not the default product.",
  };
}

export function chirpsCoverage(latitude: number): "inside" | "outside" {
  return latitude <= 60 && latitude >= -60 ? "inside" : "outside";
}
