import { z } from "zod";
import { fetchJson, ProviderError } from "@/lib/ingestion/http";
import { boundingBox } from "@/lib/geospatial/coordinates";
import type { AdapterHealth, Provenance } from "@/lib/integrations/types";

const itemSchema = z.object({
  id: z.string(),
  collection: z.string().optional(),
  properties: z.object({
    datetime: z.string().nullable().optional(),
    "eo:cloud_cover": z.number().optional(),
  }),
  assets: z.record(
    z.string(),
    z.object({
      href: z.string().optional(),
      type: z.string().optional(),
    }),
  ),
  bbox: z.array(z.number()).optional(),
});

const searchSchema = z.object({
  features: z.array(itemSchema).optional(),
});

export interface SatelliteCatalogHit {
  itemId: string;
  collection: string;
  acquisitionTime: string | null;
  cloudCoverPct: number | null;
  redAsset: boolean;
  nirAsset: boolean;
  provenance: Provenance;
}

export interface IndexStatistics {
  mean: number;
  median: number;
  p2: number;
  p98: number;
  validPercent: number;
  pixels: number;
}

export interface SceneObservation {
  itemId: string;
  acquisitionTime: string;
  sceneCloudPct: number | null;
  localCloudPct: number;
  ndvi: IndexStatistics;
  ndwi: IndexStatistics;
  tiles: { trueColor: string; ndvi: string };
}

export interface NdviPathway {
  status: "available" | "not_available";
  reason: string;
  catalog: SatelliteCatalogHit | null;
  formula: "(B08 - B04) / (B08 + B04)";
  bufferMeters: number;
  limitations: string[];
  latest?: SceneObservation | null;
  previousYear?: SceneObservation | null;
}

export function copernicusHealth(): AdapterHealth {
  const hasSecret = Boolean(process.env.COPERNICUS_CLIENT_ID && process.env.COPERNICUS_PASSWORD);
  return {
    sourceId: "copernicus-sentinel-2-l2a",
    status: hasSecret ? "needs_credentials" : "needs_configuration",
    configured: hasSecret,
    detail: hasSecret
      ? "Credentials are present. NDVI is still not_available until a worker downloads B04 and B08 and applies the cloud mask."
      : "STAC search can run without a token. Scene download and NDVI need an authorized Copernicus account and a raster worker.",
  };
}

export async function searchSentinel2L2a(input: {
  latitude: number;
  longitude: number;
  bufferMeters?: number;
  start: string;
  end: string;
  maxCloudCover?: number;
  now?: Date;
}): Promise<SatelliteCatalogHit | null> {
  const bufferMeters = input.bufferMeters ?? 500;
  const bbox = boundingBox(input.latitude, input.longitude, bufferMeters);
  const endpoint = process.env.COPERNICUS_STAC_URL?.trim() || "https://stac.dataspace.copernicus.eu/v1/";
  const url = new URL("search", endpoint.endsWith("/") ? endpoint : `${endpoint}/`);
  const raw = await fetchJson(url.toString(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      collections: ["sentinel-2-l2a"],
      bbox,
      datetime: `${input.start}/${input.end}`,
      limit: 5,
      query: { "eo:cloud_cover": { lt: input.maxCloudCover ?? 30 } },
    }),
    timeoutMs: 20000,
    retries: 1,
  });
  const parsed = searchSchema.safeParse(raw);
  if (!parsed.success) throw new ProviderError("Sentinel STAC response did not match the expected schema.", "invalid");
  const feature = parsed.data.features?.[0];
  if (!feature) return null;
  const now = input.now ?? new Date();
  return {
    itemId: feature.id,
    collection: feature.collection ?? "sentinel-2-l2a",
    acquisitionTime: feature.properties.datetime ?? null,
    cloudCoverPct: feature.properties["eo:cloud_cover"] ?? null,
    redAsset: Boolean(feature.assets.B04_10m),
    nirAsset: Boolean(feature.assets.B08_10m),
    provenance: {
      sourceId: "copernicus-sentinel-2-l2a",
      retrievedAt: now.toISOString(),
      validFrom: feature.properties.datetime ?? null,
      validTo: feature.properties.datetime ?? null,
      licence: "Copernicus Sentinel data. Confirm the current Copernicus licence before redistribution.",
      attribution: "Contains modified Copernicus Sentinel data.",
      spatialResolution: "Sentinel-2 L2A bands at 10 m, 20 m, or 60 m depending on the band.",
      temporalResolution: "Single acquisition. Revisit is not a continuous observation.",
      transformationVersion: "stac-discovery-1.0.0",
    },
  };
}

export function ndviPathway(hit: SatelliteCatalogHit | null): NdviPathway {
  return {
    status: "not_available",
    reason: hit
      ? "A Sentinel-2 L2A catalog item was found, but B04/B08 pixels were not downloaded or processed. Catalog discovery is not an NDVI value."
      : "No cloud-filtered Sentinel-2 L2A item was returned for the buffer and date window.",
    catalog: hit,
    formula: "(B08 - B04) / (B08 + B04)",
    bufferMeters: 500,
    limitations: [
      "NDVI describes vegetation or land-surface greenness. It does not establish flood probability, business loss, or credit risk.",
      "A basemap, thumbnail, or STAC item is not a satellite-derived indicator.",
      "Cloud cover, shadows, and urban surfaces can make NDVI a poor description of a shop or factory.",
    ],
  };
}
