import type { ReportModel } from "@/lib/reports/model";
import { LEVEL_SCORE, type HazardExposure } from "./exposure";
import type { FinancialImpact } from "./financial";
import type { BusinessProfile } from "./normalize";
import { round } from "./types";

export const RISK_WEIGHTS_VERSION = "climate-adjusted-weights-1.0";
export const RESILIENCE_VERSION = "resilience-1.0";

export const RISK_STATEMENT =
  "Climate-adjusted risk indicator for decision support. It is not a probability of default, a credit score or a lending decision. PD, EAD and LGD are not calculated because no validated credit model is available.";

export interface Dimension {
  id: string;
  label: string;
  score: number | null;
  weight: number;
  effectiveWeight: number | null;
  basis: string;
}

const RISK_WEIGHTS: Record<string, number> = {
  climate_hazard: 0.15,
  business_exposure: 0.15,
  operational: 0.15,
  adaptive_gap: 0.1,
  supply_chain: 0.1,
  liquidity: 0.15,
  debt_service: 0.1,
  revenue_at_risk: 0.1,
};

function weighted(dimensions: Array<Omit<Dimension, "effectiveWeight">>): { dimensions: Dimension[]; score: number | null; coverage: number } {
  const available = dimensions.filter((item) => item.score !== null);
  const total = available.reduce((sum, item) => sum + item.weight, 0);
  const all = dimensions.reduce((sum, item) => sum + item.weight, 0);
  const result = dimensions.map((item) => ({ ...item, effectiveWeight: item.score === null || total === 0 ? null : round(item.weight / total, 3) }));
  const score = total === 0 ? null : round(available.reduce((sum, item) => sum + item.score! * item.weight, 0) / total, 1);
  return { dimensions: result, score, coverage: all ? round(total / all, 2) : 0 };
}

const component = (model: ReportModel, id: string) => model.result.score.components.find((item) => item.id === id)?.score ?? null;

export function riskBand(score: number | null): string | null {
  if (score === null) return null;
  return score >= 70 ? "High" : score >= 50 ? "Elevated" : score >= 25 ? "Moderate" : "Low";
}

function dscrRisk(value: number | null): number | null {
  if (value === null) return null;
  return value < 1 ? 85 : value < 1.25 ? 65 : value < 2 ? 35 : 15;
}

function impactRisk(pct: number | null): number | null {
  if (pct === null) return null;
  return pct >= 100 ? 90 : pct >= 50 ? 70 : pct >= 20 ? 45 : pct >= 5 ? 25 : 10;
}

function runwayRisk(days: number | null): number | null {
  if (days === null) return null;
  return days < 7 ? 90 : days < 14 ? 70 : days < 30 ? 45 : days < 90 ? 25 : 10;
}

/** Engine G: separate dimensions combined with versioned weights. Missing dimensions are excluded, never treated as low risk. */
export function climateAdjustedRisk(model: ReportModel, exposure: HazardExposure[], finance: FinancialImpact) {
  const known = exposure.map((item) => LEVEL_SCORE[item.combined]).filter((value): value is number => value !== null);
  const worst = finance.scenarios.find((item) => item.id === finance.worstScenarioId) ?? null;
  const stressed = finance.scenarios.map((item) => item.stressedDebtServiceCoverage).filter((value): value is number => value !== null);
  const base = finance.baseline;
  const result = weighted([
    { id: "climate_hazard", label: "Near-term climate hazard", score: component(model, "hazard"), weight: RISK_WEIGHTS.climate_hazard!, basis: "Forecast hazard component of the assessment (heat, rain, dryness, wind screens)." },
    { id: "business_exposure", label: "Business exposure to hazards", score: known.length ? round(known.reduce((s, v) => s + v, 0) / known.length, 1) : null, weight: RISK_WEIGHTS.business_exposure!, basis: "Average of hazard × sensitivity levels (high 80, medium 50, low 20); unknown hazards excluded." },
    { id: "operational", label: "Operational sensitivity", score: component(model, "operational_sensitivity"), weight: RISK_WEIGHTS.operational!, basis: "Assessment component from reported dependencies and downtime tolerance." },
    { id: "adaptive_gap", label: "Adaptive-capacity gap", score: component(model, "adaptive_capacity_gap"), weight: RISK_WEIGHTS.adaptive_gap!, basis: "Share of answered resilience measures reported absent." },
    { id: "supply_chain", label: "Supply-chain vulnerability", score: component(model, "supply_chain"), weight: RISK_WEIGHTS.supply_chain!, basis: "Most exposed critical supplier." },
    { id: "liquidity", label: "Liquidity", score: runwayRisk(base.runwayDays), weight: RISK_WEIGHTS.liquidity!, basis: base.runwayDays === null ? "Runway not available." : `Cash covers ${base.runwayDays} days of fixed costs (bands: <7 days 90, <14 70, <30 45, <90 25, otherwise 10).` },
    { id: "debt_service", label: "Debt-service capacity under stress", score: dscrRisk(stressed.length ? Math.min(...stressed) : base.debtServiceCoverage), weight: RISK_WEIGHTS.debt_service!, basis: base.debtServiceCoverage === null ? "Loan repayments not supplied." : `Lowest coverage across scenarios (bands: <1.0 85, <1.25 65, <2.0 35, otherwise 15).` },
    { id: "revenue_at_risk", label: "Revenue and margin at risk", score: impactRisk(worst?.impactPctMonthlyRevenue ?? null), weight: RISK_WEIGHTS.revenue_at_risk!, basis: worst ? `Worst scenario (${worst.label}) costs ${worst.impactPctMonthlyRevenue}% of a month's revenue (bands: ≥100% 90, ≥50% 70, ≥20% 45, ≥5% 25, otherwise 10).` : "No financial scenario could be calculated." },
  ]);
  return {
    version: RISK_WEIGHTS_VERSION,
    statement: RISK_STATEMENT,
    score: result.score,
    band: riskBand(result.score),
    coverage: result.coverage,
    dimensions: result.dimensions,
    vulnerabilityIndicator: { score: model.result.score.score, band: model.result.score.band, methodology: model.result.methodologyVersion },
  };
}

