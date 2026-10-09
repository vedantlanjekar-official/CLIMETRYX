import { openMeteoReady } from "@/lib/config/env";
import { fetchJson } from "@/lib/ingestion/http";
import type { Provenance } from "@/lib/integrations/types";
import { endpoint } from "./client";
import { BASELINE, FUTURE, ensembleChanges, periodMetrics, type PeriodMetrics, type ProjectionMetric } from "./projection-stats";

/** One model per modelling centre. Open-Meteo weights long daily requests heavily, so the ensemble is kept small. */
export const CLIMATE_MODELS = ["EC_Earth3P_HR", "MRI_AGCM3_2_S", "MPI_ESM1_2_XR"] as const;

export interface ProjectionContext {
  status: "available" | "unavailable";
  baseline: string;
  future: string;
  modelsUsed: string[];
  metrics: ProjectionMetric[];
  detail: string;
  limitations: string[];
  provenance: Provenance;
}

const cache = new Map<string, { at: number; value: ProjectionContext }>();
const CACHE_MS = 30 * 24 * 3600_000;
const LIMITATIONS = [
  "Projections from three CMIP6 HighResMIP global models (grids of about 20 to 50 km), which follow a high-emissions pathway after 2015. They describe a plausible climate, not a forecast for a particular year.",
  `Changes are computed per model (${FUTURE.from}–${FUTURE.to} minus ${BASELINE.from}–${BASELINE.to}) so each model's own bias cancels; the median and the spread across models are shown. Three models is a small ensemble.`,
  "Projections are context for planning. They do not change the business score.",
];

type DailySeries = Record<string, Array<number | null> | string[]>;

export async function fetchProjections(latitude: number, longitude: number): Promise<ProjectionContext> {
  const cell = { latitude: Math.round(latitude * 4) / 4, longitude: Math.round(longitude * 4) / 4 };
  const key = `${cell.latitude},${cell.longitude}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const retrievedAt = new Date().toISOString();
  const base = {
    baseline: `${BASELINE.from}–${BASELINE.to}`,
    future: `${FUTURE.from}–${FUTURE.to}`,
    limitations: LIMITATIONS,
    provenance: {
      sourceId: "open-meteo-climate",
      retrievedAt,
      validFrom: `${FUTURE.from}-01-01`,
      validTo: `${FUTURE.to}-12-31`,
      licence: "Open-Meteo CC BY 4.0; CMIP6 HighResMIP model data",
      attribution: "Open-Meteo Climate API, CMIP6 HighResMIP",
      spatialResolution: "Model grids of about 20 to 50 km, sampled at the nearest 0.25° cell",
      temporalResolution: "Daily, aggregated to 15-year periods",
      transformationVersion: "cmip6-delta-1.1.0",
    } satisfies Provenance,
  };
  const ready = openMeteoReady();
  if ("error" in ready) return { ...base, status: "unavailable", modelsUsed: [], metrics: [], detail: ready.error };
  const request = async (from: number, to: number) => {
    const target = new URL(endpoint(ready.climateBaseUrl, ready.apiKey, ready.mode));
    target.searchParams.set("latitude", String(cell.latitude));
    target.searchParams.set("longitude", String(cell.longitude));
    target.searchParams.set("start_date", `${from}-01-01`);
    target.searchParams.set("end_date", `${to}-12-31`);
    target.searchParams.set("models", CLIMATE_MODELS.join(","));
    target.searchParams.set("daily", "temperature_2m_max,precipitation_sum");
    const body = (await fetchJson(target.toString(), { timeoutMs: 30000, retries: 1 })) as { daily?: DailySeries };
    return body.daily ?? {};
  };
  try {
    const baselineSeries = await request(BASELINE.from, BASELINE.to);
    const futureSeries = await request(FUTURE.from, FUTURE.to);
    const metricsFor = (series: DailySeries, model: string, from: number, to: number): PeriodMetrics | null => {
      const tmax = series[`temperature_2m_max_${model}`] as Array<number | null> | undefined;
      const precip = series[`precipitation_sum_${model}`] as Array<number | null> | undefined;
      return tmax && precip ? periodMetrics((series.time ?? []) as string[], tmax, precip, from, to) : null;
    };
    const perModel: Array<{ model: string; baseline: PeriodMetrics; future: PeriodMetrics }> = [];
    for (const model of CLIMATE_MODELS) {
      const baseline = metricsFor(baselineSeries, model, BASELINE.from, BASELINE.to);
      const future = metricsFor(futureSeries, model, FUTURE.from, FUTURE.to);
      if (baseline && future) perModel.push({ model, baseline, future });
    }
    if (perModel.length < 3) {
      return { ...base, status: "unavailable", modelsUsed: perModel.map(({ model }) => model), metrics: [], detail: "Fewer than three models returned complete series, so no ensemble is shown." };
    }
    const value: ProjectionContext = {
      ...base,
      status: "available",
      modelsUsed: perModel.map(({ model }) => model),
      metrics: ensembleChanges(perModel),
      detail: `${perModel.length} models with complete daily series at the 0.25° cell ${cell.latitude}, ${cell.longitude}.`,
    };
    cache.set(key, { at: Date.now(), value });
    return value;
  } catch (error) {
    const limited = error instanceof Error && /429/.test(error.message);
    return {
      ...base,
      status: "unavailable",
      modelsUsed: [],
      metrics: [],
      detail: limited ? "Open-Meteo's free-tier rate limit was reached, so projections were skipped for this run." : "The Open-Meteo Climate API did not respond in time.",
    };
  }
}
