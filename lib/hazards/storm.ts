import type { ClimatologyModel } from "@/lib/climatology/model";
import type { DailyWeather, HazardIndicator, LocalThresholds } from "@/lib/hazards/types";

export const GUST_SCREENING_MPS = 20;
/** CAPE at or above 2500 J/kg is commonly read by forecasters as strong instability. It is not a storm forecast. */
export const CAPE_SCREENING_JKG = 2500;
export const CAPE_CONTEXT_SCORE = 40;

export function assessStorm(
  days: DailyWeather[],
  officialStormWarning: boolean,
  local: LocalThresholds<ClimatologyModel["gust"]> | null = null,
): HazardIndicator {
  const localP99 = local?.values.p99Mps ?? null;
  const local10yr = local?.values.annualMax10yrMps ?? null;
  const localOrigin = local ? ` Local thresholds (${local.label}): daily maximum gust P99 ${localP99} m/s, empirical 10-year annual maximum ${local10yr} m/s.` : "";
  const gusts = days.map((day) => day.windGustMps).filter((value): value is number => value !== null);
  if (gusts.length === 0 && !officialStormWarning) {
    return {
      hazard: "storm",
      key: "wind_gust_screening",
      status: "not_available",
      score: null,
      summary: "Wind gusts and official storm warnings are unavailable, so storm evidence is not scored.",
      evidenceKind: "missing",
      source: "none",
      limitations: [
        "A weather forecast is not an official storm warning.",
        "Missing wind data is not calm conditions.",
      ],
      thresholdOrigin: `CLIMETRYX v1 screening gust ${GUST_SCREENING_MPS} m/s. Not a warning threshold from a meteorological service.${localOrigin}`,
    };
  }
  const maxGust = gusts.length ? Math.max(...gusts) : null;
  const capes = days.map((day) => day.capeMaxJkg).filter((value): value is number => value !== null);
  const maxCape = capes.length ? Math.max(...capes) : null;
  const unstable = maxCape !== null && maxCape >= CAPE_SCREENING_JKG;
  let score: number | null = null;
  if (maxGust !== null) {
    const severe = maxGust >= 25 || (local10yr !== null && maxGust >= local10yr);
    const elevated = maxGust >= GUST_SCREENING_MPS || (localP99 !== null && maxGust >= localP99);
    score = severe ? 85 : elevated ? 70 : 15;
    if (unstable) score = Math.max(score, CAPE_CONTEXT_SCORE);
  }
  if (officialStormWarning) score = Math.max(score ?? 0, 85);
  const capeSummary =
    maxCape === null
      ? ""
      : unstable
        ? ` Forecast CAPE reaches ${maxCape} J/kg, strong atmospheric instability that can support thunderstorms and sudden gusts.`
        : ` Forecast CAPE peaks at ${maxCape} J/kg, below the ${CAPE_SCREENING_JKG} J/kg instability screen.`;
  return {
    hazard: "storm",
    key: "wind_gust_screening",
    status: maxGust === null ? "partial" : "available",
    score,
    summary:
      maxGust === null
        ? "An official storm warning is present without a gust value in the forecast payload."
        : `Highest forecast gust in the retrieved horizon is ${Math.round(maxGust * 10) / 10} m/s${
            localP99 !== null ? ` (local P99 ${localP99} m/s)` : ""
          }.${capeSummary}${officialStormWarning ? " An official storm warning was also supplied by a configured source." : " No official storm warning was supplied."}`,
    evidenceKind: officialStormWarning ? "measured" : "forecast",
    source: officialStormWarning ? "configured official warning" : "forecast wind gust",
    unit: "m/s",
    raw: {
      maxGustMps: maxGust,
      localP99Mps: localP99,
      local10yrMps: local10yr,
      maxCapeJkg: maxCape,
      capeScreeningJkg: CAPE_SCREENING_JKG,
      officialStormWarning: officialStormWarning ? 1 : 0,
    },
    limitations: [
      "Below-threshold gusts mean the screening threshold was not crossed in this forecast. They do not mean the site cannot experience a storm.",
      "Forecast wind is a model estimate at the grid scale, not a measurement on the premises.",
      "CAPE measures instability, not whether a storm forms. Thunderstorms also need a trigger, and lightning is not forecast for this region by the configured source.",
      ...(local ? ["ERA5 reanalysis tends to smooth peak gusts, so local gust percentiles can be lower than station records."] : []),
    ],
    thresholdOrigin: `Elevated at ${GUST_SCREENING_MPS} m/s or the local P99; severe at 25 m/s or the local 10-year level. Forecast CAPE at or above ${CAPE_SCREENING_JKG} J/kg raises a quiet-wind score to ${CAPE_CONTEXT_SCORE} (CLIMETRYX assumption based on a common forecasting rule of thumb).${localOrigin}`,
  };
}
