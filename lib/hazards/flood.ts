import type { ClimatologyModel } from "@/lib/climatology/model";
import type { DailyWeather, HazardIndicator, LocalThresholds } from "@/lib/hazards/types";

export const RAIN_24H_SCREENING_MM = 50;
export const RAIN_72H_SCREENING_MM = 100;

export interface OfficialWarningInput {
  event: string;
  severity: string;
  source: string;
  issuedAt: string;
  validFrom: string | null;
  validTo: string | null;
  identifier?: string;
  headline?: string;
  area?: string;
  urgency?: string;
  certainty?: string;
}

export interface PopulationExposureContext {
  source: string;
  summary: string;
  resolution: string;
}

function firstDays(days: DailyWeather[], count: number): Array<number | null> {
  return days.slice(0, count).map((day) => day.precipitationMm);
}

export function assessFlood(input: {
  days: DailyWeather[];
  officialWarnings: OfficialWarningInput[];
  populationExposure: PopulationExposureContext | null;
  local?: LocalThresholds<ClimatologyModel["rain"]> | null;
}): HazardIndicator {
  const local = input.local ?? null;
  const localP99 = local?.values.wetDayP99Mm ?? null;
  const local72 = local?.values.threeDayP99Mm ?? null;
  const local10yr = local?.values.annualMax1Day10yrMm ?? null;
  const localOrigin = local
    ? ` Local thresholds (${local.label}): wet-day P99 ${localP99} mm, 3-day P99 ${local72} mm, empirical 10-year annual-maximum 1-day rainfall ${local10yr} mm.`
    : "";
  const limitations: string[] = [
    "Heavy-rain screening is not an official flood warning and is not a flood depth or probability.",
    "A population-exposure grid counts people in a modelled scenario. It is not the flood depth at a business.",
  ];
  const day1 = firstDays(input.days, 1);
  const day3 = firstDays(input.days, 3);
  const rain24 = day1.length === 1 && day1[0] !== null ? day1[0] : null;
  const rain72 = day3.length === 3 && day3.every((value) => value !== null)
    ? day3.reduce<number>((sum, value) => sum + (value ?? 0), 0)
    : null;
  const heavy24 = rain24 !== null && (rain24 >= RAIN_24H_SCREENING_MM || (localP99 !== null && rain24 >= localP99));
  const heavy72 = rain72 !== null && (rain72 >= RAIN_72H_SCREENING_MM || (local72 !== null && rain72 >= local72));
  const extreme24 = rain24 !== null && local10yr !== null && rain24 >= local10yr;
  const warning = input.officialWarnings[0] ?? null;
  const horizon = input.days.slice(0, 3);
  const maxOf = (values: Array<number | null>) => {
    const present = values.filter((value): value is number => value !== null);
    return present.length ? Math.max(...present) : null;
  };
  const maxProbability = maxOf(horizon.map((day) => day.precipitationProbabilityPct));
  const maxRainHours = maxOf(horizon.map((day) => day.precipitationHours));

  if (rain24 === null && rain72 === null && !warning) {
    return {
      hazard: "flood",
      key: "flood_context",
      status: "not_available",
      score: null,
      summary: input.populationExposure
        ? `Rainfall and official warnings are unavailable. ${input.populationExposure.summary} This context is not used as the business flood score.`
        : "Rainfall and official warnings are unavailable, so business-level flood evidence is not scored.",
      evidenceKind: "missing",
      source: input.populationExposure?.source ?? "none",
      limitations,
      thresholdOrigin: `Screening assumptions: ${RAIN_24H_SCREENING_MM} mm in 24 hours or ${RAIN_72H_SCREENING_MM} mm in 72 hours. Not an official warning threshold.${localOrigin}`,
      raw: { populationExposureUsedInScore: 0 },
    };
  }

  let score = 15;
  if (heavy24 || heavy72) score = 60;
  if (heavy24 && heavy72) score = 75;
  if (extreme24) score = Math.max(score, 80);
  if (warning) score = Math.max(score, 85);
  const parts = [
    rain24 === null ? "24-hour rainfall unavailable" : `next-day rainfall ${rain24} mm`,
    rain72 === null ? "72-hour rainfall unavailable" : `72-hour rainfall ${rain72} mm`,
    ...(local && rain24 !== null && localP99 !== null
      ? [`local wet-day P99 is ${localP99} mm${extreme24 ? `, and next-day rain reaches the local 10-year level (${local10yr} mm)` : ""}`]
      : []),
    ...(maxProbability !== null ? [`highest 3-day rain probability ${maxProbability}%`] : []),
    ...(maxRainHours !== null ? [`longest forecast rain spell ${maxRainHours} h in a day`] : []),
    warning
      ? `official warning from ${warning.source}: ${warning.event} (${warning.severity})`
      : "no configured official warning",
  ];
  return {
    hazard: "flood",
    key: "flood_context",
    status: rain24 === null || rain72 === null ? "partial" : "available",
    score,
    summary: `${parts.join("; ")}.`,
    evidenceKind: warning ? "measured" : "forecast",
    source: warning ? warning.source : "forecast precipitation",
    unit: "mm",
    raw: {
      rain24hMm: rain24,
      rain72hMm: rain72,
      localWetDayP99Mm: localP99,
      localThreeDayP99Mm: local72,
      local10yrOneDayMm: local10yr,
      maxRainProbabilityPct: maxProbability,
      maxRainHours,
      officialWarning: warning ? 1 : 0,
      populationExposureUsedInScore: 0,
    },
    limitations: [
      ...limitations,
      "Rain probability and rain hours are shown as context and do not change the score.",
      input.populationExposure
        ? `Separate context only: ${input.populationExposure.summary} Resolution: ${input.populationExposure.resolution}.`
        : "No population-exposure extract is loaded for this location.",
      ...(local
        ? ["Local rainfall percentiles come from a ~25 km reanalysis grid. They say what is unusual for the area, not how the site drains. The 10-year level is empirical from 30 annual maxima, not a fitted extreme-value model."]
        : ["No location-fitted climatology was available, so only fixed rainfall thresholds were applied."]),
    ],
    thresholdOrigin: `Heavy rain is flagged when the fixed screen (${RAIN_24H_SCREENING_MM} mm / 24 h, ${RAIN_72H_SCREENING_MM} mm / 72 h) or the local screen is reached. Official warnings, when present, come from a configured authority feed and are kept separate from the rainfall signal.${localOrigin}`,
  };
}
