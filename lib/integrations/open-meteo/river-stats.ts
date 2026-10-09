export interface RiverStatistics {
  years: number;
  firstYear: number;
  lastYear: number;
  meanM3s: number;
  annualMaxMedianM3s: number;
  annualMax90thM3s: number;
  recordMaxM3s: number;
  recordMaxDate: string;
}

const MIN_DAYS_PER_YEAR = 330;
const MIN_YEARS = 15;

function quantile(sorted: number[], q: number): number {
  const position = (sorted.length - 1) * q;
  const low = Math.floor(position);
  const high = Math.ceil(position);
  return sorted[low]! + (sorted[high]! - sorted[low]!) * (position - low);
}

const round = (value: number) => Math.round(value * 100) / 100;

export function riverStatistics(times: string[], values: Array<number | null>): RiverStatistics | null {
  const byYear = new Map<number, { count: number; max: number; maxDate: string }>();
  let sum = 0;
  let count = 0;
  times.forEach((time, index) => {
    const value = values[index];
    if (value === null || value === undefined || !Number.isFinite(value)) return;
    const year = Number(time.slice(0, 4));
    const entry = byYear.get(year) ?? { count: 0, max: -Infinity, maxDate: time };
    entry.count += 1;
    if (value > entry.max) {
      entry.max = value;
      entry.maxDate = time;
    }
    byYear.set(year, entry);
    sum += value;
    count += 1;
  });
  const complete = [...byYear.entries()].filter(([, entry]) => entry.count >= MIN_DAYS_PER_YEAR).sort(([a], [b]) => a - b);
  if (complete.length < MIN_YEARS) return null;
  const maxima = complete.map(([, entry]) => entry.max).sort((a, b) => a - b);
  const record = complete.reduce((best, current) => (current[1].max > best[1].max ? current : best));
  return {
    years: complete.length,
    firstYear: complete[0]![0],
    lastYear: complete.at(-1)![0],
    meanM3s: round(sum / count),
    annualMaxMedianM3s: round(quantile(maxima, 0.5)),
    annualMax90thM3s: round(quantile(maxima, 0.9)),
    recordMaxM3s: round(record[1].max),
    recordMaxDate: record[1].maxDate,
  };
}

export function riverOutlook(
  forecast: Array<{ dischargeM3s: number | null; ensembleMaxM3s: number | null; date: string }>,
  statistics: RiverStatistics | null,
): { peakM3s: number | null; peakDate: string | null; ensembleMaxM3s: number | null; level: "below_typical_annual_peak" | "above_typical_annual_peak" | "above_10yr_level" | "unknown" } {
  let peak: { value: number; date: string } | null = null;
  let ensembleMax: number | null = null;
  for (const day of forecast) {
    if (day.dischargeM3s !== null && (!peak || day.dischargeM3s > peak.value)) peak = { value: day.dischargeM3s, date: day.date };
    if (day.ensembleMaxM3s !== null) ensembleMax = Math.max(ensembleMax ?? -Infinity, day.ensembleMaxM3s);
  }
  if (!peak || !statistics) return { peakM3s: peak?.value ?? null, peakDate: peak?.date ?? null, ensembleMaxM3s: ensembleMax, level: "unknown" };
  const level =
    peak.value >= statistics.annualMax90thM3s
      ? "above_10yr_level"
      : peak.value >= statistics.annualMaxMedianM3s
        ? "above_typical_annual_peak"
        : "below_typical_annual_peak";
  return { peakM3s: peak.value, peakDate: peak.date, ensembleMaxM3s: ensembleMax, level };
}
