import { MEASURE_CATALOGUE } from "@/lib/questionnaire/steps-risk";
import type { Level } from "../types";

export function money(value: number | null | undefined, currency: string): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "not available";
  const locale = currency === "INR" ? "en-IN" : "en-US";
  return `${currency} ${Math.round(value).toLocaleString(locale)}`;
}

export function quantity(value: number | null | undefined, unit: string, digits = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "not available";
  const factor = 10 ** digits;
  return `${(Math.round(value * factor) / factor).toLocaleString("en-US")}${unit ? (unit === "%" ? "%" : ` ${unit}`) : ""}`;
}

export function narrativeLabel(generation: { mode: "ai" | "rules"; model: string | null; validationIssues: string[] }): string {
  if (generation.mode === "ai") return `AI (${generation.model}), validated against the analytical figures`;
  return generation.validationIssues.length ? "Rules-written (the AI draft failed the grounding check)" : "Rules-written (AI not available)";
}

export const LEVEL_TEXT: Record<Level, string> = { high: "High", medium: "Medium", low: "Low", unknown: "Unknown" };

export const measureLabel = (key: string) => MEASURE_CATALOGUE.find((entry) => entry.key === key)?.label ?? key;

export const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const monthNames = (months: number[]) => months.map((month) => MONTH_NAMES[month - 1]).filter(Boolean).join(", ");

export function metricValue(metric: { value: number | null; unit: string }): string {
  if (/^[A-Z]{3}$/.test(metric.unit)) return money(metric.value, metric.unit);
  return quantity(metric.value, metric.unit, Math.abs(metric.value ?? 0) < 10 ? 2 : 0);
}

export const KIND_LABEL: Record<string, string> = {
  observed: "Observed",
  forecast: "Forecast",
  reported: "Business-reported",
  derived: "Derived",
  hypothetical: "Hypothetical scenario",
  projection: "Climate projection",
  assumption: "Platform assumption",
};

export const humanize = (value: string | null | undefined) => (value ? value.replaceAll("_", " ") : "not answered");
