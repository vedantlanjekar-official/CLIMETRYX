import type { HazardIndicator } from "@/lib/hazards/types";

export function combineHazards(indicators: HazardIndicator[]): {
  score: number | null;
  notes: string[];
  indicators: HazardIndicator[];
} {
  const available = indicators.filter((indicator) => indicator.score !== null);
  if (available.length === 0) {
    return {
      score: null,
      notes: [
        "No flood, heat, drought, or storm indicator had a value. Hazard context is excluded instead of being set to zero.",
      ],
      indicators,
    };
  }
  const score =
    Math.round((available.reduce((sum, indicator) => sum + (indicator.score ?? 0), 0) / available.length) * 10) /
    10;
  return {
    score,
    notes: [
      `Hazard context is the unweighted mean of ${available.length} available hazard indicator(s). Missing hazards are omitted, not zeroed. Correlated rainfall and flood signals can still overlap; both remain visible.`,
      ...indicators.map((indicator) => `${indicator.hazard}: ${indicator.summary}`),
    ],
    indicators,
  };
}
