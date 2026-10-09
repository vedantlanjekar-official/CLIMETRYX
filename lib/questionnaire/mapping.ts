import type { OperationsInput, ResilienceInput, SupplierInput } from "@/lib/domain/operations";
import type { FinancialInputs, StressAssumptions } from "@/lib/financial/metrics";
import type { AssessmentLocationInput, AssessmentRequest } from "@/lib/assessments/pipeline";
import { EMPTY_CONTEXT, populationExposureFrom, type SiteContext } from "@/lib/assessments/context";
import { activeBranches, geopointKeys } from "@/lib/questionnaire/engine";
import { findActivity } from "@/lib/questionnaire/industries";
import { GROUPS, QUESTIONS_BY_KEY } from "@/lib/questionnaire/registry";
import { MEASURE_CATALOGUE } from "@/lib/questionnaire/steps-risk";
import type { AnswerValue, AssessmentAnswers, RepeatRow } from "@/lib/questionnaire/types";
import type { TriState } from "@/lib/scoring/types";

const str = (value: AnswerValue | undefined): string | null => (typeof value === "string" && value.trim() ? value.trim() : null);
const num = (value: AnswerValue | undefined): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);
const tri = (value: AnswerValue | undefined): TriState => (value === "yes" || value === "no" ? value : "unknown");

/** critical or high → yes, moderate or low → no, anything else → unknown. */
export function dependencyToTri(level: AnswerValue | undefined): TriState {
  if (level === "critical" || level === "high") return "yes";
  if (level === "moderate" || level === "low") return "no";
  return "unknown";
}

/** Only an implemented measure closes the gap. Not relevant and unsure are excluded. */
export function measureToTri(status: AnswerValue | undefined): TriState {
  if (status === "implemented") return "yes";
  if (status === "partial" || status === "planned" || status === "not_in_place") return "no";
  return "unknown";
}

export function operationsInput(answers: AssessmentAnswers): OperationsInput {
  const values = answers.values;
  return {
    electricityCritical: dependencyToTri(values["ops.electricity_dependency"]),
    waterCritical: dependencyToTri(values["ops.water_dependency"]),
    coolingCritical: dependencyToTri(values["ops.cooling_dependency"]),
    perishableInventory: tri(values["ops.perishable_inventory"]),
    outdoorWorkforce: tri(values["ops.outdoor_work"]),
    maxTolerableDowntimeHours: num(values["ops.max_downtime_hours"]),
  };
}

export function resilienceInput(answers: AssessmentAnswers): ResilienceInput {
  return Object.fromEntries(MEASURE_CATALOGUE.map((measure) => [measure.key, measureToTri(answers.values[`measures.${measure.key}`])])) as unknown as ResilienceInput;
}

export function supplierInputs(answers: AssessmentAnswers): SupplierInput[] {
  if (answers.values["suppliers.has_critical"] !== "yes") return [];
  return (answers.groups.suppliers ?? []).map((row) => {
    const share = num(row.values.spend_share);
    return {
      name: str(row.values.name) ?? "Unnamed supplier",
      critical: row.values.criticality === "critical",
      spendShare: share === null ? null : share / 100,
      singleSource: tri(row.values.single_source),
      alternativeAvailable: tri(row.values.alternative),
      substitutionDays: num(row.values.substitution_days),
      inventoryBufferDays: num(row.values.buffer_days),
      regionalHazardScore: null,
    };
  });
}

export function financialInputs(answers: AssessmentAnswers): FinancialInputs | null {
  const values = answers.values;
  if (values["fin.include"] !== "yes") return null;
  return {
    currency: str(values["fin.currency"]) ?? "INR",
    period: values["fin.period"] === "annual" ? "annual" : "monthly",
    revenue: num(values["fin.revenue"]),
    fixedCosts: num(values["fin.fixed_costs"]),
    variableCosts: num(values["fin.variable_costs"]),
    cashReserves: num(values["fin.cash_reserves"]),
    recoveryCost: num(values["fin.recovery_cost"]),
  };
}

