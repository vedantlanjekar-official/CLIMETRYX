export const FLOOD_CLASSES = [
  { band: 1, key: "none", label: "No modelled flooding", depth: "0 m" },
  { band: 2, key: "low", label: "Low", depth: "up to 0.15 m" },
  { band: 3, key: "moderate", label: "Moderate", depth: "0.15 to 0.5 m" },
  { band: 4, key: "high", label: "High", depth: "0.5 to 1.5 m" },
  { band: 5, key: "very_high", label: "Very high", depth: "above 1.5 m" },
] as const;

export type FloodClassKey = (typeof FLOOD_CLASSES)[number]["key"];

export interface FloodWindowSummary {
  pinClass: FloodClassKey | null;
  populatedCells: number;
  totalCells: number;
  people: number;
  shares: Record<FloodClassKey, number>;
  peopleByClass: Record<FloodClassKey, number>;
  shareAtLeastModerate: number;
}

export function summarizeFloodWindow(rasters: ArrayLike<number>[], pinIndex: number): FloodWindowSummary {
  const peopleByClass = Object.fromEntries(FLOOD_CLASSES.map(({ key }) => [key, 0])) as Record<FloodClassKey, number>;
  const totalCells = rasters[0]?.length ?? 0;
  let populatedCells = 0;
  let pinClass: FloodClassKey | null = null;
  for (let cell = 0; cell < totalCells; cell += 1) {
    let populated = false;
    let dominant: { key: FloodClassKey; value: number } | null = null;
    for (const { band, key } of FLOOD_CLASSES) {
      const value = Number(rasters[band - 1]?.[cell] ?? 0);
      if (!Number.isFinite(value) || value <= 0) continue;
      populated = true;
      peopleByClass[key] += value;
      if (!dominant || value > dominant.value) dominant = { key, value };
    }
    if (populated) populatedCells += 1;
    if (cell === pinIndex) pinClass = dominant?.key ?? null;
  }
  const people = Object.values(peopleByClass).reduce((sum, value) => sum + value, 0);
  const shares = Object.fromEntries(
    FLOOD_CLASSES.map(({ key }) => [key, people > 0 ? Math.round((peopleByClass[key] / people) * 1000) / 10 : 0]),
  ) as Record<FloodClassKey, number>;
  for (const key of Object.keys(peopleByClass) as FloodClassKey[]) peopleByClass[key] = Math.round(peopleByClass[key]);
  const shareAtLeastModerate = Math.round((shares.moderate + shares.high + shares.very_high) * 10) / 10;
  return { pinClass, populatedCells, totalCells, people: Math.round(people), shares, peopleByClass, shareAtLeastModerate };
}

export function floodExposureSentence(summary: FloodWindowSummary, bufferMeters: number): string {
  const pin = FLOOD_CLASSES.find(({ key }) => key === summary.pinClass);
  const pinText = pin ? `The pin cell is in the "${pin.label}" class (${pin.depth}).` : "The pin cell has no population, so it has no exposure class.";
  return `${pinText} Within about ${bufferMeters} m, ${summary.shareAtLeastModerate}% of residents live where the modelled 1-in-100-year flood exceeds 0.15 m.`;
}
