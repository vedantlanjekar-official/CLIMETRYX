import { fitGammaWithZeros, mean, quantileSorted, standardDeviation, standardizedIndex, type GammaFit } from "@/lib/climatology/stats";

export const CLIMATOLOGY_VERSION = "fin05-climatology-1.0.0";
export const WET_DAY_MM = 1;
export const SPI_WINDOWS = [30, 90] as const;
export type SpiWindow = (typeof SPI_WINDOWS)[number];

export interface DailyClimateRecord {
  date: string;
  tmaxC: number | null;
  precipMm: number | null;
  gustMps: number | null;
}

export interface ClimatologySource {
  provider: string;
  model: string;
  gridLatitude: number;
  gridLongitude: number;
  elevationM: number | null;
  retrievedAt: string;
  licence: string;
  attribution: string;
}

export interface SpiMonthParams extends GammaFit {
  month: number;
  meanMm: number;
}

export interface ClimatologyModel {
  version: string;
  fittedAt: string;
  source: ClimatologySource;
  baseline: { start: string; end: string; years: number; days: number; missingDays: number };
  heat: { tmaxP90C: number | null; tmaxP95C: number | null; tmaxP99C: number | null };
  rain: {
    wetDayMm: number;
    wetDayP95Mm: number | null;
    wetDayP99Mm: number | null;
    threeDayP99Mm: number | null;
    annualMax1Day2yrMm: number | null;
    annualMax1Day10yrMm: number | null;
  };
  gust: { p95Mps: number | null; p99Mps: number | null; annualMax2yrMps: number | null; annualMax10yrMps: number | null };
  spi: Record<`${SpiWindow}`, SpiMonthParams[]>;
}

export interface ClimatologyValidation {
  version: string;
  trainPeriod: { start: string; end: string };
  testPeriod: { start: string; end: string };
  checks: Array<{ key: string; label: string; expected: number; observed: number | null; ratio: number | null; samples: number }>;
  spi90Test: { mean: number | null; sd: number | null; samples: number };
  interpretation: string[];
}

function round(value: number | null, digits = 2): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function sortedValues(values: Array<number | null>): number[] {
  return values.filter((value): value is number => value !== null && Number.isFinite(value)).sort((a, b) => a - b);
}

function yearOf(date: string) {
  return Number(date.slice(0, 4));
}

function monthOf(date: string) {
  return Number(date.slice(5, 7));
}

function isMonthEnd(records: DailyClimateRecord[], index: number) {
  const next = records[index + 1];
  return !next || monthOf(next.date) !== monthOf(records[index]!.date);
}

/** Sum of the `window` daily totals ending at `endIndex`. Null if any day is missing. */
function windowSum(records: DailyClimateRecord[], endIndex: number, window: number): number | null {
  if (endIndex - window + 1 < 0) return null;
  let sum = 0;
  for (let index = endIndex - window + 1; index <= endIndex; index += 1) {
    const value = records[index]!.precipMm;
    if (value === null) return null;
    sum += value;
  }
  return sum;
}

function annualMaxima(records: DailyClimateRecord[], pick: (record: DailyClimateRecord) => number | null): number[] {
  const byYear = new Map<number, number>();
  for (const record of records) {
    const value = pick(record);
    if (value === null) continue;
    const year = yearOf(record.date);
    byYear.set(year, Math.max(byYear.get(year) ?? Number.NEGATIVE_INFINITY, value));
  }
  return [...byYear.values()].sort((a, b) => a - b);
}

