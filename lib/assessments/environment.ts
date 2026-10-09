import { ndviPathway, searchSentinel2L2a, type NdviPathway } from "@/lib/integrations/copernicus/stac";
import { fetchArchive, fetchForecast, rainfallBaseline } from "@/lib/integrations/open-meteo/client";
import { fetchRiverContext } from "@/lib/integrations/open-meteo/river";
import { fetchProjections } from "@/lib/integrations/open-meteo/climate";
import { observeSentinel2 } from "@/lib/integrations/planetary-computer/sentinel2";
import { sampleFloodExposure } from "@/lib/integrations/world-bank-flood/sampler";
import { officialAlertsAt } from "@/lib/integrations/official-alerts/sachet";
import { localClimatology, type ClimatologyStore } from "@/lib/climatology/service";
import { ProviderError } from "@/lib/ingestion/http";
import { logError } from "@/lib/observability/logger";
import type { EnvironmentInputs } from "@/lib/questionnaire/mapping";
import type { SiteContext } from "@/lib/assessments/context";

export interface GatheredEnvironment extends EnvironmentInputs {
  context: SiteContext;
  notes: string[];
}

async function settle<T>(task: Promise<T>, notes: string[], label: string): Promise<T | null> {
  try {
    return await task;
  } catch (error) {
    notes.push(error instanceof ProviderError ? `${label}: ${error.message}` : `${label} was not retrieved.`);
    return null;
  }
}

async function satelliteFor(latitude: number, longitude: number, notes: string[]): Promise<NdviPathway> {
  const observed = await observeSentinel2(latitude, longitude);
  if (observed.status === "available") return observed;
  notes.push(observed.reason);
  try {
    const end = new Date();
    const start = new Date(end);
    start.setUTCDate(end.getUTCDate() - 60);
    const hit = await searchSentinel2L2a({ latitude, longitude, start: start.toISOString(), end: end.toISOString() });
    return { ...ndviPathway(hit), reason: `${observed.reason} ${ndviPathway(hit).reason}` };
  } catch {
    return observed;
  }
}

/** Retrieves forecast, climatology, satellite indicators and regional context for one point, in parallel. */
export async function gatherEnvironment(latitude: number, longitude: number, store?: ClimatologyStore): Promise<GatheredEnvironment> {
  const notes: string[] = [];
  const [forecast, climatology, satellite, floodExposure, river, alerts] = await Promise.all([
    settle(fetchForecast({ latitude, longitude, days: 7 }), notes, "Forecast"),
    localClimatology({ latitude, longitude, store }).catch((error: unknown) => {
      logError("climatology fit failed", { message: error instanceof Error ? error.message : "unknown" });
      notes.push(error instanceof ProviderError ? `Climatology: ${error.message}` : "The 1991–2020 climatology could not be fitted; fixed thresholds were used.");
      return null;
    }),
    satelliteFor(latitude, longitude, notes),
    settle(sampleFloodExposure(latitude, longitude), notes, "Flood exposure"),
    settle(fetchRiverContext(latitude, longitude), notes, "River discharge"),
    settle(officialAlertsAt(latitude, longitude), notes, "Official alerts"),
  ]);
  let historical: EnvironmentInputs["historical"] = null;
  if (!climatology) {
    try {
      const end = new Date();
      const start = new Date(end);
      start.setUTCFullYear(end.getUTCFullYear() - 6);
      const archive = await fetchArchive({ latitude, longitude, startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) });
      historical = rainfallBaseline(archive.days);
    } catch (error) {
      notes.push(error instanceof ProviderError ? `Historical weather: ${error.message}` : "Historical weather was not retrieved.");
    }
  }
  const projections = await settle(fetchProjections(latitude, longitude), notes, "Climate projections");
  return {
    forecastDays: forecast?.days ?? null,
    forecastRetrievedAt: forecast ? new Date().toISOString() : null,
    historical,
    climatology,
    satellite,
    context: { floodExposure, river, projections, alerts },
    notes,
  };
}
