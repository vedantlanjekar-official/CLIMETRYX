import { adaptiveCapacityGap, operationalSensitivity, supplyChainVulnerability, type OperationsInput, type ResilienceInput, type SupplierInput } from "@/lib/domain/operations";
import { deriveFinancials, financialSensitivityScore, stressScenario, type FinancialInputs, type StressAssumptions } from "@/lib/financial/metrics";
import { assessDrought, forecastWaterBalance, type WaterStressContext } from "@/lib/hazards/drought";
import { assessFlood, type OfficialWarningInput, type PopulationExposureContext } from "@/lib/hazards/flood";
import { assessHeat, heatProfileForIndustry } from "@/lib/hazards/heat";
import { assessStorm } from "@/lib/hazards/storm";
import { combineHazards } from "@/lib/hazards/combine";
import type { DailyWeather } from "@/lib/hazards/types";
import { recommend } from "@/lib/recommendations/engine";
import { explainScoreChange, scoreVulnerability } from "@/lib/scoring/engine";
import { METHODOLOGY_VERSION, type EvidenceSlot, type ScoreComponentInput, type VulnerabilityScore } from "@/lib/scoring/types";
import type { NdviPathway } from "@/lib/integrations/copernicus/stac";
import type { ClimatologySnapshot } from "@/lib/climatology/service";
import { EMPTY_CONTEXT, FLOOD_WARNING_PATTERN, STORM_WARNING_PATTERN, type SiteContext } from "@/lib/assessments/context";

export interface AssessmentLocationInput {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  userConfirmed: boolean;
  acceptedLowPrecision: boolean;
  precision: string;
}

export interface AssessmentRequest {
  businessName: string;
  industry: string;
  currency: string;
  location: AssessmentLocationInput;
  operations: OperationsInput;
  resilience: ResilienceInput;
  suppliers: SupplierInput[];
  financials: FinancialInputs | null;
  stressAssumptions: StressAssumptions[];
  forecastDays: DailyWeather[] | null;
  forecastRetrievedAt: string | null;
  historical: {
    recent30DayMm: number | null;
    baselineMean30DayMm: number | null;
    baselineYears: number;
    recentDryDays: number | null;
  } | null;
  /** Location-fitted 1991–2020 climatology and current SPI. */
  climatology?: ClimatologySnapshot | null;
  officialWarnings: OfficialWarningInput[];
  populationExposure: PopulationExposureContext | null;
  waterStress: WaterStressContext | null;
  satellite: NdviPathway | null;
  utilityOrigin: "external_observed" | "business_reported" | "model_estimated" | "hypothetical" | "not_provided";
  /** Regional context shown beside the score. Never weighted. */
  context?: SiteContext;
}

export const UTILITY_ORIGIN_LABEL: Record<AssessmentRequest["utilityOrigin"], string> = {
  external_observed: "Utility information comes from an external observed record.",
  business_reported: "Utility information is reported by the business and has not been independently verified.",
  model_estimated: "Utility information is a model estimate, not an observed record.",
  hypothetical: "Utility information is hypothetical.",
  not_provided: "No utility outage record was supplied. Forecast heat or rain is not an outage.",
};

export interface AssessmentResult {
  methodologyVersion: string;
  status: "completed" | "completed_with_limitations" | "needs_configuration" | "failed";
  blockedReason: string | null;
  score: VulnerabilityScore;
  change: ReturnType<typeof explainScoreChange>;
  hazards: ReturnType<typeof combineHazards>;
  financials: ReturnType<typeof deriveFinancials> | null;
  scenarios: ReturnType<typeof stressScenario>[];
  recommendations: ReturnType<typeof recommend>;
  satellite: NdviPathway | null;
  context: SiteContext;
  limitations: string[];
}

