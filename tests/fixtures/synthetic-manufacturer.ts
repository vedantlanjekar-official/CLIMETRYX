/**
 * SYNTHETIC TEST DATA. "Shakti Auto Components (synthetic)" is an invented manufacturing MSME used only
 * to exercise the report pipeline end to end. None of these figures describe a real business or real weather.
 */
import { runAssessment } from "@/lib/assessments/pipeline";
import type { DailyWeather } from "@/lib/hazards/types";
import type { ClimateMonth } from "@/lib/intelligence/history";
import { buildAnalysisPackage, snapshotHash } from "@/lib/intelligence/snapshot";
import { buildAssessmentRequest, sitesForAnalysis, type EnvironmentInputs } from "@/lib/questionnaire/mapping";
import type { AnswerValue, AssessmentAnswers, RepeatRow } from "@/lib/questionnaire/types";
import { buildReportModel } from "@/lib/reports/model";

export const SYNTHETIC_NOW = new Date("2026-10-09T06:30:00Z");

const row = (id: string, values: Record<string, AnswerValue>): RepeatRow => ({ id, values });

/** 18 months of invented revenue with a monsoon dip (Jul–Sep) and a summer dip (May). */
export const SYNTHETIC_REVENUE = [
  ["2025-04", 2_400_000], ["2025-05", 2_150_000], ["2025-06", 2_300_000], ["2025-07", 1_850_000], ["2025-08", 1_780_000], ["2025-09", 1_950_000],
  ["2025-10", 2_500_000], ["2025-11", 2_600_000], ["2025-12", 2_550_000], ["2026-01", 2_450_000], ["2026-02", 2_480_000], ["2026-03", 2_700_000],
  ["2026-04", 2_420_000], ["2026-05", 2_100_000], ["2026-06", 2_250_000], ["2026-07", 1_800_000], ["2026-08", 1_750_000], ["2026-09", 1_980_000],
] as const;

export function syntheticAnswers(): AssessmentAnswers {
  return {
    values: {
      "profile.legal_name": "Shakti Auto Components (synthetic)",
      "profile.activity": "auto_components",
      "profile.size_band": "small",
      "profile.employee_count": 48,
      "profile.customer_types": ["b2b"],
      "profile.operating_days": "six",
      "profile.shift_pattern": "two",
      "profile.seasonality": "moderate",
      "profile.peak_months": ["10", "11", "3"],
      "ops.electricity_dependency": "critical",
      "ops.water_dependency": "moderate",
      "ops.cooling_dependency": "moderate",
      "ops.telecom_dependency": "moderate",
      "ops.transport_dependency": "high",
      "ops.perishable_inventory": "no",
      "ops.outdoor_work": "no",
      "ops.max_downtime_hours": 48,
      "ops.inventory_days": 10,
      "ops.critical_equipment": "CNC machining centres and a heat-treatment furnace",
      "hazard.flood.water_entry": "occasional",
      "hazard.flood.access_cut": "yes",
      "hazard.heat.cooling": "fans",
      "hazard.heat.sensitive_processes": "yes",
      "hazard.heat.stop_temp_c": 40,
      "hazard.drought.effect": "reduces",
      "hazard.drought.rainfall_dependent": "no",
      "hazard.storm.roof": "metal_sheet",
      "hazard.storm.outdoor_assets": "yes",
      "utility.electricity.outages": "monthly",
      "utility.electricity.duration_hours": 3,
      "utility.electricity.backup": "partial",
      "utility.electricity.evidence": "own_logs",
      "utility.water.outages": "yearly",
      "utility.water.duration_hours": 12,
      "utility.water.backup": "partial",
      "utility.water.evidence": "recollection",
      "measures.drainage": "partial",
      "measures.floodProtection": "not_in_place",
      "measures.inventoryProtection": "partial",
      "measures.cooling": "partial",
      "measures.backupPower": "implemented",
      "measures.waterStorage": "implemented",
      "measures.emergencyProcedures": "not_in_place",
      "measures.alternateSuppliers": "not_in_place",
      "measures.bufferStock": "planned",
      "measures.backupSite": "not_in_place",
      "measures.workerSafety": "partial",
      "measures.insurance": "partial",
      "measures.continuityPlan": "not_in_place",
      "incidents.any": "yes",
      "suppliers.has_critical": "yes",
      "fin.include": "yes",
      "fin.currency": "INR",
      "fin.period": "monthly",
      "fin.basis": "management",
      "fin.revenue": 2_300_000,
      "fin.fixed_costs": 780_000,
      "fin.variable_costs": 1_150_000,
      "fin.cash_reserves": 1_400_000,
      "fin.undrawn_credit": 500_000,
      "fin.receivables": 2_100_000,
      "fin.payables": 1_300_000,
      "fin.inventory_value": 900_000,
      "fin.debt_service": 210_000,
      "fin.recovery_cost": 350_000,
      "fin.expected_downtime_days": 4,
      "fin.insurance": "property",
      "fin.gross_margin_band": "25-40",
    },
    groups: {
      sites: [
        row("site-1", { label: "Chakan plant (synthetic)", site_type: "factory", site_status: "active", is_primary: true, point_lat: 18.7606, point_lon: 73.8636, point_confirmation: "confirmed_pin" }),
      ],
      suppliers: [
        row("sup-1", { name: "Synthetic steel bar mill", product: "Alloy steel bar", criticality: "critical", spend_share: 45, single_source: "yes", alternative: "no", substitution_days: 21, buffer_days: 7, city: "Jamshedpur", country: "India" }),
        row("sup-2", { name: "Synthetic forging partner", product: "Rough forgings", criticality: "important", spend_share: 20, single_source: "no", alternative: "yes", substitution_days: 10, buffer_days: 5, city: "Pune", country: "India" }),
        row("sup-3", { name: "Synthetic packaging vendor", product: "Crates", criticality: "optional", spend_share: 5, single_source: "no", alternative: "yes", substitution_days: 2, buffer_days: 15, city: "Pune", country: "India" }),
      ],
      incidents: [
        row("inc-1", { hazard: "flood", occurred_on: "2025-07-24", duration_hours: 72, recovery_days: 5, estimated_loss: 420_000, loss_currency: "INR", insured_claim: "no", impacts: ["access", "production"], evidence_type: "photos" }),
        row("inc-2", { hazard: "power_outage", occurred_on: "2026-05-12", duration_hours: 9, recovery_days: 1, estimated_loss: 60_000, loss_currency: "INR", insured_claim: "no", impacts: ["production"], evidence_type: "recollection" }),
      ],
      revenue_history: SYNTHETIC_REVENUE.map(([month, revenue], index) => row(`rev-${index}`, { month, revenue, costs: Math.round(revenue * 0.82) })),
    },
  };
}

