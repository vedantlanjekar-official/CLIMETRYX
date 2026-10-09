export type ReportingPeriod = "monthly" | "annual";

export interface FinancialInputs {
  currency: string;
  period: ReportingPeriod;
  revenue: number | null;
  fixedCosts: number | null;
  variableCosts: number | null;
  cashReserves: number | null;
  recoveryCost: number | null;
}

export interface StressAssumptions {
  disruptionDays: 1 | 3 | 7 | 14;
  /** Share of revenue assumed lost on each disruption day. User assumption, not a forecast. */
  lostRevenueFraction: number;
  /** Share of fixed costs that continue during the disruption. */
  continuingFixedFraction: number;
  /** Share of variable costs that continue during the disruption. */
  continuingVariableFraction: number;
}

export interface DerivedFinancials {
  currency: string;
  period: ReportingPeriod;
  dailyRevenue: number | null;
  dailyFixedCost: number | null;
  fixedCostShare: number | null;
  runwayDays: number | null;
  notes: string[];
}

export interface StressScenarioResult {
  label: string;
  hypothetical: true;
  currency: string;
  disruptionDays: number;
  revenueAtRisk: number | null;
  continuingCosts: number | null;
  recoveryCost: number | null;
  cashAfterScenario: number | null;
  cashCoversScenario: boolean | null;
  formula: string;
  assumptions: StressAssumptions;
  missing: string[];
}

const DAYS: Record<ReportingPeriod, number> = { monthly: 30, annual: 365 };

export function assertFraction(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${name} must be between 0 and 1.`);
  }
}

export function toDaily(amount: number, period: ReportingPeriod): number {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Amount must be a non-negative finite number.");
  }
  return amount / DAYS[period];
}

export function deriveFinancials(input: FinancialInputs): DerivedFinancials {
  const notes: string[] = [
    "Daily figures divide monthly amounts by 30 and annual amounts by 365. They are accounting conventions, not observed daily cash flows.",
  ];
  const dailyRevenue =
    input.revenue === null ? null : toDaily(input.revenue, input.period);
  const dailyFixedCost =
    input.fixedCosts === null ? null : toDaily(input.fixedCosts, input.period);
  let fixedCostShare: number | null = null;
  if (input.fixedCosts !== null && input.variableCosts !== null) {
    const total = input.fixedCosts + input.variableCosts;
    fixedCostShare = total > 0 ? input.fixedCosts / total : null;
    if (total === 0) notes.push("Fixed-cost share is unavailable because both cost inputs are zero.");
  } else {
    notes.push("Fixed-cost share needs both fixed and variable costs.");
  }
  let runwayDays: number | null = null;
  if (input.cashReserves === null || dailyFixedCost === null) {
    notes.push("Liquidity runway needs cash reserves and fixed costs. Missing cash is not treated as zero.");
  } else if (dailyFixedCost === 0) {
    notes.push("Runway is undefined because fixed costs are zero.");
  } else {
    runwayDays = input.cashReserves / dailyFixedCost;
  }
  return {
    currency: input.currency,
    period: input.period,
    dailyRevenue,
    dailyFixedCost,
    fixedCostShare,
    runwayDays,
    notes,
  };
}

export function financialSensitivityScore(runwayDays: number | null): number | null {
  if (runwayDays === null || !Number.isFinite(runwayDays)) return null;
  if (runwayDays < 7) return 90;
  if (runwayDays < 14) return 70;
  if (runwayDays < 30) return 45;
  if (runwayDays < 90) return 25;
  return 10;
}

export function stressScenario(
  input: FinancialInputs,
  assumptions: StressAssumptions,
): StressScenarioResult {
  assertFraction("lostRevenueFraction", assumptions.lostRevenueFraction);
  assertFraction("continuingFixedFraction", assumptions.continuingFixedFraction);
  assertFraction("continuingVariableFraction", assumptions.continuingVariableFraction);
  const derived = deriveFinancials(input);
  const missing: string[] = [];
  const revenueAtRisk =
    derived.dailyRevenue === null
      ? null
      : derived.dailyRevenue * assumptions.disruptionDays * assumptions.lostRevenueFraction;
  if (derived.dailyRevenue === null) missing.push("revenue");
  const continuingFixed =
    derived.dailyFixedCost === null
      ? null
      : derived.dailyFixedCost * assumptions.disruptionDays * assumptions.continuingFixedFraction;
  if (derived.dailyFixedCost === null) missing.push("fixed costs");
  const continuingVariable =
    input.variableCosts === null
      ? null
      : toDaily(input.variableCosts, input.period) *
        assumptions.disruptionDays *
        assumptions.continuingVariableFraction;
  if (input.variableCosts === null) missing.push("variable costs");
  const continuingCosts =
    continuingFixed === null && continuingVariable === null
      ? null
      : (continuingFixed ?? 0) + (continuingVariable ?? 0);
  const recoveryCost = input.recoveryCost;
  if (recoveryCost === null) missing.push("recovery cost");
  const outflow =
    continuingCosts === null && recoveryCost === null
      ? null
      : (continuingCosts ?? 0) + (recoveryCost ?? 0);
  const cashAfterScenario =
    input.cashReserves === null || outflow === null ? null : input.cashReserves - outflow;
  if (input.cashReserves === null) missing.push("cash reserves");
  return {
    label: `${assumptions.disruptionDays}-day hypothetical disruption`,
    hypothetical: true,
    currency: input.currency,
    disruptionDays: assumptions.disruptionDays,
    revenueAtRisk,
    continuingCosts,
    recoveryCost,
    cashAfterScenario,
    cashCoversScenario: cashAfterScenario === null ? null : cashAfterScenario >= 0,
    formula:
      "revenue at risk = daily revenue × disruption days × lost-revenue fraction; continuing costs = daily fixed × days × continuing-fixed fraction + daily variable × days × continuing-variable fraction; cash after = cash reserves − continuing costs − recovery cost. This is a scenario, not a predicted loss.",
    assumptions,
    missing,
  };
}
