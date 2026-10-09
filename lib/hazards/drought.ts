import type { CurrentSpi } from "@/lib/climatology/model";
import type { DailyWeather, HazardIndicator } from "@/lib/hazards/types";

export const DROUGHT_BASELINE_YEARS = 5;
export const DROUGHT_PERCENT_OF_NORMAL = 50;

/** WMO SPI categories (WMO-No. 1090): −1.0 moderately dry, −1.5 severely dry, −2.0 extremely dry. */
export const SPI_BANDS = [
  { max: -2, label: "extremely dry", score: 85 },
  { max: -1.5, label: "severely dry", score: 70 },
  { max: -1, label: "moderately dry", score: 45 },
  { max: Number.POSITIVE_INFINITY, label: "near normal or wetter", score: 15 },
] as const;

export function spiBand(value: number) {
  return SPI_BANDS.find((band) => value <= band.max)!;
}

export interface SpiEvidence {
  spi30: CurrentSpi;
  spi90: CurrentSpi;
  label: string;
}

function assessSpi(spi: SpiEvidence, waterStress: WaterStressContext | null): HazardIndicator | null {
  const values = [spi.spi30, spi.spi90].filter((entry) => entry.value !== null);
  if (values.length === 0) return null;
  const worst = values.reduce((a, b) => ((a.value ?? 0) <= (b.value ?? 0) ? a : b));
  const band = spiBand(worst.value!);
  const describe = (entry: CurrentSpi) =>
    entry.value === null
      ? `SPI-${entry.window} unavailable (${entry.reason ?? "no data"})`
      : `SPI-${entry.window} ${entry.value} (${entry.totalMm} mm versus a ${entry.normalMm} mm month-end normal)`;
  return {
    hazard: "drought",
    key: "spi",
    status: values.length === 2 ? "available" : "partial",
    score: band.score,
    summary: `${describe(spi.spi30)}; ${describe(spi.spi90)}, to ${worst.endDate}. The drier window is ${band.label} on the WMO scale.${
      waterStress ? ` Separate water-stress context: ${waterStress.label} (${waterStress.geography}, ${waterStress.source}).` : ""
    }`,
    evidenceKind: "reanalysis",
    source: "ERA5 reanalysis precipitation, gamma-fitted SPI",
    unit: "SPI (standard deviations)",
    raw: {
      spi30: spi.spi30.value,
      spi90: spi.spi90.value,
      spi30TotalMm: spi.spi30.totalMm,
      spi90TotalMm: spi.spi90.totalMm,
      spiEndDate: worst.endDate,
      waterStressUsedInScore: 0,
    },
    limitations: [
      "SPI is meteorological dryness. It is not soil moisture, crop stress, or a utility outage.",
      "The gamma fit uses month-end windows from 1991–2020. A window ending mid-month uses that month's fit.",
      "ERA5 precipitation is a ~25 km reanalysis estimate and lags real time by about five days.",
      "Regional water-stress context is not evidence that this business has lost supply.",
    ],
    thresholdOrigin: `Standardized Precipitation Index (WMO-No. 1090) from a two-parameter gamma fit with a zero point mass, per calendar month, ${spi.label}. Bands: ≤ −1 moderately dry, ≤ −1.5 severely dry, ≤ −2 extremely dry. The drier of SPI-30 and SPI-90 sets the score.`,
  };
}

export interface WaterStressContext {
  label: string;
  source: string;
  geography: string;
}

export interface ForecastWaterBalance {
  days: number;
  precipitationMm: number;
  et0Mm: number;
  balanceMm: number;
  /** Latest daily mean volumetric soil moisture, 27–81 cm (m³/m³). */
  rootZoneSoilMoisture: number | null;
}

/** Forecast rain minus FAO-56 reference evapotranspiration over days with both values. */
export function forecastWaterBalance(days: DailyWeather[]): ForecastWaterBalance | null {
  const paired = days.filter((day) => day.precipitationMm !== null && day.et0Mm !== null);
  const soil = days.map((day) => day.rootZoneSoilMoisture).filter((value): value is number => value !== null);
  if (paired.length === 0 && soil.length === 0) return null;
  const round = (value: number) => Math.round(value * 10) / 10;
  const precipitationMm = round(paired.reduce((sum, day) => sum + (day.precipitationMm ?? 0), 0));
  const et0Mm = round(paired.reduce((sum, day) => sum + (day.et0Mm ?? 0), 0));
  return {
    days: paired.length,
    precipitationMm,
    et0Mm,
    balanceMm: round(precipitationMm - et0Mm),
    rootZoneSoilMoisture: soil.length ? soil[soil.length - 1] : null,
  };
}

