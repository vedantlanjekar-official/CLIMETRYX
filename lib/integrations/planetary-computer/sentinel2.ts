import { z } from "zod";
import { fetchJson } from "@/lib/ingestion/http";
import type { IndexStatistics, NdviPathway, SatelliteCatalogHit, SceneObservation } from "@/lib/integrations/copernicus/stac";
import type { Provenance } from "@/lib/integrations/types";
import { localCloudPercent, squareAround } from "./geometry";

const STAC = "https://planetarycomputer.microsoft.com/api/stac/v1/search";
const DATA = "https://planetarycomputer.microsoft.com/api/data/v1/item";
const COLLECTION = "sentinel-2-l2a";
const BUFFER_METERS = 500;
const MAX_LOCAL_CLOUD_PCT = 10;
const NDVI = "(B08_b1-B04_b1)/(B08_b1+B04_b1)";
const NDWI = "(B03_b1-B08_b1)/(B03_b1+B08_b1)";

const searchSchema = z.object({
  features: z.array(
    z.object({
      id: z.string(),
      properties: z.object({ datetime: z.string(), "eo:cloud_cover": z.number().optional() }),
    }),
  ),
});

const statSchema = z.object({
  mean: z.number(),
  median: z.number(),
  percentile_2: z.number(),
  percentile_98: z.number(),
  valid_percent: z.number(),
  count: z.number(),
});

const statisticsSchema = z.object({ properties: z.object({ statistics: z.record(z.string(), z.unknown()) }) });

const cache = new Map<string, { at: number; value: NdviPathway }>();
const CACHE_MS = 12 * 3600_000;

const LIMITATIONS = [
  "NDVI (vegetation) and NDWI (surface water) describe land cover around the site. They do not measure flood probability, business loss or credit risk.",
  `Values are averaged over a square of about ${BUFFER_METERS * 2} m around the pin. Roofs, roads and water bodies in the square all count.`,
  `Scenes are rejected when clouds or cloud shadow cover more than ${MAX_LOCAL_CLOUD_PCT}% of the square (Sentinel-2 scene classification). Haze can still bias values.`,
  "Satellite indicators are context. They do not change the business score.",
];

export function tileTemplates(itemId: string): { trueColor: string; ndvi: string } {
  const base = `${DATA}/tiles/WebMercatorQuad/{z}/{x}/{y}@1x?collection=${COLLECTION}&item=${encodeURIComponent(itemId)}`;
  return {
    trueColor: `${base}&assets=visual&asset_bidx=${encodeURIComponent("visual|1,2,3")}&nodata=0&format=png`,
    ndvi: `${base}&assets=B04&assets=B08&expression=${encodeURIComponent(NDVI)}&rescale=-0.2,0.8&colormap_name=rdylgn&format=png`,
  };
}

async function search(latitude: number, longitude: number, start: Date, end: Date, sort: "datetime" | "eo:cloud_cover") {
  const raw = await fetchJson(STAC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      collections: [COLLECTION],
      intersects: { type: "Point", coordinates: [longitude, latitude] },
      datetime: `${start.toISOString()}/${end.toISOString()}`,
      query: { "eo:cloud_cover": { lt: 40 } },
      sortby: [{ field: sort === "datetime" ? "datetime" : "eo:cloud_cover", direction: sort === "datetime" ? "desc" : "asc" }],
      limit: 6,
    }),
    timeoutMs: 20000,
    retries: 1,
  });
  return searchSchema.parse(raw).features;
}

