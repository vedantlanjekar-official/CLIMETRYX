import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Provenance } from "@/lib/integrations/types";
import { summarizeFloodWindow, FLOOD_CLASSES, type FloodWindowSummary } from "./classes";

interface IndexFile {
  file: string;
  country: string;
  url: string;
  bbox: [number, number, number, number];
  width: number;
  height: number;
  bands: number;
  noData: number;
}

interface FloodIndex {
  dataset: string;
  licence: string;
  resolution: string;
  generatedAt: string;
  files: IndexFile[];
}

export interface FloodExposureContext {
  status: "available" | "no_population" | "not_covered" | "unavailable";
  file: string | null;
  bufferMeters: number;
  summary: FloodWindowSummary | null;
  classes: typeof FLOOD_CLASSES;
  detail: string;
  limitations: string[];
  provenance: Provenance;
}

const HALF_WINDOW_PX = 6;
const BUFFER_METERS = Math.round(HALF_WINDOW_PX * 92.6);
const cache = new Map<string, { at: number; value: FloodExposureContext }>();
const CACHE_MS = 24 * 3600_000;
let indexPromise: Promise<FloodIndex | null> | null = null;

function loadIndex(): Promise<FloodIndex | null> {
  indexPromise ??= readFile(path.join(process.cwd(), "data", "catalog", "floodpop-index.json"), "utf8")
    .then((text) => JSON.parse(text) as FloodIndex)
    .catch(() => null);
  return indexPromise;
}

const LIMITATIONS = [
  "Modelled 1-in-100-year flood hazard combined with gridded population, as published by the World Bank (Rentschler, Salhab and Jafino, 2022). Local defences and drainage may not be represented.",
  "Band meanings are inferred from the published methodology (Rentschler et al., 2022) and checked against the river pattern in sampled tiles; the dataset Read Me was not available to confirm them.",
  "Counts people per ~90 m cell. Cells with no population carry no class, so an empty area is shown as unknown, not as safe.",
  "Regional context only. It is not the flood depth at the business and carries no weight in the business score.",
];

function provenance(retrievedAt: string, file: string | null): Provenance {
  return {
    sourceId: "world-bank-flood-exposure",
    retrievedAt,
    validFrom: null,
    validTo: null,
    licence: "CC BY 4.0",
    attribution: `World Bank, Global Flood Exposure (DR0089139)${file ? `, ${file}` : ""}; Rentschler, Salhab and Jafino (2022).`,
    spatialResolution: "3 arc-seconds (about 90 m)",
    temporalResolution: "Static scenario (1-in-100-year flood)",
    transformationVersion: "floodpop-window-1.0.0",
  };
}

export async function sampleFloodExposure(latitude: number, longitude: number): Promise<FloodExposureContext> {
  const key = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const retrievedAt = new Date().toISOString();
  const base = { bufferMeters: BUFFER_METERS, classes: FLOOD_CLASSES, limitations: LIMITATIONS };
  const index = await loadIndex();
  if (!index) {
    return { ...base, status: "unavailable", file: null, summary: null, detail: "The flood-exposure tile index is missing. Run scripts/index-floodpop.ts.", provenance: provenance(retrievedAt, null) };
  }
  const candidates = index.files.filter(
    ({ bbox: [minX, minY, maxX, maxY] }) => longitude >= minX && longitude <= maxX && latitude >= minY && latitude <= maxY,
  );
  if (candidates.length === 0) {
    const countries = [...new Set(index.files.map((file) => file.country))].join(", ");
    const value: FloodExposureContext = {
      ...base,
      status: "not_covered",
      file: null,
      summary: null,
      detail: `No indexed flood-exposure tile covers this point. Indexed countries: ${countries}.`,
      provenance: provenance(retrievedAt, null),
    };
    cache.set(key, { at: Date.now(), value });
    return value;
  }
  try {
    const { fromUrl } = await import("geotiff");
    const results = await Promise.all(
      candidates.map(async (candidate) => {
        const image = await (await fromUrl(candidate.url)).getImage();
        const [minX, , , maxY] = image.getBoundingBox() as [number, number, number, number];
        const [resX, resY] = image.getResolution() as [number, number];
        const col = Math.floor((longitude - minX) / resX);
        const row = Math.floor((latitude - maxY) / resY);
        const window = [
          Math.max(0, col - HALF_WINDOW_PX),
          Math.max(0, row - HALF_WINDOW_PX),
          Math.min(image.getWidth(), col + HALF_WINDOW_PX + 1),
          Math.min(image.getHeight(), row + HALF_WINDOW_PX + 1),
        ];
        const rasters = (await image.readRasters({ window })) as unknown as ArrayLike<number>[];
        const width = window[2]! - window[0]!;
        const pinIndex = (row - window[1]!) * width + (col - window[0]!);
        return { candidate, summary: summarizeFloodWindow(rasters, pinIndex) };
      }),
    );
    const best = results.sort((a, b) => b.summary.populatedCells - a.summary.populatedCells)[0]!;
    const value: FloodExposureContext = {
      ...base,
      status: best.summary.populatedCells > 0 ? "available" : "no_population",
      file: best.candidate.file,
      summary: best.summary,
      detail:
        best.summary.populatedCells > 0
          ? `${best.summary.populatedCells} populated cells within about ${BUFFER_METERS} m of the pin.`
          : `No populated cells within about ${BUFFER_METERS} m of the pin, so the dataset gives no exposure class here.`,
      provenance: provenance(retrievedAt, best.candidate.file),
    };
    cache.set(key, { at: Date.now(), value });
    return value;
  } catch {
    return {
      ...base,
      status: "unavailable",
      file: candidates[0]!.file,
      summary: null,
      detail: "The World Bank GeoTIFF could not be read. Try again later.",
      provenance: provenance(retrievedAt, candidates[0]!.file),
    };
  }
}
