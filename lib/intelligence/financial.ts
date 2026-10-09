import type { HazardExposure } from "./exposure";
import type { BusinessProfile } from "./normalize";
import { round, roundOrNull, type Hazard } from "./types";

export const SCENARIO_SET_VERSION = "scenarios-1.0";
const DAYS_PER_MONTH = 30;

export interface FinancialBaseline {
  currency: string;
  monthlyRevenue: number | null;
  dailyRevenue: number | null;
  monthlyFixed: number | null;
  monthlyVariable: number | null;
  dailyFixed: number | null;
  dailyVariable: number | null;
  monthlySurplus: number | null;
  operatingMarginPct: number | null;
  contributionMarginPct: number | null;
  cash: number | null;
  undrawnCredit: number | null;
  runwayDays: number | null;
  runwayWithCreditDays: number | null;
  monthlyDebtService: number | null;
  debtServiceCoverage: number | null;
  receivableDays: number | null;
  payableDays: number | null;
  workingCapital: number | null;
  dailyGrossMarginAtRisk: number | null;
  toleranceDays: number | null;
  toleranceCost: number | null;
  notes: string[];
}

export interface ScenarioParameter {
  name: string;
  value: string;
  origin: "business_reported" | "incident_history" | "platform_assumption" | "forecast";
}

export interface ScenarioResult {
  id: string;
  label: string;
  hazard: Hazard | "supply" | "compound";
  description: string;
  available: boolean;
  unavailableReason: string | null;
  days: number | null;
  outputLoss: number | null;
  parameters: ScenarioParameter[];
  revenueLost: number | null;
  variableCostAvoided: number | null;
  marginLost: number | null;
  recoveryCost: number | null;
  cashImpact: number | null;
  cashAfter: number | null;
  runwayAfterDays: number | null;
  impactPctMonthlyRevenue: number | null;
  impactPctAnnualRevenue: number | null;
  stressedDebtServiceCoverage: number | null;
  exceedsTolerance: boolean | null;
  insuranceNote: string;
}

export const SCENARIO_FORMULA =
  "revenue lost = daily revenue × disruption days × output lost; variable costs avoided = daily variable costs × days × output lost; margin lost = revenue lost − variable costs avoided; cash impact = margin lost + one-off recovery cost. Fixed costs are not added again because they are paid in a normal month too. Cash after = cash reserves − cash impact. These are hypothetical scenarios, not predicted losses.";

