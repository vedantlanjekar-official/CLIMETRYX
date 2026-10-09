import { activeBranches } from "@/lib/questionnaire/engine";
import { findActivity, ISIC_SECTIONS } from "@/lib/questionnaire/industries";
import { MEASURE_CATALOGUE } from "@/lib/questionnaire/steps-risk";
import type { AnswerValue, AssessmentAnswers, IndustryBranch } from "@/lib/questionnaire/types";
import type { DataGap, Hazard } from "./types";

const str = (value: AnswerValue | undefined): string | null => (typeof value === "string" && value.trim() ? value.trim() : null);
const num = (value: AnswerValue | undefined): number | null => (typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null);
const list = (value: AnswerValue | undefined): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);

export type SectorFamily =
  | "manufacturing"
  | "food_cold_chain"
  | "agriculture"
  | "retail"
  | "hospitality"
  | "logistics"
  | "construction"
  | "it_services"
  | "healthcare"
  | "general";

const SECTOR_PRIORITY: Array<[IndustryBranch, SectorFamily]> = [
  ["food_cold_chain", "food_cold_chain"],
  ["agriculture", "agriculture"],
  ["manufacturing", "manufacturing"],
  ["construction", "construction"],
  ["logistics", "logistics"],
  ["hospitality", "hospitality"],
  ["healthcare", "healthcare"],
  ["retail", "retail"],
  ["it_services", "it_services"],
];

export interface MonthlyRecord {
  month: string;
  revenue: number;
  costs: number | null;
}

export interface Supplier {
  name: string;
  product: string | null;
  criticality: string | null;
  spendShare: number | null;
  singleSource: string | null;
  alternative: string | null;
  substitutionDays: number | null;
  bufferDays: number | null;
  region: string | null;
  leadTimeDays: number | null;
  transportMode: string | null;
}

export interface Incident {
  hazard: string;
  occurredOn: string | null;
  durationHours: number | null;
  recoveryDays: number | null;
  estimatedLoss: number | null;
  lossCurrency: string | null;
  insuredClaim: string | null;
  impacts: string[];
  evidence: string | null;
}

export interface CostLine {
  item: string;
  description: string | null;
  amount: number;
  currency: string | null;
  nature: string | null;
  recurrence: string | null;
  estimateType: string | null;
  source: string | null;
  date: string | null;
}

export interface Asset {
  type: string;
  description: string | null;
  replacementValue: number | null;
  currency: string | null;
  belowGround: string | null;
  temperatureSensitive: string | null;
}

/** Monthly figures, converted from annual where the business reported annual totals. */
export interface MonthlyFinancials {
  revenue: number | null;
  fixedCosts: number | null;
  variableCosts: number | null;
  payroll: number | null;
  rent: number | null;
  utilities: number | null;
  debtService: number | null;
}

export interface BusinessProfile {
  name: string;
  activity: string | null;
  activityLabel: string;
  isicSection: string | null;
  sector: SectorFamily;
  branches: IndustryBranch[];
  sizeBand: string | null;
  employeeBand: string | null;
  employees: number | null;
  customerTypes: string[];
  operatingDays: string | null;
  shiftPattern: string | null;
  seasonality: string | null;
  peakMonths: number[];
  operations: {
    electricity: string | null;
    water: string | null;
    cooling: string | null;
    telecom: string | null;
    transport: string | null;
    perishable: string | null;
    outdoorWork: string | null;
    maxDowntimeHours: number | null;
    inventoryDays: number | null;
    commute: string | null;
    criticalEquipment: string | null;
  };
  hazardSensitivity: Record<Hazard, Record<string, AnswerValue>>;
  utilities: Record<"electricity" | "water" | "telecom", { outages: string | null; durationHours: number | null; backup: string | null; backupHours: number | null }>;
  measures: Record<string, string>;
  suppliers: Supplier[];
  incidents: Incident[];
  assets: Asset[];
  costs: CostLine[];
  finance: {
    shared: boolean;
    currency: string;
    period: "monthly" | "annual";
    basis: string | null;
    monthly: MonthlyFinancials;
    cash: number | null;
    undrawnCredit: number | null;
    receivables: number | null;
    payables: number | null;
    inventoryValue: number | null;
    recoveryCost: number | null;
    expectedDowntimeDays: number | null;
    insurance: string | null;
    insuranceExclusions: string | null;
    lostRevenueShare: number | null;
    continuingFixedShare: number | null;
    grossMarginBand: string | null;
  };
  revenueHistory: MonthlyRecord[];
  gaps: DataGap[];
}

function monthlyOf(value: number | null, annual: boolean): number | null {
  return value === null ? null : annual ? value / 12 : value;
}

/** Merges duplicate months and drops future months, keeping the saved order chronological. */
export function cleanHistory(records: MonthlyRecord[], now = new Date()): MonthlyRecord[] {
  const current = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const byMonth = new Map<string, MonthlyRecord>();
  for (const record of records) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(record.month) || record.month > current) continue;
    if (!Number.isFinite(record.revenue) || record.revenue < 0) continue;
    byMonth.set(record.month, record);
  }
  return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
}

