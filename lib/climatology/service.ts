import { CLIMATOLOGY_VERSION, currentSpi, fitClimatology, type ClimatologyModel, type CurrentSpi } from "@/lib/climatology/model";
import { fetchEra5Daily } from "@/lib/integrations/open-meteo/client";

/** WMO standard climate normal period. */
export const BASELINE_START = "1991-01-01";
export const BASELINE_END = "2020-12-31";
const RECENT_DAYS = 120;
const MEMORY_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface ClimatologySnapshot {
  model: ClimatologyModel;
  spi30: CurrentSpi;
  spi90: CurrentSpi;
  cacheHit: "memory" | "store" | "none";
}

export interface ClimatologyStore {
  load(grid: { latitude: number; longitude: number }, version: string): Promise<ClimatologyModel | null>;
  save(grid: { latitude: number; longitude: number }, model: ClimatologyModel): Promise<void>;
}

const memory = new Map<string, { model: ClimatologyModel; expires: number }>();

/** ERA5 is a 0.25° grid. Snapping keeps one fit per cell and avoids storing exact business coordinates. */
export function snapToGrid(latitude: number, longitude: number) {
  return { latitude: Math.round(latitude * 4) / 4, longitude: Math.round(longitude * 4) / 4 };
}

function isoDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function localClimatology(input: { latitude: number; longitude: number; store?: ClimatologyStore; now?: Date }): Promise<ClimatologySnapshot> {
  const grid = snapToGrid(input.latitude, input.longitude);
  const key = `${CLIMATOLOGY_VERSION}:${grid.latitude}:${grid.longitude}`;
  const now = input.now ?? new Date();
  let model: ClimatologyModel | null = null;
  let cacheHit: ClimatologySnapshot["cacheHit"] = "none";

  const cached = memory.get(key);
  if (cached && cached.expires > now.getTime()) {
    model = cached.model;
    cacheHit = "memory";
  }
  if (!model && input.store) {
    model = await input.store.load(grid, CLIMATOLOGY_VERSION).catch(() => null);
    if (model) cacheHit = "store";
  }
  if (!model) {
    const baseline = await fetchEra5Daily({ ...grid, startDate: BASELINE_START, endDate: BASELINE_END });
    model = fitClimatology(
      baseline.records,
      {
        provider: "Open-Meteo Historical Weather API",
        model: "ERA5 reanalysis (models=era5)",
        gridLatitude: baseline.gridLatitude,
        gridLongitude: baseline.gridLongitude,
        elevationM: baseline.elevationM,
        retrievedAt: baseline.retrievedAt,
        licence:
          baseline.licenceMode === "non_commercial"
            ? "Open-Meteo free API, non-commercial use only. ERA5 data: Copernicus Climate Change Service."
            : "Open-Meteo commercial plan. ERA5 data: Copernicus Climate Change Service.",
        attribution: "Weather data by Open-Meteo.com; contains modified Copernicus Climate Change Service information (ERA5).",
      },
      now,
    );
    if (input.store) await input.store.save(grid, model).catch(() => undefined);
  }
  memory.set(key, { model, expires: now.getTime() + MEMORY_TTL_MS });

  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - RECENT_DAYS);
  const recent = await fetchEra5Daily({ ...grid, startDate: isoDay(start), endDate: isoDay(now) });
  return {
    model,
    spi30: currentSpi(model, recent.records, 30),
    spi90: currentSpi(model, recent.records, 90),
    cacheHit,
  };
}
