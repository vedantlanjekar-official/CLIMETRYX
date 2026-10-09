import { HEAVY_RAIN_MM, HOT_DAY_C } from "@/lib/integrations/open-meteo/projection-stats";
import type { Incident, MonthlyRecord } from "./normalize";
import { round } from "./types";

export const MIN_MONTHS_FOR_COMPARISON = 12;

export interface ClimateMonth {
  month: string;
  meanTmaxC: number | null;
  precipMm: number | null;
  hotDays: number;
  heavyRainDays: number;
  days: number;
}

export interface Association {
  variable: "meanTmaxC" | "precipMm" | "hotDays" | "heavyRainDays";
  label: string;
  r: number | null;
  n: number;
  strength: "none" | "weak" | "moderate" | "strong" | "not_computed";
  direction: "higher revenue" | "lower revenue" | "no clear direction";
}

export interface EventComparison {
  label: string;
  eventMonths: string[];
  meanIndexEvent: number | null;
  meanIndexOther: number | null;
  differencePct: number | null;
}

export interface HistoryMatch {
  status: "analysed" | "insufficient_history" | "no_history" | "climate_unavailable";
  months: number;
  window: { from: string | null; to: string | null };
  series: Array<{ month: string; revenue: number; revenueIndex: number; meanTmaxC: number | null; precipMm: number | null; hotDays: number | null; heavyRainDays: number | null; incident: boolean }>;
  associations: Association[];
  events: EventComparison[];
  wettestMonths: number[];
  hottestMonths: number[];
  notes: string[];
  source: string | null;
}

/** Aggregates daily ERA5 records into calendar months. Months with fewer than 25 days of data get null means. */
export function monthlyClimate(records: Array<{ date: string; tmaxC: number | null; precipMm: number | null }>): ClimateMonth[] {
  const byMonth = new Map<string, { tmax: number[]; precip: number[]; hot: number; heavy: number; days: number }>();
  for (const record of records) {
    const key = record.date.slice(0, 7);
    const bucket = byMonth.get(key) ?? { tmax: [], precip: [], hot: 0, heavy: 0, days: 0 };
    bucket.days += 1;
    if (record.tmaxC !== null) {
      bucket.tmax.push(record.tmaxC);
      if (record.tmaxC >= HOT_DAY_C) bucket.hot += 1;
    }
    if (record.precipMm !== null) {
      bucket.precip.push(record.precipMm);
      if (record.precipMm >= HEAVY_RAIN_MM) bucket.heavy += 1;
    }
    byMonth.set(key, bucket);
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, bucket]) => ({
      month,
      meanTmaxC: bucket.tmax.length >= 25 ? round(bucket.tmax.reduce((s, v) => s + v, 0) / bucket.tmax.length, 1) : null,
      precipMm: bucket.precip.length >= 25 ? round(bucket.precip.reduce((s, v) => s + v, 0), 1) : null,
      hotDays: bucket.hot,
      heavyRainDays: bucket.heavy,
      days: bucket.days,
    }));
}

export function pearson(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n < 3 || n !== ys.length) return null;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i += 1) {
    sxy += (xs[i]! - mx) * (ys[i]! - my);
    sxx += (xs[i]! - mx) ** 2;
    syy += (ys[i]! - my) ** 2;
  }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

function strengthOf(r: number | null): Association["strength"] {
  if (r === null) return "not_computed";
  const a = Math.abs(r);
  return a >= 0.7 ? "strong" : a >= 0.4 ? "moderate" : a >= 0.2 ? "weak" : "none";
}

const LABELS: Record<Association["variable"], string> = {
  meanTmaxC: "Mean daily maximum temperature",
  precipMm: "Monthly rainfall",
  hotDays: `Days at or above ${HOT_DAY_C} °C`,
  heavyRainDays: `Days with at least ${HEAVY_RAIN_MM} mm of rain`,
};

function topMonths(climate: ClimateMonth[], pick: (month: ClimateMonth) => number | null): number[] {
  const totals = new Map<number, number[]>();
  for (const entry of climate) {
    const value = pick(entry);
    if (value === null) continue;
    const calendar = Number(entry.month.slice(5, 7));
    totals.set(calendar, [...(totals.get(calendar) ?? []), value]);
  }
  return [...totals.entries()]
    .map(([month, values]) => ({ month, mean: values.reduce((s, v) => s + v, 0) / values.length }))
    .sort((a, b) => b.mean - a.mean)
    .slice(0, 3)
    .map((item) => item.month)
    .sort((a, b) => a - b);
}

