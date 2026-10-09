import { z } from "zod";
import { openMeteoReady } from "@/lib/config/env";
import { fetchJson } from "@/lib/ingestion/http";
import type { Provenance } from "@/lib/integrations/types";
import { endpoint } from "./client";
import { riverStatistics, type RiverStatistics } from "./river-stats";

export interface RiverForecastDay {
  date: string;
  dischargeM3s: number | null;
  ensembleMedianM3s: number | null;
  ensembleMaxM3s: number | null;
}

export interface RiverContext {
  status: "available" | "partial" | "unavailable";
  gridLatitude: number | null;
  gridLongitude: number | null;
  forecast: RiverForecastDay[];
  statistics: RiverStatistics | null;
  detail: string;
  limitations: string[];
  provenance: Provenance;
}

const seriesSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  daily: z.object({
    time: z.array(z.string()),
    river_discharge: z.array(z.number().nullable()),
    river_discharge_median: z.array(z.number().nullable()).optional(),
    river_discharge_max: z.array(z.number().nullable()).optional(),
  }),
});

const cache = new Map<string, { at: number; value: RiverContext }>();
const CACHE_MS = 6 * 3600_000;
const LIMITATIONS = [
  "GloFAS simulates discharge on a ~5 km river grid and reports the nearest river cell. A small stream or drain next to the site may not be represented.",
  "Return levels are empirical (median and 90th percentile of annual maxima), not a fitted extreme-value model.",
  "River discharge is regional context. It is not an official flood warning and does not change the business score.",
];

export async function fetchRiverContext(latitude: number, longitude: number): Promise<RiverContext> {
  const key = `${latitude.toFixed(3)},${longitude.toFixed(3)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const retrievedAt = new Date().toISOString();
  const lastYear = new Date().getUTCFullYear() - 1;
  const provenance = (validFrom: string | null, validTo: string | null): Provenance => ({
    sourceId: "open-meteo-flood",
    retrievedAt,
    validFrom,
    validTo,
    licence: "Open-Meteo CC BY 4.0 data; GloFAS by Copernicus Emergency Management Service",
    attribution: "Open-Meteo Flood API, Global Flood Awareness System (GloFAS, Copernicus EMS)",
    spatialResolution: "About 5 km river grid",
    temporalResolution: "Daily",
    transformationVersion: "glofas-annual-max-1.0.0",
  });
  const ready = openMeteoReady();
  if ("error" in ready) {
    return { status: "unavailable", gridLatitude: null, gridLongitude: null, forecast: [], statistics: null, detail: ready.error, limitations: LIMITATIONS, provenance: provenance(null, null) };
  }
  const base = endpoint(ready.floodBaseUrl, ready.apiKey, ready.mode);
  const url = (params: Record<string, string>) => {
    const target = new URL(base);
    target.searchParams.set("latitude", latitude.toFixed(4));
    target.searchParams.set("longitude", longitude.toFixed(4));
    for (const [name, value] of Object.entries(params)) target.searchParams.set(name, value);
    return target.toString();
  };
  const [historyResult, forecastResult] = await Promise.allSettled([
    fetchJson(url({ daily: "river_discharge", start_date: "1991-01-01", end_date: `${lastYear}-12-31` }), { timeoutMs: 20000 }),
    fetchJson(url({ daily: "river_discharge,river_discharge_median,river_discharge_max", forecast_days: "30" }), { timeoutMs: 15000 }),
  ]);
  const history = historyResult.status === "fulfilled" ? seriesSchema.safeParse(historyResult.value) : null;
  const forecastParsed = forecastResult.status === "fulfilled" ? seriesSchema.safeParse(forecastResult.value) : null;
  const statistics = history?.success ? riverStatistics(history.data.daily.time, history.data.daily.river_discharge) : null;
  const forecast: RiverForecastDay[] = forecastParsed?.success
    ? forecastParsed.data.daily.time.map((date, index) => ({
        date,
        dischargeM3s: forecastParsed.data.daily.river_discharge[index] ?? null,
        ensembleMedianM3s: forecastParsed.data.daily.river_discharge_median?.[index] ?? null,
        ensembleMaxM3s: forecastParsed.data.daily.river_discharge_max?.[index] ?? null,
      }))
    : [];
  const grid = forecastParsed?.success ? forecastParsed.data : history?.success ? history.data : null;
  const hasForecast = forecast.some((day) => day.dischargeM3s !== null);
  const status = hasForecast && statistics ? "available" : hasForecast || statistics ? "partial" : "unavailable";
  const value: RiverContext = {
    status,
    gridLatitude: grid?.latitude ?? null,
    gridLongitude: grid?.longitude ?? null,
    forecast,
    statistics,
    detail:
      status === "unavailable"
        ? "GloFAS returned no usable discharge for the nearest river cell."
        : statistics
          ? `Nearest GloFAS river cell at ${grid?.latitude.toFixed(3)}, ${grid?.longitude.toFixed(3)}; ${statistics.years} complete years of reanalysis.`
          : "Forecast available; too few complete reanalysis years for return levels.",
    limitations: LIMITATIONS,
    provenance: provenance(forecast[0]?.date ?? null, forecast.at(-1)?.date ?? null),
  };
  if (status !== "unavailable") cache.set(key, { at: Date.now(), value });
  return value;
}
