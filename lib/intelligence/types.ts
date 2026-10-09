export const ENGINE_VERSION = "fin05-intelligence-1.0.0";

/** Where a number comes from. Reports show it next to every metric so estimates are never read as observations. */
export type ValueKind = "observed" | "forecast" | "reported" | "derived" | "hypothetical" | "projection" | "assumption";

export interface Metric {
  id: string;
  label: string;
  value: number | null;
  unit: string;
  kind: ValueKind;
  source: string;
  formula?: string;
  note?: string;
}

export interface DataGap {
  area: string;
  missing: string;
  effect: string;
}

export type Level = "high" | "medium" | "low" | "unknown";

export const round = (value: number, digits = 0): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

export const roundOrNull = (value: number | null | undefined, digits = 0): number | null =>
  value === null || value === undefined || !Number.isFinite(value) ? null : round(value, digits);

export function metric(input: Metric): Metric {
  return { ...input, value: roundOrNull(input.value, Math.abs(input.value ?? 0) < 10 ? 2 : 0) };
}

export const HAZARDS = ["flood", "heat", "drought", "storm"] as const;
export type Hazard = (typeof HAZARDS)[number];
export const HAZARD_LABEL: Record<Hazard, string> = {
  flood: "Flood and heavy rain",
  heat: "Extreme heat",
  drought: "Drought and water stress",
  storm: "Storm and wind",
};