/** Engine D: compares the business's own monthly revenue with observed weather at the site. Association only. */
export function matchHistory(history: MonthlyRecord[], climate: ClimateMonth[] | null, incidents: Incident[], source: string | null): HistoryMatch {
  const base: HistoryMatch = {
    status: "no_history",
    months: history.length,
    window: { from: history[0]?.month ?? null, to: history.at(-1)?.month ?? null },
    series: [],
    associations: [],
    events: [],
    wettestMonths: climate ? topMonths(climate, (m) => m.precipMm) : [],
    hottestMonths: climate ? topMonths(climate, (m) => m.meanTmaxC) : [],
    notes: [],
    source,
  };
  if (!history.length) return { ...base, notes: ["No monthly revenue history was supplied."] };
  const mean = history.reduce((sum, item) => sum + item.revenue, 0) / history.length;
  const incidentMonths = new Set(incidents.map((item) => item.occurredOn?.slice(0, 7)).filter((value): value is string => Boolean(value)));
  const climateByMonth = new Map((climate ?? []).map((item) => [item.month, item]));
  const series = history.map((item) => {
    const weather = climateByMonth.get(item.month);
    return {
      month: item.month,
      revenue: item.revenue,
      revenueIndex: mean > 0 ? round((item.revenue / mean) * 100, 1) : 100,
      meanTmaxC: weather?.meanTmaxC ?? null,
      precipMm: weather?.precipMm ?? null,
      hotDays: weather ? weather.hotDays : null,
      heavyRainDays: weather ? weather.heavyRainDays : null,
      incident: incidentMonths.has(item.month),
    };
  });
  if (history.length < MIN_MONTHS_FOR_COMPARISON) {
    return { ...base, status: "insufficient_history", series, notes: [`${history.length} months supplied; at least ${MIN_MONTHS_FOR_COMPARISON} are needed before revenue is compared with weather.`] };
  }
  if (!climate || !climate.length) {
    return { ...base, status: "climate_unavailable", series, notes: ["Historical weather for the revenue months could not be retrieved, so no comparison was made."] };
  }
  const associations: Association[] = (["meanTmaxC", "precipMm", "hotDays", "heavyRainDays"] as const).map((variable) => {
    const pairs = series.filter((item) => item[variable] !== null).map((item) => [item[variable] as number, item.revenueIndex] as const);
    const r = pearson(pairs.map((p) => p[0]), pairs.map((p) => p[1]));
    const strength = strengthOf(r);
    return {
      variable,
      label: LABELS[variable],
      r: r === null ? null : round(r, 2),
      n: pairs.length,
      strength,
      direction: r === null || strength === "none" ? "no clear direction" : r > 0 ? "higher revenue" : "lower revenue",
    };
  });
  const compare = (label: string, flag: (item: (typeof series)[number]) => boolean): EventComparison => {
    const event = series.filter(flag);
    const other = series.filter((item) => !flag(item));
    const avg = (items: typeof series) => (items.length ? items.reduce((s, v) => s + v.revenueIndex, 0) / items.length : null);
    const e = avg(event);
    const o = avg(other);
    return { label, eventMonths: event.map((item) => item.month), meanIndexEvent: e === null ? null : round(e, 1), meanIndexOther: o === null ? null : round(o, 1), differencePct: e !== null && o ? round(((e - o) / o) * 100, 1) : null };
  };
  const events = [
    compare(`Months with a day of at least ${HEAVY_RAIN_MM} mm of rain`, (item) => (item.heavyRainDays ?? 0) > 0),
    compare(`Months with five or more days at or above ${HOT_DAY_C} °C`, (item) => (item.hotDays ?? 0) >= 5),
    compare("Months with a reported incident", (item) => item.incident),
  ].filter((item) => item.eventMonths.length > 0 && item.eventMonths.length < series.length);
  return {
    ...base,
    status: "analysed",
    series,
    associations,
    events,
    notes: [
      `Correlation over ${series.length} months between the revenue index (each month as a percentage of the period average) and observed weather. Correlation is association, not causation.`,
      "Seasonal demand and weather share the same calendar, so a correlation can reflect normal seasonality rather than weather damage.",
      series.length < 24 ? "Fewer than 24 months: each season appears only once or twice, so results are indicative only." : "At least two full years are included.",
    ],
  };
}