export function runAssessment(
  request: AssessmentRequest,
  previous: VulnerabilityScore | null = null,
): AssessmentResult {
  const limitations: string[] = [];
  if (!request.location.userConfirmed && !request.location.acceptedLowPrecision) {
    const empty = scoreVulnerability([], []);
    return {
      methodologyVersion: METHODOLOGY_VERSION,
      status: "failed",
      blockedReason: "Location is unconfirmed. Confirm the pin or explicitly accept lower precision before analysis.",
      score: empty,
      change: explainScoreChange(previous, empty),
      hazards: { score: null, notes: [], indicators: [] },
      financials: null,
      scenarios: [],
      recommendations: [],
      satellite: request.satellite,
      context: request.context ?? EMPTY_CONTEXT,
      limitations: ["Analysis was not run."],
    };
  }
  if (request.location.acceptedLowPrecision) {
    limitations.push("The user accepted lower location precision. Site-specific claims are not supported.");
  }

  const forecast = request.forecastDays;
  const climate = request.climatology ?? null;
  const climateLabel = climate
    ? `ERA5 ${climate.model.baseline.start.slice(0, 4)}–${climate.model.baseline.end.slice(0, 4)} at grid ${climate.model.source.gridLatitude}, ${climate.model.source.gridLongitude} (${climate.model.version})`
    : "";
  const heat = assessHeat(
    forecast ?? [],
    heatProfileForIndustry(request.industry),
    climate ? { values: climate.model.heat, label: climateLabel } : null,
  );
  const flood = assessFlood({
    days: forecast ?? [],
    officialWarnings: request.officialWarnings.filter((warning) => FLOOD_WARNING_PATTERN.test(warning.event)),
    populationExposure: request.populationExposure,
    local: climate ? { values: climate.model.rain, label: climateLabel } : null,
  });
  const drought = assessDrought({
    recent30DayMm: request.historical?.recent30DayMm ?? null,
    baselineMean30DayMm: request.historical?.baselineMean30DayMm ?? null,
    baselineYears: request.historical?.baselineYears ?? 0,
    recentDryDays: request.historical?.recentDryDays ?? null,
    waterStress: request.waterStress,
    spi: climate ? { spi30: climate.spi30, spi90: climate.spi90, label: climateLabel } : null,
    forecastBalance: forecast ? forecastWaterBalance(forecast) : null,
  });
  const storm = assessStorm(
    forecast ?? [],
    request.officialWarnings.some((warning) => STORM_WARNING_PATTERN.test(warning.event)),
    climate ? { values: climate.model.gust, label: climateLabel } : null,
  );
  const hazards = combineHazards([flood, heat, drought, storm]);

  const operations = operationalSensitivity(request.operations);
  const adaptation = adaptiveCapacityGap(request.resilience);
  const supply = supplyChainVulnerability(request.suppliers);
  const financials = request.financials ? deriveFinancials(request.financials) : null;
  const financeScore = financialSensitivityScore(financials?.runwayDays ?? null);

  const components: ScoreComponentInput[] = [
    {
      id: "hazard",
      value: hazards.score,
      evidenceKind: forecast ? "forecast" : "missing",
      source: forecast ? "configured forecast and historical context" : "not retrieved",
      retrievedAt: request.forecastRetrievedAt,
      normalization: hazards.notes[0] ?? "Hazard indicators were combined only where available.",
      notes: hazards.notes,
    },
    {
      id: "operational_sensitivity",
      value: operations.score,
      evidenceKind: "self_reported",
      source: "business questionnaire",
      normalization: operations.normalization,
      notes: operations.notes,
    },
    {
      id: "adaptive_capacity_gap",
      value: adaptation.score,
      evidenceKind: "self_reported",
      source: "resilience questionnaire",
      normalization: adaptation.normalization,
      notes: adaptation.notes,
    },
    {
      id: "supply_chain",
      value: supply.score,
      evidenceKind: "self_reported",
      source: "supplier questionnaire",
      normalization: supply.normalization,
      notes: supply.notes,
    },
    {
      id: "financial_sensitivity",
      value: financeScore,
      evidenceKind: request.financials ? "self_reported" : "missing",
      source: "business financial inputs",
      normalization:
        "Runway bands: under 7 days 90, under 14 days 70, under 30 days 45, under 90 days 25, otherwise 10. Missing inputs are excluded.",
      notes: financials?.notes ?? ["Financial inputs were not supplied."],
    },
  ];

  const evidenceSlots: EvidenceSlot[] = [
    { id: "location", label: "Confirmed or explicitly accepted location", available: true, requiredForComplete: true },
    { id: "forecast", label: "Weather forecast", available: Boolean(forecast && forecast.length > 0), requiredForComplete: true },
    { id: "heat", label: "Heat indicator", available: heat.status !== "not_available", requiredForComplete: false },
    { id: "flood", label: "Flood rainfall or official warning", available: flood.status !== "not_available", requiredForComplete: false },
    { id: "climatology", label: "Location-fitted 1991–2020 climatology", available: climate !== null, requiredForComplete: false },
    { id: "drought", label: "Drought baseline", available: drought.status !== "not_available", requiredForComplete: false },
    { id: "storm", label: "Storm indicator", available: storm.status !== "not_available", requiredForComplete: false },
    { id: "operations", label: "Operations questionnaire", available: operations.score !== null, requiredForComplete: false },
    { id: "adaptation", label: "Resilience questionnaire", available: adaptation.score !== null, requiredForComplete: false },
    { id: "supply", label: "Critical suppliers", available: supply.score !== null, requiredForComplete: false },
    { id: "finance", label: "Financial runway inputs", available: financeScore !== null, requiredForComplete: false },
    {
      id: "satellite",
      label: "Satellite-derived indicator",
      available: request.satellite?.status === "available",
      requiredForComplete: false,
    },
  ];

  const score = scoreVulnerability(components, evidenceSlots);
  const scenarios = (request.financials ? request.stressAssumptions : []).map((assumptions) =>
    stressScenario(request.financials!, assumptions),
  );
  if (!forecast) limitations.push("No forecast was retrieved. Hazard context may be incomplete.");
  if (!climate) limitations.push("No location-fitted climatology was available. Hazards used fixed global screening thresholds only.");
  limitations.push(UTILITY_ORIGIN_LABEL[request.utilityOrigin]);
  if (!request.satellite || request.satellite.status === "not_available") {
    limitations.push(request.satellite?.reason ?? "Satellite indicator is not available.");
  }
  limitations.push(...score.limitations);
  const satelliteMissing = !request.satellite || request.satellite.status === "not_available";
  const environmentalGap =
    !forecast ||
    satelliteMissing ||
    hazards.indicators.some((indicator) => indicator.status === "not_available");
  const status: AssessmentResult["status"] =
    components.every((component) => component.value === null)
      ? "needs_configuration"
      : score.status === "complete" && !environmentalGap
        ? "completed"
        : "completed_with_limitations";
  return {
    methodologyVersion: METHODOLOGY_VERSION,
    status,
    blockedReason: null,
    score,
    change: explainScoreChange(previous, score),
    hazards,
    financials,
    scenarios,
    recommendations: recommend({
      score,
      hazards: hazards.indicators,
      runwayDays: financials?.runwayDays ?? null,
      backupPower: request.resilience.backupPower,
      perishable: request.operations.perishableInventory,
    }),
    satellite: request.satellite,
    context: request.context ?? EMPTY_CONTEXT,
    limitations,
  };
}