async function statistics(itemId: string, feature: object, params: string): Promise<Record<string, unknown>> {
  const raw = await fetchJson(`${DATA}/statistics?collection=${COLLECTION}&item=${encodeURIComponent(itemId)}&${params}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(feature),
    timeoutMs: 25000,
    retries: 1,
  });
  return statisticsSchema.parse(raw).properties.statistics;
}

function toIndex(value: unknown): IndexStatistics {
  const stat = statSchema.parse(value);
  const round = (number: number) => Math.round(number * 1000) / 1000;
  return {
    mean: round(stat.mean),
    median: round(stat.median),
    p2: round(stat.percentile_2),
    p98: round(stat.percentile_98),
    validPercent: Math.round(stat.valid_percent),
    pixels: stat.count,
  };
}

async function observe(
  candidates: Array<{ id: string; properties: { datetime: string; "eo:cloud_cover"?: number } }>,
  feature: object,
): Promise<SceneObservation | null> {
  for (const candidate of candidates.slice(0, 4)) {
    const scl = await statistics(candidate.id, feature, "assets=SCL&categorical=true");
    const histogram = (scl.SCL_b1 as { histogram?: [number[], number[]] } | undefined)?.histogram;
    if (!histogram) continue;
    const cloud = localCloudPercent(histogram[0], histogram[1]);
    if (cloud > MAX_LOCAL_CLOUD_PCT) continue;
    const indices = await statistics(
      candidate.id,
      feature,
      `assets=B03&assets=B04&assets=B08&expression=${encodeURIComponent(`${NDVI};${NDWI}`)}`,
    );
    return {
      itemId: candidate.id,
      acquisitionTime: candidate.properties.datetime,
      sceneCloudPct: candidate.properties["eo:cloud_cover"] ?? null,
      localCloudPct: cloud,
      ndvi: toIndex(indices[NDVI]),
      ndwi: toIndex(indices[NDWI]),
      tiles: tileTemplates(candidate.id),
    };
  }
  return null;
}

function provenance(scene: SceneObservation | null, retrievedAt: string): Provenance {
  return {
    sourceId: "planetary-computer-sentinel-2-l2a",
    retrievedAt,
    validFrom: scene?.acquisitionTime ?? null,
    validTo: scene?.acquisitionTime ?? null,
    licence: "Copernicus Sentinel data (free and open, attribution required); served by Microsoft Planetary Computer",
    attribution: "Contains modified Copernicus Sentinel data, processed via Microsoft Planetary Computer.",
    spatialResolution: "10 m (B03, B04, B08); 20 m scene classification",
    temporalResolution: "Single acquisitions, about every 5 days when cloud-free",
    transformationVersion: "pc-s2-indices-1.0.0",
  };
}

export async function observeSentinel2(latitude: number, longitude: number, now = new Date()): Promise<NdviPathway> {
  const key = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const retrievedAt = now.toISOString();
  const feature = { type: "Feature", properties: {}, geometry: squareAround(latitude, longitude, BUFFER_METERS) };
  const base = { formula: "(B08 - B04) / (B08 + B04)" as const, bufferMeters: BUFFER_METERS, limitations: LIMITATIONS };
  try {
    const start = new Date(now);
    start.setUTCDate(start.getUTCDate() - 120);
    const recent = await search(latitude, longitude, start, now, "datetime");
    const latest = await observe(recent, feature);
    let previousYear: SceneObservation | null = null;
    if (latest) {
      const anchor = new Date(latest.acquisitionTime);
      anchor.setUTCFullYear(anchor.getUTCFullYear() - 1);
      const from = new Date(anchor);
      from.setUTCDate(from.getUTCDate() - 30);
      const to = new Date(anchor);
      to.setUTCDate(to.getUTCDate() + 30);
      previousYear = await observe(await search(latitude, longitude, from, to, "eo:cloud_cover"), feature).catch(() => null);
    }
    const catalog: SatelliteCatalogHit | null = latest
      ? {
          itemId: latest.itemId,
          collection: COLLECTION,
          acquisitionTime: latest.acquisitionTime,
          cloudCoverPct: latest.sceneCloudPct,
          redAsset: true,
          nirAsset: true,
          provenance: provenance(latest, retrievedAt),
        }
      : null;
    const value: NdviPathway = latest
      ? {
          ...base,
          status: "available",
          reason: `Sentinel-2 scene of ${latest.acquisitionTime.slice(0, 10)} with ${latest.localCloudPct}% cloud over the site square.`,
          catalog,
          latest,
          previousYear,
        }
      : {
          ...base,
          status: "not_available",
          reason: `No Sentinel-2 scene in the last 120 days had less than ${MAX_LOCAL_CLOUD_PCT}% cloud over the site square.`,
          catalog: null,
          latest: null,
          previousYear: null,
        };
    cache.set(key, { at: Date.now(), value });
    return value;
  } catch {
    return { ...base, status: "not_available", reason: "Planetary Computer did not respond; satellite indicators were not computed.", catalog: null, latest: null, previousYear: null };
  }
}
