export const BASELINE = { from: 2000, to: 2014 } as const;
export const FUTURE = { from: 2036, to: 2050 } as const;
export const HOT_DAY_C = 35;
export const HEAVY_RAIN_MM = 64.5;

export interface PeriodMetrics {
  meanTmaxC: number;
  hotDaysPerYear: number;
  annualPrecipMm: number;
  heavyRainDaysPerYear: number;
  wettestDayMm: number;
}

export interface ProjectionMetric {
  key: keyof PeriodMetrics;
  label: string;
  unit: string;
  baselineMedian: number;
  changeMedian: number;
  changeMin: number;
  changeMax: number;
  modelsAgreeOnSign: number;
  models: number;
}

const round1 = (value: number) => Math.round(value * 10) / 10;

export function periodMetrics(times: string[], tmax: Array<number | null>, precip: Array<number | null>, from: number, to: number): PeriodMetrics | null {
  const years = new Map<number, { t: number[]; p: number[] }>();
  times.forEach((time, index) => {
    const year = Number(time.slice(0, 4));
    if (year < from || year > to) return;
    const bucket = years.get(year) ?? { t: [], p: [] };
    const t = tmax[index];
    const p = precip[index];
    if (t !== null && t !== undefined && Number.isFinite(t)) bucket.t.push(t);
    if (p !== null && p !== undefined && Number.isFinite(p)) bucket.p.push(p);
    years.set(year, bucket);
  });
  const usable = [...years.values()].filter((bucket) => bucket.t.length >= 330 && bucket.p.length >= 330);
  if (usable.length < (to - from + 1) * 0.8) return null;
  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  return {
    meanTmaxC: mean(usable.map((bucket) => mean(bucket.t))),
    hotDaysPerYear: mean(usable.map((bucket) => bucket.t.filter((value) => value >= HOT_DAY_C).length)),
    annualPrecipMm: mean(usable.map((bucket) => bucket.p.reduce((sum, value) => sum + value, 0))),
    heavyRainDaysPerYear: mean(usable.map((bucket) => bucket.p.filter((value) => value >= HEAVY_RAIN_MM).length)),
    wettestDayMm: mean(usable.map((bucket) => Math.max(...bucket.p))),
  };
}

const LABELS: Record<keyof PeriodMetrics, { label: string; unit: string }> = {
  meanTmaxC: { label: "Average daily maximum temperature", unit: "°C" },
  hotDaysPerYear: { label: `Days at or above ${HOT_DAY_C} °C`, unit: "days/yr" },
  annualPrecipMm: { label: "Annual rainfall", unit: "mm/yr" },
  heavyRainDaysPerYear: { label: `Heavy-rain days (≥ ${HEAVY_RAIN_MM} mm)`, unit: "days/yr" },
  wettestDayMm: { label: "Wettest day of the year (average)", unit: "mm" },
};

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

export function ensembleChanges(perModel: Array<{ baseline: PeriodMetrics; future: PeriodMetrics }>): ProjectionMetric[] {
  if (perModel.length === 0) return [];
  return (Object.keys(LABELS) as Array<keyof PeriodMetrics>).map((key) => {
    const changes = perModel.map(({ baseline, future }) => future[key] - baseline[key]);
    const changeMedian = median(changes);
    const sign = Math.sign(changeMedian);
    return {
      key,
      ...LABELS[key],
      baselineMedian: round1(median(perModel.map(({ baseline }) => baseline[key]))),
      changeMedian: round1(changeMedian),
      changeMin: round1(Math.min(...changes)),
      changeMax: round1(Math.max(...changes)),
      modelsAgreeOnSign: sign === 0 ? 0 : changes.filter((change) => Math.sign(change) === sign).length,
      models: perModel.length,
    };
  });
}