export type ClimateAdjustedRisk = ReturnType<typeof climateAdjustedRisk>;

/** Resilience: higher is better. Each dimension is shown on its own; the overall is an equal-weight mean of what is known. */
export function resilienceProfile(model: ReportModel, business: BusinessProfile, finance: FinancialImpact, exposure: HazardExposure[]) {
  const runway = finance.baseline.runwayDays;
  const measureStatuses = Object.values(business.measures);
  const implemented = measureStatuses.filter((status) => status === "implemented").length;
  const answered = measureStatuses.filter((status) => ["implemented", "partial", "planned", "not_in_place"].includes(status)).length;
  const insurance = business.finance.insurance;
  const worker = business.measures.workerSafety;
  const recoveries = exposure.flatMap((item) => (item.incidents.medianRecoveryDays === null ? [] : [item.incidents.medianRecoveryDays]));
  const recovery = recoveries.length ? Math.max(...recoveries) : null;
  const inverse = (value: number | null) => (value === null ? null : round(100 - value, 1));
  const dimensions: Array<Omit<Dimension, "effectiveWeight">> = [
    { id: "financial", label: "Financial buffer", score: runway === null ? null : runway >= 90 ? 90 : runway >= 30 ? 70 : runway >= 14 ? 50 : runway >= 7 ? 30 : 10, weight: 1, basis: runway === null ? "Runway not available." : `Cash covers ${runway} days of fixed costs.` },
    { id: "operational", label: "Operational robustness", score: inverse(component(model, "operational_sensitivity")), weight: 1, basis: "100 minus operational sensitivity." },
    { id: "supply", label: "Supply-chain robustness", score: inverse(component(model, "supply_chain")), weight: 1, basis: "100 minus supply-chain vulnerability." },
    { id: "preparedness", label: "Climate preparedness", score: answered ? round((implemented / answered) * 100, 1) : null, weight: 1, basis: answered ? `${implemented} of ${answered} answered measures in place.` : "No measures answered." },
    { id: "insurance", label: "Insurance protection", score: insurance === "property_bi" ? 80 : insurance === "property" ? 50 : insurance === "none" ? 10 : null, weight: 1, basis: insurance ? `Reported cover: ${insurance}${business.finance.insuranceExclusions ? "; exclusions noted" : ""}.` : "Insurance not reported." },
    { id: "workforce", label: "Workforce protection", score: worker === "implemented" ? 80 : worker === "partial" || worker === "planned" ? 50 : worker === "not_in_place" ? 20 : null, weight: 1, basis: `Heat and safety protocols: ${worker ?? "unknown"}.` },
    { id: "recovery", label: "Recovery speed", score: recovery === null ? null : recovery <= 1 ? 85 : recovery <= 7 ? 65 : recovery <= 30 ? 40 : 20, weight: 1, basis: recovery === null ? "No incident recovery times reported." : `Slowest median recovery across hazards: ${recovery} days.` },
  ];
  const result = weighted(dimensions);
  const score = result.score;
  return {
    version: RESILIENCE_VERSION,
    score,
    band: score === null ? null : score >= 70 ? "Strong" : score >= 45 ? "Moderate" : "Weak",
    coverage: result.coverage,
    dimensions: result.dimensions,
  };
}

export type ResilienceProfile = ReturnType<typeof resilienceProfile>;