export function stressAssumptions(answers: AssessmentAnswers): StressAssumptions[] {
  if (answers.values["fin.include"] !== "yes") return [];
  const lost = num(answers.values["fin.lost_revenue_share"]);
  const fixed = num(answers.values["fin.continuing_fixed_share"]);
  return ([1, 3, 7, 14] as const).map((disruptionDays) => ({
    disruptionDays,
    lostRevenueFraction: lost === null ? 1 : lost / 100,
    continuingFixedFraction: fixed === null ? 1 : fixed / 100,
    continuingVariableFraction: 0,
  }));
}

/** Text the heat module classifies into its outdoor, cold-chain or general profile. */
export function heatIndustryText(answers: AssessmentAnswers): string {
  const branches = activeBranches(answers);
  if (branches.has("outdoor_work") || branches.has("agriculture") || branches.has("construction")) return "outdoor";
  if (branches.has("food_cold_chain")) return "food cold chain";
  return findActivity(answers.values["profile.activity"])?.label ?? "general";
}

export interface SiteForAnalysis extends AssessmentLocationInput {
  primary: boolean;
}

/** Sites with valid, confirmed (or accepted low-precision) coordinates, primary first. */
export function sitesForAnalysis(answers: AssessmentAnswers, limit = 5): SiteForAnalysis[] {
  const keys = geopointKeys("point");
  const rows = answers.groups.sites ?? [];
  const sites = rows
    .filter((row) => row.values.site_status !== "closed")
    .flatMap((row, index) => {
      const latitude = num(row.values[keys.lat]);
      const longitude = num(row.values[keys.lon]);
      const confirmation = row.values[keys.confirmation];
      if (latitude === null || longitude === null) return [];
      if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || (latitude === 0 && longitude === 0)) return [];
      const userConfirmed = confirmation === "confirmed_pin";
      const acceptedLowPrecision = confirmation === "accepted_low_precision";
      return [{
        id: row.id,
        label: str(row.values.label) ?? `Site ${index + 1}`,
        latitude,
        longitude,
        userConfirmed,
        acceptedLowPrecision,
        precision: userConfirmed ? "user_confirmed_point" : acceptedLowPrecision ? "low_precision_accepted" : "unconfirmed",
        primary: row.values.is_primary === true || rows.length === 1,
      }];
    });
  return sites.sort((a, b) => Number(b.primary) - Number(a.primary)).slice(0, limit);
}

export function utilityOrigin(answers: AssessmentAnswers): AssessmentRequest["utilityOrigin"] {
  const reported = ["electricity", "water", "telecom"].some((utility) => {
    const band = answers.values[`utility.${utility}.outages`];
    return typeof band === "string" && band !== "unknown";
  });
  return reported ? "business_reported" : "not_provided";
}

export interface EnvironmentInputs {
  forecastDays: AssessmentRequest["forecastDays"];
  forecastRetrievedAt: string | null;
  historical: AssessmentRequest["historical"];
  climatology: AssessmentRequest["climatology"];
  satellite: AssessmentRequest["satellite"];
  context?: SiteContext;
}

export function buildAssessmentRequest(answers: AssessmentAnswers, site: SiteForAnalysis, environment: EnvironmentInputs): AssessmentRequest {
  const financials = financialInputs(answers);
  return {
    businessName: str(answers.values["profile.legal_name"]) ?? "Business",
    industry: heatIndustryText(answers),
    currency: financials?.currency ?? "INR",
    location: {
      id: site.id,
      label: site.label,
      latitude: site.latitude,
      longitude: site.longitude,
      userConfirmed: site.userConfirmed,
      acceptedLowPrecision: site.acceptedLowPrecision,
      precision: site.precision,
    },
    operations: operationsInput(answers),
    resilience: resilienceInput(answers),
    suppliers: supplierInputs(answers),
    financials,
    stressAssumptions: stressAssumptions(answers),
    forecastDays: environment.forecastDays,
    forecastRetrievedAt: environment.forecastRetrievedAt,
    historical: environment.historical,
    climatology: environment.climatology ?? null,
    officialWarnings: environment.context?.alerts?.matched ?? [],
    populationExposure: environment.context ? populationExposureFrom(environment.context) : null,
    waterStress: null,
    satellite: environment.satellite,
    utilityOrigin: utilityOrigin(answers),
    context: environment.context ?? EMPTY_CONTEXT,
  };
}

