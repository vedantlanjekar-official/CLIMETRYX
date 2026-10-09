import type { AssessmentRequest, AssessmentResult } from "@/lib/assessments/pipeline";
import { buildEvidencePack } from "@/lib/ai/evidence";
import { writeNarrative } from "@/lib/ai/narrative";
import type { Narrative } from "@/lib/ai/narrative-schema";
import type { Provenance } from "@/lib/integrations/types";

export interface ReportSource {
  name: string;
  attribution: string;
  licence: string;
  retrievedAt: string | null;
  validFrom: string | null;
  validTo: string | null;
  resolution: string;
}

export interface ForecastDay {
  date: string;
  temperatureMaxC: number | null;
  precipitationMm: number | null;
  windGustMps: number | null;
  wetBulbMaxC: number | null;
}

/** Everything the detailed report view needs, self-contained so a saved report renders without re-fetching. */
export interface ReportModel {
  version: 1;
  generatedAt: string;
  businessName: string;
  industry: string;
  site: AssessmentRequest["location"];
  result: Pick<AssessmentResult, "methodologyVersion" | "status" | "blockedReason" | "score" | "change" | "hazards" | "financials" | "scenarios" | "recommendations" | "satellite" | "context" | "limitations">;
  forecast: ForecastDay[];
  climatologyLabel: string | null;
  narrative: Narrative;
  sources: ReportSource[];
}

function source(name: string, provenance: Provenance | null | undefined, status?: string): ReportSource | null {
  if (!provenance) return null;
  const failed = status === "unavailable";
  return {
    name: failed ? `${name} (not retrieved)` : name,
    attribution: provenance.attribution,
    licence: provenance.licence,
    retrievedAt: failed ? null : provenance.retrievedAt,
    validFrom: provenance.validFrom,
    validTo: provenance.validTo,
    resolution: provenance.spatialResolution,
  };
}

export function reportSources(request: AssessmentRequest, result: AssessmentResult): ReportSource[] {
  const { floodExposure, river, projections, alerts } = result.context;
  const climate = request.climatology;
  return [
    request.forecastDays
      ? {
          name: "Weather forecast",
          attribution: "Open-Meteo forecast API (national weather service models)",
          licence: process.env.OPEN_METEO_MODE === "commercial" ? "Open-Meteo commercial plan" : "Open-Meteo free tier, non-commercial use only; data CC BY 4.0",
          retrievedAt: request.forecastRetrievedAt,
          validFrom: request.forecastDays[0]?.date ?? null,
          validTo: request.forecastDays.at(-1)?.date ?? null,
          resolution: "About 1 to 11 km depending on the model",
        }
      : null,
    climate
      ? {
          name: "Local 1991–2020 climatology",
          attribution: `ERA5 reanalysis via Open-Meteo, grid ${climate.model.source.gridLatitude}, ${climate.model.source.gridLongitude}`,
          licence: "Copernicus Climate Change Service (ERA5); Open-Meteo CC BY 4.0",
          retrievedAt: climate.model.fittedAt ?? null,
          validFrom: climate.model.baseline.start,
          validTo: climate.model.baseline.end,
          resolution: "About 25 km",
        }
      : null,
    source("Official alerts", alerts?.provenance, alerts?.status),
    source("Flood exposure", floodExposure?.provenance, floodExposure?.status),
    source("River discharge", river?.provenance, river?.status),
    source("Climate projections", projections?.provenance, projections?.status),
    result.satellite?.status === "available" ? source("Satellite indices", result.satellite.catalog?.provenance) : null,
    {
      name: "Satellite basemap",
      attribution: "Sentinel-2 cloudless 2023 (s2maps.eu) by EOX IT Services GmbH, contains modified Copernicus Sentinel data 2023",
      licence: "CC BY-NC-SA 4.0, non-commercial use only",
      retrievedAt: null,
      validFrom: "2023-01-01",
      validTo: "2023-12-31",
      resolution: "10 m",
    },
    {
      name: "Street basemap",
      attribution: "OpenFreeMap, © OpenStreetMap contributors",
      licence: "OpenStreetMap data ODbL; OpenFreeMap styles and tiles free to use",
      retrievedAt: null,
      validFrom: null,
      validTo: null,
      resolution: "Vector tiles",
    },
  ].filter((entry): entry is ReportSource => entry !== null);
}

export async function buildReportModel(request: AssessmentRequest, result: AssessmentResult, now = new Date()): Promise<ReportModel> {
  const narrative = await writeNarrative(buildEvidencePack(request, result, now), result);
  const climate = request.climatology;
  return {
    version: 1,
    generatedAt: now.toISOString(),
    businessName: request.businessName,
    industry: request.industry,
    site: request.location,
    result: {
      methodologyVersion: result.methodologyVersion,
      status: result.status,
      blockedReason: result.blockedReason,
      score: result.score,
      change: result.change,
      hazards: result.hazards,
      financials: result.financials,
      scenarios: result.scenarios,
      recommendations: result.recommendations,
      satellite: result.satellite,
      context: result.context,
      limitations: result.limitations,
    },
    forecast: (request.forecastDays ?? []).map((day) => ({
      date: day.date,
      temperatureMaxC: day.temperatureMaxC,
      precipitationMm: day.precipitationMm,
      windGustMps: day.windGustMps,
      wetBulbMaxC: day.wetBulbMaxC,
    })),
    climatologyLabel: climate
      ? `ERA5 ${climate.model.baseline.start.slice(0, 4)}–${climate.model.baseline.end.slice(0, 4)}, grid ${climate.model.source.gridLatitude}, ${climate.model.source.gridLongitude}`
      : null,
    narrative,
    sources: reportSources(request, result),
  };
}
