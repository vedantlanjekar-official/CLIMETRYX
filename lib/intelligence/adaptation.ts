import { MEASURE_CATALOGUE } from "@/lib/questionnaire/steps-risk";
import type { ReportModel } from "@/lib/reports/model";
import { HAZARD_MEASURES, type HazardExposure } from "./exposure";
import type { FinancialImpact } from "./financial";
import type { BusinessProfile, CostLine } from "./normalize";
import type { Hazard, Level } from "./types";

const COST_ITEMS: Record<string, string[]> = {
  backupPower: ["backup_power"],
  cooling: ["cooling"],
  waterStorage: ["water_storage"],
  drainage: ["drainage"],
  floodProtection: ["drainage"],
  insurance: ["insurance_premium"],
};

const SCENARIO_FOR_HAZARD: Record<Hazard, string[]> = {
  flood: ["flood_disruption", "compound"],
  heat: ["heat_severe", "heat_moderate"],
  drought: ["water_stress"],
  storm: ["flood_disruption"],
};

export interface AdaptationAction {
  measure: string;
  label: string;
  why: string;
  hazards: Hazard[];
  priority: "high" | "medium" | "low";
  horizon: "now" | "30_days" | "90_days" | "12_months";
  currentStatus: string;
  cost: { amount: number; currency: string | null; basis: string; source: string | null } | null;
  costStatus: "business_supplied" | "not_estimated";
  scenarioAddressed: { id: string; label: string; cashImpact: number | null } | null;
  verification: string;
}

const PRIORITY: Record<Level, AdaptationAction["priority"]> = { high: "high", medium: "medium", low: "low", unknown: "medium" };

function costFor(measure: string, costs: CostLine[]): AdaptationAction["cost"] {
  const items = COST_ITEMS[measure];
  if (!items) return null;
  const lines = costs.filter((line) => items.includes(line.item) && line.nature !== "opex");
  if (!lines.length) return null;
  const currency = lines[0]!.currency;
  const same = lines.filter((line) => line.currency === currency);
  return {
    amount: same.reduce((sum, line) => sum + line.amount, 0),
    currency,
    basis: same.map((line) => `${line.estimateType ?? "estimate"}${line.date ? ` dated ${line.date}` : ""}`).join("; "),
    source: same.map((line) => line.source).filter(Boolean).join("; ") || null,
  };
}

/** Adaptation plan: closes reported gaps on hazards where this business is exposed. Costs only where the business entered them. */
export function adaptationPlan(model: ReportModel, business: BusinessProfile, exposure: HazardExposure[], finance: FinancialImpact) {
  const byMeasure = new Map<string, AdaptationAction>();
  for (const item of [...exposure].sort((a, b) => ["high", "medium", "low", "unknown"].indexOf(a.combined) - ["high", "medium", "low", "unknown"].indexOf(b.combined))) {
    if (item.combined === "low") continue;
    for (const measure of HAZARD_MEASURES[item.hazard]) {
      const status = business.measures[measure] ?? "unknown";
      if (status === "implemented" || status === "not_applicable") continue;
      const catalogue = MEASURE_CATALOGUE.find((entry) => entry.key === measure);
      const existing = byMeasure.get(measure);
      if (existing) {
        if (!existing.hazards.includes(item.hazard)) existing.hazards.push(item.hazard);
        continue;
      }
      const scenario = SCENARIO_FOR_HAZARD[item.hazard].map((id) => finance.scenarios.find((s) => s.id === id && s.available)).find(Boolean) ?? null;
      const cost = costFor(measure, business.costs);
      const priority = PRIORITY[item.combined];
      byMeasure.set(measure, {
        measure,
        label: catalogue?.label ?? measure,
        why: `${item.label}: exposure is ${item.combined}${status === "unknown" ? " and the status of this measure is unknown" : ` and this measure is ${status.replaceAll("_", " ")}`}.`,
        hazards: [item.hazard],
        priority,
        horizon: priority === "high" ? (status === "partial" ? "30_days" : "90_days") : "12_months",
        currentStatus: status,
        cost,
        costStatus: cost ? "business_supplied" : "not_estimated",
        scenarioAddressed: scenario ? { id: scenario.id, label: scenario.label, cashImpact: scenario.cashImpact } : null,
        verification: catalogue?.help ?? "Record the measure as in place with evidence.",
      });
    }
  }
  for (const [measure, status] of Object.entries(business.measures)) {
    if (byMeasure.has(measure) || !["continuityPlan", "emergencyProcedures", "insurance"].includes(measure)) continue;
    if (status === "implemented" || status === "not_applicable") continue;
    const catalogue = MEASURE_CATALOGUE.find((entry) => entry.key === measure);
    const cost = costFor(measure, business.costs);
    byMeasure.set(measure, {
      measure,
      label: catalogue?.label ?? measure,
      why: `Cross-hazard measure reported as ${status.replaceAll("_", " ")}.`,
      hazards: [],
      priority: "medium",
      horizon: "90_days",
      currentStatus: status,
      cost,
      costStatus: cost ? "business_supplied" : "not_estimated",
      scenarioAddressed: null,
      verification: catalogue?.help ?? "Record the measure as in place with evidence.",
    });
  }
  const actions = [...byMeasure.values()].sort((a, b) => ["high", "medium", "low"].indexOf(a.priority) - ["high", "medium", "low"].indexOf(b.priority));
  const costed = actions.filter((action) => action.cost);
  const currency = costed[0]?.cost?.currency ?? null;
  return {
    actions,
    assessmentActions: model.result.recommendations,
    totalCostedCapex: costed.length && costed.every((action) => action.cost?.currency === currency) ? costed.reduce((sum, action) => sum + action.cost!.amount, 0) : null,
    currency,
    uncosted: actions.filter((action) => !action.cost).length,
    notes: [
      "Costs appear only where the business entered a quotation or estimate on the costs step. No construction rates or benchmarks are looked up.",
      "The scenario shown against each action is the hypothetical impact the measure is aimed at. It is not a saving: the platform does not estimate how much of that impact a measure would avoid, so no payback period is calculated.",
    ],
  };
}

export type AdaptationPlan = ReturnType<typeof adaptationPlan>;