/** Deterministic serialisation: object keys sorted, array order kept. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
}

function rowMap(list: RepeatRow[] | undefined) {
  return new Map((list ?? []).map((row) => [row.id, row.values]));
}

/** Keys that differ between two answer sets. Group fields appear as "group[].field". */
export function changedFields(previous: AssessmentAnswers | null, next: AssessmentAnswers): string[] {
  const changed = new Set<string>();
  const before = previous ?? { values: {}, groups: {} };
  for (const key of new Set([...Object.keys(before.values), ...Object.keys(next.values)])) {
    if (stableStringify(before.values[key]) !== stableStringify(next.values[key])) changed.add(key);
  }
  for (const groupKey of new Set([...Object.keys(before.groups), ...Object.keys(next.groups)])) {
    const a = rowMap(before.groups[groupKey]);
    const b = rowMap(next.groups[groupKey]);
    for (const id of new Set([...a.keys(), ...b.keys()])) {
      const left = a.get(id) ?? {};
      const right = b.get(id) ?? {};
      if (!a.has(id) || !b.has(id)) changed.add(`${groupKey}[]`);
      for (const field of new Set([...Object.keys(left), ...Object.keys(right)])) {
        if (stableStringify(left[field]) !== stableStringify(right[field])) changed.add(`${groupKey}[].${field.replace(/_(lat|lon|confirmation|source|match)$/, "")}`);
      }
    }
  }
  return [...changed].sort();
}

/** A change is material when the question is flagged material, or rows were added or removed in a scored group. */
export function materialChanges(changed: string[]): string[] {
  return changed.filter((key) => {
    if (key.endsWith("[]")) return ["sites", "suppliers"].includes(key.slice(0, -2));
    const match = key.match(/^([a-z_]+)\[\]\.(.+)$/);
    if (match) return GROUPS.get(match[1]!)?.group.questions.find((question) => question.key === match[2])?.material ?? false;
    return QUESTIONS_BY_KEY.get(key)?.question.material ?? false;
  });
}

/** Separates restricted financial answers so they can be stored under stricter access. */
export function splitRestricted(answers: AssessmentAnswers): { general: AssessmentAnswers; restricted: AssessmentAnswers } {
  const general: AssessmentAnswers = { values: {}, groups: {} };
  const restricted: AssessmentAnswers = { values: {}, groups: {} };
  for (const [key, value] of Object.entries(answers.values)) {
    const target = QUESTIONS_BY_KEY.get(key)?.question.sensitivity === "restricted_financial" ? restricted : general;
    target.values[key] = value;
  }
  for (const [groupKey, list] of Object.entries(answers.groups)) {
    const definition = GROUPS.get(groupKey)?.group;
    const restrictedFields = new Set(definition?.questions.filter((question) => question.sensitivity === "restricted_financial").map((question) => question.key));
    general.groups[groupKey] = list.map((row) => ({ id: row.id, values: Object.fromEntries(Object.entries(row.values).filter(([field]) => !restrictedFields.has(field))) }));
    const restrictedRows = list
      .map((row) => ({ id: row.id, values: Object.fromEntries(Object.entries(row.values).filter(([field]) => restrictedFields.has(field))) }))
      .filter((row) => Object.keys(row.values).length > 0);
    if (restrictedRows.length) restricted.groups[groupKey] = restrictedRows;
  }
  return { general, restricted };
}

export function mergeRestricted(general: AssessmentAnswers, restricted: AssessmentAnswers | null): AssessmentAnswers {
  if (!restricted) return general;
  const groups: AssessmentAnswers["groups"] = {};
  for (const [key, list] of Object.entries(general.groups)) {
    const extra = rowMap(restricted.groups[key]);
    groups[key] = list.map((row) => ({ id: row.id, values: { ...row.values, ...(extra.get(row.id) ?? {}) } }));
  }
  return { values: { ...general.values, ...restricted.values }, groups };
}