function withWaterBalance(indicator: HazardIndicator, balance: ForecastWaterBalance | null): HazardIndicator {
  if (!balance) return indicator;
  const parts = [
    ...(balance.days > 0
      ? [`over the next ${balance.days} forecast day(s), rain ${balance.precipitationMm} mm against reference evapotranspiration ${balance.et0Mm} mm (balance ${balance.balanceMm} mm)`]
      : []),
    ...(balance.rootZoneSoilMoisture !== null ? [`modelled root-zone soil moisture ${balance.rootZoneSoilMoisture} m³/m³`] : []),
  ];
  return {
    ...indicator,
    summary: `${indicator.summary} Forecast water-balance context: ${parts.join("; ")}.`,
    raw: {
      ...indicator.raw,
      forecastBalanceDays: balance.days,
      forecastPrecipitationMm: balance.precipitationMm,
      forecastEt0Mm: balance.et0Mm,
      forecastBalanceMm: balance.balanceMm,
      rootZoneSoilMoisture: balance.rootZoneSoilMoisture,
      waterBalanceUsedInScore: 0,
    },
    limitations: [
      ...indicator.limitations,
      "Forecast water balance and soil moisture are context only. Reference evapotranspiration is for a grass surface, and volumetric soil moisture depends on soil type, so neither is scored without a local baseline.",
    ],
  };
}

export function assessDrought(input: {
  recent30DayMm: number | null;
  baselineMean30DayMm: number | null;
  baselineYears: number;
  recentDryDays: number | null;
  waterStress: WaterStressContext | null;
  spi?: SpiEvidence | null;
  forecastBalance?: ForecastWaterBalance | null;
}): HazardIndicator {
  return withWaterBalance(assessDroughtCore(input), input.forecastBalance ?? null);
}

function assessDroughtCore(input: Parameters<typeof assessDrought>[0]): HazardIndicator {
  if (input.spi) {
    const fromSpi = assessSpi(input.spi, input.waterStress);
    if (fromSpi) return fromSpi;
  }
  const limitations = [
    "A few dry days are not drought.",
    "Meteorological rainfall anomaly is not agricultural drought, soil moisture, or a utility outage.",
    "Regional water-stress context is not evidence that this business has lost supply.",
  ];
  const enoughBaseline =
    input.baselineYears >= DROUGHT_BASELINE_YEARS &&
    input.baselineMean30DayMm !== null &&
    input.baselineMean30DayMm > 0 &&
    input.recent30DayMm !== null;
  if (!enoughBaseline) {
    return {
      hazard: "drought",
      key: "rainfall_percent_of_normal",
      status: "not_available",
      score: null,
      summary: `Drought context is not scored. Baseline years: ${input.baselineYears}. A 30-day rainfall total and a baseline of at least ${DROUGHT_BASELINE_YEARS} comparable seasons are required.${
        input.recentDryDays !== null ? ` Recent dry days (${input.recentDryDays}) are recorded and not interpreted as drought.` : ""
      }`,
      evidenceKind: "missing",
      source: "historical rainfall baseline",
      limitations,
      thresholdOrigin: `Percent of normal below ${DROUGHT_PERCENT_OF_NORMAL}% over 30 days, only after ${DROUGHT_BASELINE_YEARS} baseline years. CLIMETRYX v1 assumption, not an SPI/SPEI implementation.`,
      raw: {
        recent30DayMm: input.recent30DayMm,
        baselineMean30DayMm: input.baselineMean30DayMm,
        baselineYears: input.baselineYears,
        recentDryDays: input.recentDryDays,
        waterStress: input.waterStress?.label ?? null,
      },
    };
  }
  const percent = (input.recent30DayMm! / input.baselineMean30DayMm!) * 100;
  let score = 15;
  if (percent < 75) score = 45;
  if (percent < DROUGHT_PERCENT_OF_NORMAL) score = 75;
  return {
    hazard: "drought",
    key: "rainfall_percent_of_normal",
    status: "available",
    score,
    summary: `Recent 30-day rainfall is ${Math.round(percent)}% of the ${input.baselineYears}-year baseline mean (${input.recent30DayMm} mm versus ${input.baselineMean30DayMm} mm).${
      input.waterStress ? ` Separate water-stress context: ${input.waterStress.label} (${input.waterStress.geography}, ${input.waterStress.source}).` : ""
    }`,
    evidenceKind: "reanalysis",
    source: "historical rainfall baseline",
    unit: "percent of normal",
    raw: {
      percentOfNormal: Math.round(percent * 10) / 10,
      recent30DayMm: input.recent30DayMm,
      baselineMean30DayMm: input.baselineMean30DayMm,
      baselineYears: input.baselineYears,
      waterStressUsedInScore: 0,
    },
    limitations: [
      ...limitations,
      "Water-stress labels are not added into this meteorological score.",
      "This is not the Standardized Precipitation Index. SPI/SPEI need a documented distribution fit and are not calculated here.",
    ],
    thresholdOrigin: `CLIMETRYX v1: below ${DROUGHT_PERCENT_OF_NORMAL}% of a same-window baseline with at least ${DROUGHT_BASELINE_YEARS} years is elevated meteorological dryness context.`,
  };
}