export function historyFromAnswers(answers: AssessmentAnswers): MonthlyRecord[] {
  return (answers.groups.revenue_history ?? []).flatMap((row) => {
    const month = str(row.values.month);
    const revenue = num(row.values.revenue);
    if (!month || revenue === null) return [];
    return [{ month, revenue, costs: num(row.values.costs) }];
  });
}

/** Engine A: one validated, unit-consistent view of everything the business told us. */
export function normalizeBusiness(answers: AssessmentAnswers, storedHistory: MonthlyRecord[] = [], now = new Date()): BusinessProfile {
  const values = answers.values;
  const activity = findActivity(values["profile.activity"]);
  const branches = [...activeBranches(answers)];
  const sector = SECTOR_PRIORITY.find(([branch]) => branches.includes(branch))?.[1] ?? "general";
  const shared = values["fin.include"] === "yes";
  const annual = values["fin.period"] === "annual";
  const gaps: DataGap[] = [];

  const hazardSensitivity = Object.fromEntries(
    (["flood", "heat", "drought", "storm"] as const).map((hazard) => {
      const prefix = `hazard.${hazard}.`;
      return [hazard, Object.fromEntries(Object.entries(values).filter(([key]) => key.startsWith(prefix)).map(([key, value]) => [key.slice(prefix.length), value]))];
    }),
  ) as BusinessProfile["hazardSensitivity"];

  const utility = (name: "electricity" | "water" | "telecom") => ({
    outages: str(values[`utility.${name}.outages`]),
    durationHours: num(values[`utility.${name}.duration_hours`]),
    backup: str(values[`utility.${name}.backup`]),
    backupHours: num(values[`utility.${name}.backup_hours`]),
  });

  const suppliers: Supplier[] =
    values["suppliers.has_critical"] === "yes"
      ? (answers.groups.suppliers ?? []).map((row) => {
          const share = num(row.values.spend_share);
          return {
            name: str(row.values.name) ?? "Unnamed supplier",
            product: str(row.values.product),
            criticality: str(row.values.criticality),
            spendShare: share === null ? null : Math.min(share, 100) / 100,
            singleSource: str(row.values.single_source),
            alternative: str(row.values.alternative),
            substitutionDays: num(row.values.substitution_days),
            bufferDays: num(row.values.buffer_days),
            region: [str(row.values.city), str(row.values.country)].filter(Boolean).join(", ") || null,
            leadTimeDays: num(row.values.lead_time_days),
            transportMode: str(row.values.transport_mode),
          };
        })
      : [];

  const incidents: Incident[] =
    values["incidents.any"] === "yes"
      ? (answers.groups.incidents ?? []).map((row) => ({
          hazard: str(row.values.hazard) ?? "other",
          occurredOn: str(row.values.occurred_on),
          durationHours: num(row.values.duration_hours),
          recoveryDays: num(row.values.recovery_days),
          estimatedLoss: num(row.values.estimated_loss),
          lossCurrency: str(row.values.loss_currency),
          insuredClaim: str(row.values.insured_claim),
          impacts: list(row.values.impacts),
          evidence: str(row.values.evidence_type),
        }))
      : [];

  const costs: CostLine[] = (answers.groups.costs ?? []).flatMap((row) => {
    const amount = num(row.values.amount);
    if (amount === null) return [];
    return [{
      item: str(row.values.item) ?? "other",
      description: str(row.values.description),
      amount,
      currency: str(row.values.currency),
      nature: str(row.values.nature),
      recurrence: str(row.values.recurrence),
      estimateType: str(row.values.estimate_type),
      source: str(row.values.source),
      date: str(row.values.estimate_date),
    }];
  });

  const assets: Asset[] = (answers.groups.assets ?? []).map((row) => ({
    type: str(row.values.asset_type) ?? "other",
    description: str(row.values.description),
    replacementValue: num(row.values.replacement_value),
    currency: str(row.values.currency),
    belowGround: str(row.values.below_ground_floor),
    temperatureSensitive: str(row.values.temperature_sensitive),
  }));

  const monthly: MonthlyFinancials = {
    revenue: shared ? monthlyOf(num(values["fin.revenue"]), annual) : null,
    fixedCosts: shared ? monthlyOf(num(values["fin.fixed_costs"]), annual) : null,
    variableCosts: shared ? monthlyOf(num(values["fin.variable_costs"]), annual) : null,
    payroll: shared ? monthlyOf(num(values["fin.payroll"]), annual) : null,
    rent: shared ? monthlyOf(num(values["fin.rent"]), annual) : null,
    utilities: shared ? monthlyOf(num(values["fin.utilities"]), annual) : null,
    debtService: shared ? monthlyOf(num(values["fin.debt_service"]), annual) : null,
  };

  const fromAnswers = historyFromAnswers(answers);
  const revenueHistory = cleanHistory(fromAnswers.length ? fromAnswers : storedHistory, now);

  if (!shared) gaps.push({ area: "Finance", missing: "Financial figures were not shared", effect: "Revenue-at-risk, liquidity and stress-test figures cannot be calculated." });
  else {
    if (monthly.revenue === null) gaps.push({ area: "Finance", missing: "Revenue", effect: "Revenue-at-risk cannot be calculated." });
    if (monthly.fixedCosts === null) gaps.push({ area: "Finance", missing: "Fixed costs", effect: "Liquidity runway cannot be calculated." });
    if (num(values["fin.cash_reserves"]) === null) gaps.push({ area: "Finance", missing: "Cash reserves", effect: "Cash after each scenario cannot be calculated. Missing cash is not treated as zero." });
    if (monthly.debtService === null) gaps.push({ area: "Finance", missing: "Loan repayments", effect: "Debt-service coverage is not shown." });
    if (revenueHistory.length < 12) gaps.push({ area: "Finance", missing: `Monthly revenue history (${revenueHistory.length} of at least 12 months)`, effect: "Revenue cannot be compared with past weather at the site." });
  }
  if (!suppliers.length) gaps.push({ area: "Supply chain", missing: "Critical suppliers", effect: "Supply-chain disruption scenarios are not shown." });
  if (values["incidents.any"] !== "yes" && values["incidents.any"] !== "no") gaps.push({ area: "History", missing: "Disruption history", effect: "Past incidents cannot be matched with climate events." });
  if (num(values["ops.max_downtime_hours"]) === null) gaps.push({ area: "Operations", missing: "Maximum tolerable downtime", effect: "Scenario durations cannot be compared with what the business can absorb." });

  return {
    name: str(values["profile.legal_name"]) ?? "Business",
    activity: activity?.value ?? null,
    activityLabel: activity?.label ?? "Activity not specified",
    isicSection: activity ? `${activity.isicSection} · ${ISIC_SECTIONS[activity.isicSection] ?? ""}` : null,
    sector,
    branches,
    sizeBand: str(values["profile.size_band"]),
    employeeBand: str(values["profile.employee_band"]),
    employees: num(values["profile.employee_count"]),
    customerTypes: list(values["profile.customer_types"]),
    operatingDays: str(values["profile.operating_days"]),
    shiftPattern: str(values["profile.shift_pattern"]),
    seasonality: str(values["profile.seasonality"]),
    peakMonths: list(values["profile.peak_months"]).map(Number).filter((month) => month >= 1 && month <= 12),
    operations: {
      electricity: str(values["ops.electricity_dependency"]),
      water: str(values["ops.water_dependency"]),
      cooling: str(values["ops.cooling_dependency"]),
      telecom: str(values["ops.telecom_dependency"]),
      transport: str(values["ops.transport_dependency"]),
      perishable: str(values["ops.perishable_inventory"]),
      outdoorWork: str(values["ops.outdoor_work"]),
      maxDowntimeHours: num(values["ops.max_downtime_hours"]),
      inventoryDays: num(values["ops.inventory_days"]),
      commute: str(values["ops.workforce_commute"]),
      criticalEquipment: str(values["ops.critical_equipment"]),
    },
    hazardSensitivity,
    utilities: { electricity: utility("electricity"), water: utility("water"), telecom: utility("telecom") },
    measures: Object.fromEntries(MEASURE_CATALOGUE.map((measure) => [measure.key, str(values[`measures.${measure.key}`]) ?? "unknown"])),
    suppliers,
    incidents,
    assets,
    costs,
    finance: {
      shared,
      currency: str(values["fin.currency"]) ?? "INR",
      period: annual ? "annual" : "monthly",
      basis: str(values["fin.basis"]),
      monthly,
      cash: shared ? num(values["fin.cash_reserves"]) : null,
      undrawnCredit: shared ? num(values["fin.undrawn_credit"]) : null,
      receivables: shared ? num(values["fin.receivables"]) : null,
      payables: shared ? num(values["fin.payables"]) : null,
      inventoryValue: shared ? num(values["fin.inventory_value"]) : null,
      recoveryCost: shared ? num(values["fin.recovery_cost"]) : null,
      expectedDowntimeDays: shared ? num(values["fin.expected_downtime_days"]) : null,
      insurance: shared ? str(values["fin.insurance"]) : null,
      insuranceExclusions: shared ? str(values["fin.insurance_exclusions"]) : null,
      lostRevenueShare: shared && num(values["fin.lost_revenue_share"]) !== null ? Math.min(num(values["fin.lost_revenue_share"])!, 100) / 100 : null,
      continuingFixedShare: shared && num(values["fin.continuing_fixed_share"]) !== null ? Math.min(num(values["fin.continuing_fixed_share"])!, 100) / 100 : null,
      grossMarginBand: shared ? str(values["fin.gross_margin_band"]) : null,
    },
    revenueHistory,
    gaps,
  };
}
