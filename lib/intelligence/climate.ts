import type { ReportModel } from "@/lib/reports/model";
import { HAZARDS, round, roundOrNull, type Hazard } from "./types";

export interface HazardScreen {
  hazard: Hazard;
  status: "available" | "partial" | "not_available";
  score: number | null;
  summary: string;
  thresholdOrigin: string | null;
  limitations: string[];
}

export interface ForecastPoint {
  date: string;
  tmaxC: number | null;
  precipMm: number | null;
  gustMps: number | null;
  wetBulbC: number | null;
}

export interface ProjectionChange {
  key: string;
  label: string;
  unit: string;
  baseline: number;
  change: number;
  min: number;
  max: number;
  agreement: string;
}

export interface ClimateSummary {
  screens: HazardScreen[];
  forecast: ForecastPoint[];
  forecastWindow: { from: string | null; to: string | null };
  forecastStats: {
    maxTmaxC: number | null;
    hotDays35: number;
    daysAboveUserThreshold: number | null;
    userThresholdC: number | null;
    maxDailyRainMm: number | null;
    total7DayRainMm: number | null;
    maxGustMps: number | null;
    maxWetBulbC: number | null;
  };
  alerts: { status: string; active: number; matched: Array<{ event: string; severity: string | null; expires: string | null }>; detail: string };
  floodExposure: { status: string; shareAtLeastModerate: number | null; pinClass: string | null; bufferMeters: number | null; detail: string };
  river: { status: string; detail: string; peakForecastM3s: number | null; annualMaxMedianM3s: number | null; annualMax90thM3s: number | null };
  projections: { status: string; baseline: string | null; future: string | null; models: string[]; changes: ProjectionChange[]; detail: string };
  satellite: { status: string; ndviMean: number | null; acquired: string | null; cloudPct: number | null; detail: string };
  climatology: string | null;
}

const max = (items: Array<number | null>): number | null => {
  const known = items.filter((value): value is number => value !== null && Number.isFinite(value));
  return known.length ? Math.max(...known) : null;
};

/** Engine C: the climate evidence for one site, in one shape, without re-weighting anything. */
export function summarizeClimate(model: ReportModel, userHeatThresholdC: number | null): ClimateSummary {
  const { result } = model;
  const context = result.context;
  const forecast = model.forecast.map((day) => ({
    date: day.date,
    tmaxC: day.temperatureMaxC,
    precipMm: day.precipitationMm,
    gustMps: day.windGustMps,
    wetBulbC: day.wetBulbMaxC,
  }));
  const screens: HazardScreen[] = HAZARDS.map((hazard) => {
    const indicator = result.hazards.indicators.find((item) => item.hazard === hazard);
    return indicator
      ? { hazard, status: indicator.status, score: indicator.score, summary: indicator.summary, thresholdOrigin: indicator.thresholdOrigin, limitations: indicator.limitations }
      : { hazard, status: "not_available", score: null, summary: "No indicator was produced for this hazard.", thresholdOrigin: null, limitations: [] };
  });
  const rain = forecast.map((day) => day.precipMm);
  const firstWeek = rain.slice(0, 7).filter((value): value is number => value !== null);

  const flood = context.floodExposure;
  const river = context.river;
  const projections = context.projections;
  const alerts = context.alerts;
  const satellite = result.satellite;
  const riverPeak = river ? max(river.forecast.map((day) => day.dischargeM3s)) : null;

  return {
    screens,
    forecast,
    forecastWindow: { from: forecast[0]?.date ?? null, to: forecast.at(-1)?.date ?? null },
    forecastStats: {
      maxTmaxC: roundOrNull(max(forecast.map((day) => day.tmaxC)), 1),
      hotDays35: forecast.filter((day) => (day.tmaxC ?? -Infinity) >= 35).length,
      daysAboveUserThreshold: userHeatThresholdC === null ? null : forecast.filter((day) => (day.tmaxC ?? -Infinity) >= userHeatThresholdC).length,
      userThresholdC: userHeatThresholdC,
      maxDailyRainMm: roundOrNull(max(rain), 1),
      total7DayRainMm: firstWeek.length ? round(firstWeek.reduce((sum, value) => sum + value, 0), 1) : null,
      maxGustMps: roundOrNull(max(forecast.map((day) => day.gustMps)), 1),
      maxWetBulbC: roundOrNull(max(forecast.map((day) => day.wetBulbC)), 1),
    },
    alerts: {
      status: alerts?.status ?? "not_retrieved",
      active: alerts?.matched.length ?? 0,
      matched: (alerts?.matched ?? []).map((warning) => ({ event: warning.event, severity: warning.severity || null, expires: warning.validTo })),
      detail: alerts?.detail ?? "Official alerts were not retrieved.",
    },
    floodExposure: {
      status: flood?.status ?? "not_retrieved",
      shareAtLeastModerate: flood?.summary?.shareAtLeastModerate ?? null,
      pinClass: flood?.summary?.pinClass ?? null,
      bufferMeters: flood?.bufferMeters ?? null,
      detail: flood?.detail ?? "Flood exposure was not retrieved.",
    },
    river: {
      status: river?.status ?? "not_retrieved",
      detail: river?.detail ?? "River discharge was not retrieved.",
      peakForecastM3s: roundOrNull(riverPeak, 1),
      annualMaxMedianM3s: roundOrNull(river?.statistics?.annualMaxMedianM3s ?? null, 1),
      annualMax90thM3s: roundOrNull(river?.statistics?.annualMax90thM3s ?? null, 1),
    },
    projections: {
      status: projections?.status ?? "not_retrieved",
      baseline: projections?.baseline ?? null,
      future: projections?.future ?? null,
      models: projections?.modelsUsed ?? [],
      changes: (projections?.metrics ?? []).map((item) => ({
        key: item.key,
        label: item.label,
        unit: item.unit,
        baseline: item.baselineMedian,
        change: item.changeMedian,
        min: item.changeMin,
        max: item.changeMax,
        agreement: `${item.modelsAgreeOnSign} of ${item.models} models agree on the direction`,
      })),
      detail: projections?.detail ?? "Climate projections were not retrieved.",
    },
    satellite: {
      status: satellite?.status ?? "not_available",
      ndviMean: roundOrNull(satellite?.latest?.ndvi.mean ?? null, 2),
      acquired: satellite?.catalog?.acquisitionTime ?? null,
      cloudPct: roundOrNull(satellite?.catalog?.cloudCoverPct ?? null, 0),
      detail: satellite?.reason ?? (satellite?.status === "available" ? "Sentinel-2 scene available." : "Satellite indicator not available."),
    },
    climatology: model.climatologyLabel,
  };
}