export function fitClimatology(records: DailyClimateRecord[], source: ClimatologySource, now = new Date()): ClimatologyModel {
  if (records.length < 365 * 10) throw new Error("At least ten years of daily records are required to fit a climatology.");
  const tmax = sortedValues(records.map((record) => record.tmaxC));
  const wet = sortedValues(records.map((record) => (record.precipMm !== null && record.precipMm >= WET_DAY_MM ? record.precipMm : null)));
  const gust = sortedValues(records.map((record) => record.gustMps));
  const threeDay: number[] = [];
  for (let index = 2; index < records.length; index += 1) {
    const sum = windowSum(records, index, 3);
    if (sum !== null) threeDay.push(sum);
  }
  threeDay.sort((a, b) => a - b);
  const rainMax = annualMaxima(records, (record) => record.precipMm);
  const gustMax = annualMaxima(records, (record) => record.gustMps);

  const spi = {} as ClimatologyModel["spi"];
  for (const window of SPI_WINDOWS) {
    const samples = new Map<number, number[]>();
    records.forEach((record, index) => {
      if (!isMonthEnd(records, index)) return;
      const sum = windowSum(records, index, window);
      if (sum === null) return;
      const month = monthOf(record.date);
      samples.set(month, [...(samples.get(month) ?? []), sum]);
    });
    spi[`${window}`] = [...samples.entries()]
      .sort(([a], [b]) => a - b)
      .flatMap(([month, values]) => {
        const fit = fitGammaWithZeros(values);
        if (!fit) return [];
        return [{ month, meanMm: round(mean(values))!, alpha: round(fit.alpha, 5)!, beta: round(fit.beta, 5)!, zeroFraction: round(fit.zeroFraction, 4)!, n: fit.n }];
      });
  }

  const years = new Set(records.map((record) => yearOf(record.date))).size;
  const missingDays = records.filter((record) => record.tmaxC === null || record.precipMm === null).length;
  return {
    version: CLIMATOLOGY_VERSION,
    fittedAt: now.toISOString(),
    source,
    baseline: { start: records[0]!.date, end: records[records.length - 1]!.date, years, days: records.length, missingDays },
    heat: {
      tmaxP90C: round(quantileSorted(tmax, 0.9), 1),
      tmaxP95C: round(quantileSorted(tmax, 0.95), 1),
      tmaxP99C: round(quantileSorted(tmax, 0.99), 1),
    },
    rain: {
      wetDayMm: WET_DAY_MM,
      wetDayP95Mm: round(quantileSorted(wet, 0.95), 1),
      wetDayP99Mm: round(quantileSorted(wet, 0.99), 1),
      threeDayP99Mm: round(quantileSorted(threeDay, 0.99), 1),
      annualMax1Day2yrMm: round(quantileSorted(rainMax, 0.5), 1),
      annualMax1Day10yrMm: round(quantileSorted(rainMax, 0.9), 1),
    },
    gust: {
      p95Mps: round(quantileSorted(gust, 0.95), 1),
      p99Mps: round(quantileSorted(gust, 0.99), 1),
      annualMax2yrMps: round(quantileSorted(gustMax, 0.5), 1),
      annualMax10yrMps: round(quantileSorted(gustMax, 0.9), 1),
    },
    spi,
  };
}

export interface CurrentSpi {
  window: SpiWindow;
  value: number | null;
  totalMm: number | null;
  normalMm: number | null;
  endDate: string | null;
  month: number | null;
  reason?: string;
}

/** SPI for the window ending on the latest day with data. Uses the fit for that day's calendar month. */
function isCalendarMonthEnd(date: string) {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.getUTCDate() === 1;
}

/** SPI for the window ending at the latest complete calendar month, matching the month-end windows the gamma fits use. */
export function currentSpi(model: ClimatologyModel, recent: DailyClimateRecord[], window: SpiWindow): CurrentSpi {
  let end = recent.length - 1;
  while (end >= 0 && (recent[end]!.precipMm === null || !isCalendarMonthEnd(recent[end]!.date))) end -= 1;
  if (end < 0) return { window, value: null, totalMm: null, normalMm: null, endDate: null, month: null, reason: "No complete month in the recent precipitation record." };
  const totalMm = windowSum(recent, end, window);
  const endDate = recent[end]!.date;
  const month = monthOf(endDate);
  const params = model.spi[`${window}`].find((entry) => entry.month === month);
  if (totalMm === null) return { window, value: null, totalMm: null, normalMm: params?.meanMm ?? null, endDate, month, reason: `Fewer than ${window} consecutive recent days.` };
  if (!params) return { window, value: null, totalMm: round(totalMm, 1), normalMm: null, endDate, month, reason: "No gamma fit for this month." };
  return { window, value: round(standardizedIndex(totalMm, params)), totalMm: round(totalMm, 1), normalMm: params.meanMm, endDate, month };
}