const forecast: DailyWeather[] = Array.from({ length: 7 }, (_, index) => ({
  date: `2026-10-${String(9 + index).padStart(2, "0")}`,
  temperatureMaxC: [33, 34, 36, 37, 35, 32, 31][index]!,
  temperatureMinC: 22,
  precipitationMm: [0, 2, 0, 0, 18, 71, 24][index]!,
  precipitationProbabilityPct: [10, 20, 5, 5, 60, 85, 70][index]!,
  windGustMps: [6, 7, 8, 7, 12, 18, 11][index]!,
  windSpeedMps: 3,
  humidityMeanPct: 60,
  apparentTemperatureMaxC: null,
  wetBulbMaxC: [24, 25, 26, 26, 25, 24, 24][index]!,
  et0Mm: 4,
  precipitationHours: null,
  capeMaxJkg: null,
  rootZoneSoilMoisture: null,
}));

/** Invented monthly weather matching the revenue months: wetter months have lower revenue. */
export function syntheticClimateMonths(): ClimateMonth[] {
  const rain: Record<string, number> = { "04": 10, "05": 35, "06": 180, "07": 420, "08": 380, "09": 210, "10": 90, "11": 20, "12": 5, "01": 2, "02": 3, "03": 6 };
  const tmax: Record<string, number> = { "04": 37, "05": 38.5, "06": 33, "07": 29, "08": 28.5, "09": 30, "10": 31.5, "11": 30.5, "12": 29.5, "01": 29.5, "02": 32, "03": 35.5 };
  return SYNTHETIC_REVENUE.map(([month]) => {
    const calendar = month.slice(5, 7);
    return { month, meanTmaxC: tmax[calendar]!, precipMm: rain[calendar]!, hotDays: tmax[calendar]! >= 36 ? 14 : tmax[calendar]! >= 34 ? 4 : 0, heavyRainDays: rain[calendar]! >= 300 ? 2 : 0, days: 30 };
  });
}

export async function syntheticModel() {
  const answers = syntheticAnswers();
  const [site] = sitesForAnalysis(answers);
  const environment: EnvironmentInputs = { forecastDays: forecast, forecastRetrievedAt: SYNTHETIC_NOW.toISOString(), historical: null, climatology: null, satellite: null };
  const request = buildAssessmentRequest(answers, site!, environment);
  const result = runAssessment(request);
  const model = await buildReportModel(request, result, SYNTHETIC_NOW);
  model.narrative = { ...model.narrative, generatedAt: SYNTHETIC_NOW.toISOString() };
  return { answers, model };
}

export async function syntheticPackage(options: { withClimate?: boolean; stale?: boolean } = {}) {
  const { answers, model } = await syntheticModel();
  const pkg = buildAnalysisPackage({
    model,
    answers,
    climateMonths: options.withClimate === false ? null : syntheticClimateMonths(),
    climateMonthsSource: options.withClimate === false ? null : "SYNTHETIC monthly weather (test fixture)",
    assessment: { id: "00000000-0000-4000-8000-000000000001", createdAt: SYNTHETIC_NOW.toISOString(), status: model.result.status, stale: Boolean(options.stale), staleReason: options.stale ? "Synthetic stale flag" : null },
    now: SYNTHETIC_NOW,
  });
  return { answers, model, pkg, hash: snapshotHash(pkg) };
}