export function financialBaseline(business: BusinessProfile): FinancialBaseline {
  const finance = business.finance;
  const { revenue, fixedCosts, variableCosts, debtService } = finance.monthly;
  const notes = ["Daily figures divide monthly amounts by 30 (annual figures were first divided by 12). This is an accounting convention, not observed daily cash flow."];
  const dailyRevenue = revenue === null ? null : revenue / DAYS_PER_MONTH;
  const dailyFixed = fixedCosts === null ? null : fixedCosts / DAYS_PER_MONTH;
  const dailyVariable = variableCosts === null ? null : variableCosts / DAYS_PER_MONTH;
  const monthlySurplus = revenue !== null && fixedCosts !== null ? revenue - fixedCosts - (variableCosts ?? 0) : null;
  if (monthlySurplus !== null && variableCosts === null) notes.push("Variable costs were not supplied, so the monthly surplus treats them as zero and is an upper bound.");
  const runway = (amount: number | null) => (amount === null || dailyFixed === null || dailyFixed === 0 ? null : amount / dailyFixed);
  const debtCoverage = monthlySurplus !== null && debtService !== null && debtService > 0 ? monthlySurplus / debtService : null;
  if (debtCoverage !== null) notes.push("Debt-service coverage is monthly surplus divided by loan repayments. If fixed costs already include loan interest, coverage is understated.");
  const lost = finance.lostRevenueShare ?? 1;
  const dailyMargin = dailyRevenue === null ? null : (dailyRevenue - (dailyVariable ?? 0)) * lost;
  const toleranceDays = business.operations.maxDowntimeHours === null ? null : business.operations.maxDowntimeHours / 24;
  const workingCapital =
    finance.receivables === null && finance.inventoryValue === null && finance.payables === null
      ? null
      : (finance.receivables ?? 0) + (finance.inventoryValue ?? 0) - (finance.payables ?? 0);
  return {
    currency: finance.currency,
    monthlyRevenue: roundOrNull(revenue),
    dailyRevenue: roundOrNull(dailyRevenue),
    monthlyFixed: roundOrNull(fixedCosts),
    monthlyVariable: roundOrNull(variableCosts),
    dailyFixed: roundOrNull(dailyFixed),
    dailyVariable: roundOrNull(dailyVariable),
    monthlySurplus: roundOrNull(monthlySurplus),
    operatingMarginPct: revenue && monthlySurplus !== null ? round((monthlySurplus / revenue) * 100, 1) : null,
    contributionMarginPct: revenue && variableCosts !== null ? round(((revenue - variableCosts) / revenue) * 100, 1) : null,
    cash: finance.cash,
    undrawnCredit: finance.undrawnCredit,
    runwayDays: roundOrNull(runway(finance.cash)),
    runwayWithCreditDays: finance.undrawnCredit === null ? null : roundOrNull(runway((finance.cash ?? 0) + finance.undrawnCredit)),
    monthlyDebtService: roundOrNull(debtService),
    debtServiceCoverage: roundOrNull(debtCoverage, 2),
    receivableDays: finance.receivables !== null && dailyRevenue ? roundOrNull(finance.receivables / dailyRevenue) : null,
    payableDays: finance.payables !== null && dailyVariable ? roundOrNull(finance.payables / dailyVariable) : null,
    workingCapital: roundOrNull(workingCapital),
    dailyGrossMarginAtRisk: roundOrNull(dailyMargin),
    toleranceDays: roundOrNull(toleranceDays, 1),
    toleranceCost: dailyMargin !== null && toleranceDays !== null ? roundOrNull(dailyMargin * toleranceDays) : null,
    notes,
  };
}

interface ScenarioSpec {
  id: string;
  label: string;
  hazard: ScenarioResult["hazard"];
  description: string;
  days: number | null;
  outputLoss: number | null;
  withRecoveryCost: boolean;
  parameters: ScenarioParameter[];
  unavailableReason?: string;
}

function insuranceNote(insurance: string | null, hazard: ScenarioResult["hazard"]): string {
  if (insurance === "property_bi") return "Business-interruption cover is reported. Payout depends on policy terms, deductibles and exclusions, so no recovery is netted off.";
  if (insurance === "property") return hazard === "flood" || hazard === "storm" || hazard === "compound" ? "Property or stock cover may offset physical damage but not lost revenue. Nothing is netted off." : "Property cover does not usually respond to lost output. Nothing is netted off.";
  if (insurance === "none") return "No insurance is reported, so the full impact falls on the business.";
  return "Insurance status is unknown, so no recovery is assumed.";
}

export function supplyGapDays(business: BusinessProfile): { days: number | null; supplier: string | null; substitutionDays: number | null; bufferDays: number | null } {
  let best: { days: number; supplier: string; substitutionDays: number; bufferDays: number } | null = null;
  for (const supplier of business.suppliers.filter((item) => item.criticality === "critical")) {
    if (supplier.substitutionDays === null) continue;
    const bufferDays = supplier.bufferDays ?? 0;
    const gap = Math.max(0, supplier.substitutionDays - bufferDays);
    if (!best || gap > best.days) best = { days: gap, supplier: supplier.name, substitutionDays: supplier.substitutionDays, bufferDays };
  }
  return best ?? { days: null, supplier: null, substitutionDays: null, bufferDays: null };
}

function supplyDescription(supply: ReturnType<typeof supplyGapDays>): string {
  if (!supply.supplier) return "A critical supplier stops delivering.";
  if (supply.days === 0) {
    return `Supply from ${supply.supplier} stops. Its substitute is expected within ${supply.substitutionDays} day(s), before the ${supply.bufferDays}-day buffer stock runs out, so no output is lost on the reported figures.`;
  }
  return `Supply from ${supply.supplier} stops; output halts once buffer stock runs out and until a substitute is in place.`;
}

