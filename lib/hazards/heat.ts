import type { ClimatologyModel } from "@/lib/climatology/model";
import type { DailyWeather, HazardIndicator, HeatProfile, LocalThresholds } from "@/lib/hazards/types";

/** Screening thresholds for daily maximum air temperature. Not WBGT or an occupational limit. */
export const HEAT_THRESHOLDS_C: Record<HeatProfile, number> = {
  outdoor_labor: 35,
  food_cold_chain: 32,
  general: 38,
};

/**
 * Critical environmental wet-bulb limit of about 31 °C for young, healthy adults at low workload
 * (Vecellio et al., 2022, J. Appl. Physiol.), well below the 35 °C theoretical limit. Heavier work lowers it.
 */
export const WET_BULB_SCREENING_C = 31;

export function heatProfileForIndustry(industry: string): HeatProfile {
  const value = industry.toLowerCase();
  if (/(farm|agric|construct|transport|logistic|outdoor)/.test(value)) return "outdoor_labor";
  if (/(food|bakery|retail|cold|restaurant|grocery)/.test(value)) return "food_cold_chain";
  return "general";
}

export function assessHeat(
  days: DailyWeather[],
  profile: HeatProfile,
  local: LocalThresholds<ClimatologyModel["heat"]> | null = null,
): HazardIndicator {
  const threshold = HEAT_THRESHOLDS_C[profile];
  const observed = days.filter((day) => day.temperatureMaxC !== null);
  const p95 = local?.values.tmaxP95C ?? null;
  const p99 = local?.values.tmaxP99C ?? null;
  const localOrigin = local && p95 !== null ? ` Local anomaly thresholds: P95 ${p95}°C and P99 ${p99}°C daily maximum, ${local.label}.` : "";
  if (observed.length === 0) {
    return {
      hazard: "heat",
      key: "hot_day_share",
      status: "not_available",
      score: null,
      summary: "No daily maximum temperature was available, so heat is not scored.",
      evidenceKind: "missing",
      source: "none",
      limitations: [
        "Missing temperature is not treated as a normal or low-heat day.",
        "Air temperature alone is not worker heat stress. Humidity, radiant heat, clothing, and workload were not combined into a heat-stress index.",
      ],
      thresholdOrigin: `CLIMETRYX screening threshold ${threshold}°C for profile ${profile}. Assumption, not a regulatory limit.${localOrigin}`,
    };
  }
  const hotDays = observed.filter((day) => (day.temperatureMaxC ?? 0) >= threshold).length;
  const absoluteScore = (hotDays / observed.length) * 100;
  const aboveP95 = p95 === null ? 0 : observed.filter((day) => (day.temperatureMaxC ?? 0) > p95).length;
  const aboveP99 = p99 === null ? 0 : observed.filter((day) => (day.temperatureMaxC ?? 0) > p99).length;
  const localScore = p95 === null ? null : Math.min(100, ((aboveP95 + aboveP99) / observed.length) * 100);
  const wetBulb = days.map((day) => day.wetBulbMaxC).filter((value): value is number => value !== null);
  const wetBulbHotDays = wetBulb.filter((value) => value >= WET_BULB_SCREENING_C).length;
  const wetBulbScore = wetBulb.length === 0 ? null : (wetBulbHotDays / wetBulb.length) * 100;
  const wetBulbMax = wetBulb.length === 0 ? null : Math.max(...wetBulb);
  const score = Math.round(Math.max(absoluteScore, localScore ?? 0, wetBulbScore ?? 0) * 10) / 10;
  const humidityDays = days.filter((day) => day.humidityMeanPct !== null).length;
  const max = Math.max(...observed.map((day) => day.temperatureMaxC ?? Number.NEGATIVE_INFINITY));
  const partial = observed.length < days.length;
  const localSummary =
    p95 === null
      ? ""
      : ` ${aboveP95} day(s) exceed this location's 1991–2020 P95 (${p95}°C) and ${aboveP99} exceed its P99 (${p99}°C).`;
  const wetBulbSummary =
    wetBulbMax === null
      ? ""
      : ` Highest forecast wet-bulb temperature is ${wetBulbMax}°C; ${wetBulbHotDays} day(s) reach the ${WET_BULB_SCREENING_C}°C wet-bulb screen.`;
  return {
    hazard: "heat",
    key: "hot_day_share",
    status: partial ? "partial" : "available",
    score,
    summary: `${hotDays} of ${observed.length} forecast days reach the ${threshold}°C daily-maximum screening threshold.${localSummary} Highest supplied daily maximum is ${max}°C.${wetBulbSummary}`,
    evidenceKind: "forecast",
    source: `forecast daily maximum temperature${p95 === null ? "" : " against fixed and location-fitted thresholds"}${wetBulbMax === null ? "" : ", plus forecast wet-bulb temperature"}`,
    unit: "percent of days",
    raw: {
      hotDays,
      observedDays: observed.length,
      thresholdC: threshold,
      maxC: max,
      humidityDays,
      localP95C: p95,
      localP99C: p99,
      daysAboveLocalP95: p95 === null ? null : aboveP95,
      daysAboveLocalP99: p99 === null ? null : aboveP99,
      wetBulbDays: wetBulb.length,
      wetBulbMaxC: wetBulbMax,
      wetBulbScreeningC: WET_BULB_SCREENING_C,
      daysAtWetBulbScreen: wetBulb.length === 0 ? null : wetBulbHotDays,
    },
    limitations: [
      "This is a forecast screening count, not a statement that those temperatures will occur.",
      wetBulbMax !== null
        ? "Wet-bulb temperature is a shade value. It is not WBGT: sun, radiant heat from equipment, clothing, and workload are not included, so outdoor or heavy work can be unsafe below the screen."
        : humidityDays === 0
          ? "Humidity was not available, so this is not a physiological heat-stress assessment."
          : "Wet-bulb temperature was not supplied, so humidity is not part of this score.",
      `Threshold origin: methodology assumption for ${profile}, ${threshold}°C daily maximum air temperature.`,
      ...(p95 === null
        ? ["No location-fitted climatology was available, so only the fixed threshold was applied."]
        : ["Local percentiles describe what is unusual for this grid cell. ERA5 is a ~25 km reanalysis grid and can differ from the premises, and forecast and reanalysis models have different biases."]),
    ],
    thresholdOrigin: `Score is the largest of the fixed-threshold share (${threshold}°C for ${profile}), the local-anomaly share (days above P95, with days above P99 counted twice), and the share of days with wet-bulb maximum at or above ${WET_BULB_SCREENING_C}°C (Vecellio et al., 2022 critical limit for young adults at low workload).${localOrigin}`,
  };
}
