import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { AdapterHealth, Provenance } from "@/lib/integrations/types";

export interface FloodExposureImport {
  status: "needs_download" | "validated_metadata_only";
  provenance: Provenance;
  limitations: string[];
  bytes?: number;
  sha256?: string;
}

export function floodExposureHealth(): AdapterHealth {
  return {
    sourceId: "world-bank-global-flood-exposure",
    status: "needs_download",
    configured: false,
    detail:
      "Cataloged only. The global raster is not downloaded. A local Read Me and regional extract can be validated by the importer; pixel values are not invented.",
  };
}

export async function inspectFloodExposureFile(path: string, now = new Date()): Promise<FloodExposureImport> {
  const bytes = await readFile(path);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const header = bytes.subarray(0, 4).toString("ascii");
  const looksLikeTiff = header === "II*\u0000" || header === "MM\u0000*" || bytes[0] === 0x49 || bytes[0] === 0x4d;
  if (!looksLikeTiff && !path.toLowerCase().endsWith(".tif") && !path.toLowerCase().endsWith(".tiff")) {
    throw new Error("The flood exposure file is not a recognized GeoTIFF header. It was not parsed into values.");
  }
  return {
    status: "validated_metadata_only",
    bytes: bytes.byteLength,
    sha256,
    limitations: [
      "File presence and a checksum are not a sampled flood depth.",
      "This dataset counts people exposed to a modelled 1-in-100-year inundation scenario at about 3 arcseconds. It is not a business flood probability.",
      "Band names, nodata, and CRS must be confirmed from the official Read Me before any pixel is used.",
    ],
    provenance: {
      sourceId: "world-bank-global-flood-exposure",
      retrievedAt: now.toISOString(),
      validFrom: null,
      validTo: null,
      licence: "CC BY 4.0 as stated by the World Bank Data Catalog. Reconfirm before redistribution.",
      attribution: "World Bank: Global Flood Exposure, gridded exposure headcounts by country.",
      spatialResolution: "3 arcseconds, about 90 m at the equator. Ground size changes with latitude.",
      temporalResolution: "Modelled scenario, not a time series or a forecast.",
      transformationVersion: "flood-exposure-inspect-1.0.0",
    },
  };
}

export const FLOOD_CATALOG_URL =
  "https://datacatalog.worldbank.org/search/dataset/0062763/global-flood-exposure-gridded-exposure-headcounts-by-country";