export function scenarioSpecs(business: BusinessProfile, exposure: HazardExposure[]): ScenarioSpec[] {
  const lost = business.finance.lostRevenueShare;
  const lostParam: ScenarioParameter = lost === null
    ? { name: "Output lost on a stoppage day", value: "100%", origin: "platform_assumption" }
    : { name: "Output lost on a stoppage day", value: `${round(lost * 100)}%`, origin: "business_reported" };
  const fullLoss = lost ?? 1;
  const floodIncidents = exposure.find((item) => item.hazard === "flood")?.incidents;
  const expected = business.finance.expectedDowntimeDays;
  const floodDays = floodIncidents?.medianRecoveryDays ?? expected ?? 3;
  const floodOrigin: ScenarioParameter["origin"] = floodIncidents?.medianRecoveryDays != null ? "incident_history" : expected !== null ? "business_reported" : "platform_assumption";
  const drought = business.hazardSensitivity.drought.effect;
  const droughtLoss = drought === "stops" ? 1 : drought === "reduces" ? 0.5 : drought === "minor" ? 0.1 : drought === "none" ? 0 : null;
  const supply = supplyGapDays(business);

  const specs: ScenarioSpec[] = [
    {
      id: "heat_moderate",
      label: "Moderate heatwave",
      hazard: "heat",
      description: "Five hot days during which output falls by a quarter.",
      days: 5,
      outputLoss: 0.25,
      withRecoveryCost: false,
      parameters: [
        { name: "Affected days", value: "5", origin: "platform_assumption" },
        { name: "Output lost", value: "25%", origin: "platform_assumption" },
      ],
    },
    {
      id: "heat_severe",
      label: "Severe heatwave",
      hazard: "heat",
      description: "Ten very hot days during which output halves.",
      days: 10,
      outputLoss: 0.5,
      withRecoveryCost: false,
      parameters: [
        { name: "Affected days", value: "10", origin: "platform_assumption" },
        { name: "Output lost", value: "50%", origin: "platform_assumption" },
      ],
    },
    {
      id: "flood_disruption",
      label: "Heavy rainfall and flood disruption",
      hazard: "flood",
      description: "The site stops while water clears and the business recovers, then pays its one-off recovery cost.",
      days: floodDays,
      outputLoss: fullLoss,
      withRecoveryCost: true,
      parameters: [
        { name: "Stoppage days", value: String(round(floodDays, 1)), origin: floodOrigin },
        lostParam,
        { name: "Recovery cost", value: business.finance.recoveryCost === null ? "not supplied" : "business estimate", origin: "business_reported" },
      ],
    },
    {
      id: "water_stress",
      label: "Week-long water shortage",
      hazard: "drought",
      description: "Seven days of restricted water supply, with output loss taken from the business's own answer.",
      days: 7,
      outputLoss: droughtLoss,
      withRecoveryCost: false,
      parameters: [
        { name: "Affected days", value: "7", origin: "business_reported" },
        { name: "Output lost", value: droughtLoss === null ? "unknown" : `${round(droughtLoss * 100)}% (from “${drought}”)`, origin: "platform_assumption" },
      ],
      unavailableReason: droughtLoss === null ? "The effect of a water shortage was not answered." : undefined,
    },
    {
      id: "supply_disruption",
      label: "Critical supplier disruption",
      hazard: "supply",
      description: supplyDescription(supply),
      days: supply.days,
      outputLoss: fullLoss,
      withRecoveryCost: false,
      parameters: [
        { name: "Days without input (switching time minus buffer)", value: supply.days === null ? "unknown" : String(supply.days), origin: "business_reported" },
        lostParam,
      ],
      unavailableReason: supply.days === null ? "No critical supplier with a switching time was entered." : undefined,
    },
  ];
  const floodSpec = specs.find((spec) => spec.id === "flood_disruption")!;
  const compoundDays = supply.days === null ? floodDays : Math.max(floodDays, supply.days);
  specs.push({
    id: "compound",
    label: "Compound: flood with supplier delay",
    hazard: "compound",
    description: "A flood stops the site and delays the critical supplier at the same time. Overlapping days are counted once.",
    days: compoundDays,
    outputLoss: fullLoss,
    withRecoveryCost: true,
    parameters: [
      { name: "Combined stoppage days (overlap counted once)", value: String(round(compoundDays, 1)), origin: supply.days === null ? floodSpec.parameters[0]!.origin : "business_reported" },
      lostParam,
    ],
  });
  return specs;
}