function exceedanceRate(values: number[], threshold: number | null): number | null {
  if (threshold === null || values.length === 0) return null;
  return values.filter((value) => value > threshold).length / values.length;
}

/** Out-of-time check: fit on years up to `trainEndYear`, then measure how the test years behave against that fit. */
export function validateClimatology(records: DailyClimateRecord[], source: ClimatologySource, trainEndYear: number): ClimatologyValidation {
  const train = records.filter((record) => yearOf(record.date) <= trainEndYear);
  const test = records.filter((record) => yearOf(record.date) > trainEndYear);
  if (test.length < 365 * 3) throw new Error("At least three test years are required.");
  const model = fitClimatology(train, source);
  const testTmax = sortedValues(test.map((record) => record.tmaxC));
  const testWet = sortedValues(test.map((record) => (record.precipMm !== null && record.precipMm >= WET_DAY_MM ? record.precipMm : null)));
  const testGust = sortedValues(test.map((record) => record.gustMps));
  const spi90: number[] = [];
  test.forEach((record, index) => {
    if (!isMonthEnd(test, index)) return;
    const sum = windowSum(test, index, 90);
    const params = model.spi["90"].find((entry) => entry.month === monthOf(record.date));
    if (sum !== null && params) spi90.push(standardizedIndex(sum, params));
  });
  const checks: ClimatologyValidation["checks"] = [
    { key: "tmax_p95", label: "Days above training P95 daily maximum temperature", expected: 0.05, observed: exceedanceRate(testTmax, model.heat.tmaxP95C), samples: testTmax.length },
    { key: "wet_p95", label: "Wet days above training P95 wet-day rainfall", expected: 0.05, observed: exceedanceRate(testWet, model.rain.wetDayP95Mm), samples: testWet.length },
    { key: "gust_p95", label: "Days above training P95 daily maximum gust", expected: 0.05, observed: exceedanceRate(testGust, model.gust.p95Mps), samples: testGust.length },
    { key: "spi90_le_minus1", label: "Month-end SPI-90 at or below −1 (moderately dry or worse)", expected: 0.1587, observed: spi90.length ? spi90.filter((value) => value <= -1).length / spi90.length : null, samples: spi90.length },
  ].map((check) => ({ ...check, observed: round(check.observed, 4), ratio: check.observed === null ? null : round(check.observed / check.expected, 2) }));
  const percent = (value: number) => `${Math.round(value * 1000) / 10}%`;
  const interpretation = checks.map((check) => {
    if (check.ratio === null || check.observed === null) return `${check.label}: not enough test data.`;
    const prefix = `${check.label}: ${percent(check.observed)} versus ${percent(check.expected)} expected.`;
    if (check.ratio > 1.5) return `${prefix} The recent period exceeds the older baseline more often, consistent with a shift; thresholds from an older baseline understate current frequency.`;
    if (check.ratio < 0.5) return `${prefix} The recent period exceeds the older baseline less often.`;
    return `${prefix} Within a factor of 1.5.`;
  });
  return {
    version: CLIMATOLOGY_VERSION,
    trainPeriod: { start: train[0]!.date, end: train[train.length - 1]!.date },
    testPeriod: { start: test[0]!.date, end: test[test.length - 1]!.date },
    checks,
    spi90Test: { mean: round(mean(spi90)), sd: round(standardDeviation(spi90)), samples: spi90.length },
    interpretation,
  };
}
