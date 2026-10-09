import type { EvidenceKind, IndicatorStatus } from "@/lib/scoring/types";

export interface HazardIndicator {
  hazard: "flood" | "heat" | "drought" | "storm";
  key: string;
  status: IndicatorStatus;
  /** Vulnerability-oriented 0–100 score. Null when the indicator is not available. */
  score: number | null;
  summary: string;
  evidenceKind: EvidenceKind;
  source: string;
  unit?: string;
  raw?: Record<string, number | string | null>;
  limitations: string[];
  thresholdOrigin: string;
}

export interface DailyWeather {
  date: string;
  temperatureMaxC: number | null;
  temperatureMinC: number | null;
  precipitationMm: number | null;
  precipitationProbabilityPct: number | null;
  windGustMps: number | null;
  windSpeedMps: number | null;
  humidityMeanPct: number | null;
  apparentTemperatureMaxC: number | null;
  /** Daily maximum psychrometric wet-bulb temperature at 2 m (shade). Not WBGT. */
  wetBulbMaxC: number | null;
  /** FAO-56 reference evapotranspiration for a grass surface. */
  et0Mm: number | null;
  precipitationHours: number | null;
  /** Daily maximum convective available potential energy. */
  capeMaxJkg: number | null;
  /** Daily mean volumetric soil moisture, 27–81 cm layer (m³/m³). */
  rootZoneSoilMoisture: number | null;
}

export type HeatProfile = "outdoor_labor" | "food_cold_chain" | "general";

/** Location-fitted thresholds from a climatology model, with a short provenance label. */
export interface LocalThresholds<T> {
  values: T;
  label: string;
}