export function runScenario(spec: ScenarioSpec, base: FinancialBaseline, business: BusinessProfile): ScenarioResult {
  const empty = {
    revenueLost: null, variableCostAvoided: null, marginLost: null, recoveryCost: null, cashImpact: null, cashAfter: null,
    runwayAfterDays: null, impactPctMonthlyRevenue: null, impactPctAnnualRevenue: null, stressedDebtServiceCoverage: null,
  };
  const common = {
    id: spec.id, label: spec.label, hazard: spec.hazard, description: spec.description, days: spec.days, outputLoss: spec.outputLoss,
    parameters: spec.parameters, insuranceNote: insuranceNote(business.finance.insurance, spec.hazard),
    exceedsTolerance: spec.days === null || base.toleranceDays === null ? null : spec.days > base.toleranceDays,
  };
  if (spec.unavailableReason || spec.days === null || spec.outputLoss === null) {
    return { ...common, ...empty, available: false, unavailableReason: spec.unavailableReason ?? "Scenario inputs are missing." };
  }
  if (!business.finance.shared || base.dailyRevenue === null) {
    return { ...common, ...empty, available: false, unavailableReason: business.finance.shared ? "Revenue was not supplied." : "Financial figures were not shared." };
  }
  const { revenue, variableCosts, fixedCosts } = business.finance.monthly;
  const dailyRevenue = (revenue ?? 0) / DAYS_PER_MONTH;
  const dailyVariable = variableCosts === null ? null : variableCosts / DAYS_PER_MONTH;
  const dailyFixed = fixedCosts === null ? null : fixedCosts / DAYS_PER_MONTH;
  const revenueLost = dailyRevenue * spec.days * spec.outputLoss;
  const avoided = dailyVariable === null ? 0 : dailyVariable * spec.days * spec.outputLoss;
  const marginLost = revenueLost - avoided;
  const recovery = spec.withRecoveryCost ? business.finance.recoveryCost : null;
  const cashImpact = marginLost + (recovery ?? 0);
  const cashAfter = base.cash === null ? null : base.cash - cashImpact;
  const months = Math.max(1, spec.days / DAYS_PER_MONTH);
  const stressedSurplus = base.monthlySurplus === null ? null : base.monthlySurplus - cashImpact / months;
  return {
    ...common,
    available: true,
    unavailableReason: null,
    revenueLost: round(revenueLost),
    variableCostAvoided: dailyVariable === null ? null : round(avoided),
    marginLost: round(marginLost),
    recoveryCost: recovery,
    cashImpact: round(cashImpact),
    cashAfter: roundOrNull(cashAfter),
    runwayAfterDays: cashAfter === null || !dailyFixed ? null : round(Math.max(0, cashAfter) / dailyFixed),
    impactPctMonthlyRevenue: base.monthlyRevenue ? round((cashImpact / base.monthlyRevenue) * 100, 1) : null,
    impactPctAnnualRevenue: base.monthlyRevenue ? round((cashImpact / (base.monthlyRevenue * 12)) * 100, 2) : null,
    stressedDebtServiceCoverage: stressedSurplus !== null && base.monthlyDebtService ? round(stressedSurplus / base.monthlyDebtService, 2) : null,
  };
}

/** Engine F: baseline financial position and a fixed set of hypothetical disruption scenarios. */
export function financialImpact(business: BusinessProfile, exposure: HazardExposure[]) {
  const baseline = financialBaseline(business);
  const scenarios = scenarioSpecs(business, exposure).map((spec) => runScenario(spec, baseline, business));
  const available = scenarios.filter((item) => item.available && item.cashImpact !== null);
  const worst = available.length ? available.reduce((a, b) => ((b.cashImpact ?? 0) > (a.cashImpact ?? 0) ? b : a)) : null;
  return { baseline, scenarios, worstScenarioId: worst?.id ?? null, formula: SCENARIO_FORMULA, version: SCENARIO_SET_VERSION };
}

export type FinancialImpact = ReturnType<typeof financialImpact>;
