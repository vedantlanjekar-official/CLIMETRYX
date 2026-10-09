import { createHash } from "node:crypto";
import { stableStringify } from "@/lib/questionnaire/mapping";
import type { AssessmentAnswers } from "@/lib/questionnaire/types";
import type { ReportModel, ReportSource } from "@/lib/reports/model";
import { adaptationPlan } from "./adaptation";
import { summarizeClimate } from "./climate";
import { assessExposure } from "./exposure";
import { financialImpact } from "./financial";
import { matchHistory, type ClimateMonth } from "./history";
import { normalizeBusiness, type MonthlyRecord } from "./normalize";
import { operationalProfile, supplyChainProfile } from "./profiles";
import { climateAdjustedRisk, resilienceProfile } from "./risk";
import { ENGINE_VERSION, type DataGap } from "./types";

const REVENUE_WEATHER_SOURCE = "Historical weather for revenue months";

export interface SnapshotInput {
  model: ReportModel;
  answers: AssessmentAnswers;
  storedHistory?: MonthlyRecord[];
  climateMonths?: ClimateMonth[] | null;
  climateMonthsSource?: string | null;
  climateMonthsRetrievedAt?: string | null;
  assessment: { id: string; createdAt: string; status: string; stale: boolean; staleReason: string | null };
  now?: Date;
}

/** Everything a report needs, computed once by deterministic engines. AI only ever reads this; it never changes it. */
export function buildAnalysisPackage(input: SnapshotInput) {
  const now = input.now ?? new Date();
  const business = normalizeBusiness(input.answers, input.storedHistory ?? [], now);
  const heatThreshold = typeof input.answers.values["hazard.heat.stop_temp_c"] === "number" ? (input.answers.values["hazard.heat.stop_temp_c"] as number) : null;
  const climate = summarizeClimate(input.model, heatThreshold);
  const exposure = assessExposure(business, climate);
  const finance = financialImpact(business, exposure);
  const history = matchHistory(business.revenueHistory, input.climateMonths ?? null, business.incidents, input.climateMonthsSource ?? null);
  const risk = climateAdjustedRisk(input.model, exposure, finance);
  const resilience = resilienceProfile(input.model, business, finance, exposure);
  const adaptation = adaptationPlan(input.model, business, exposure, finance);
  const supply = supplyChainProfile(business);
  const operations = operationalProfile(business, finance);
  const sources: ReportSource[] = [
    ...input.model.sources,
    {
      name: "Business questionnaire",
      attribution: `Answers submitted by ${business.name}`,
      licence: "Business-reported; restricted financial fields visible to owner, admin and analyst roles only",
      retrievedAt: input.assessment.createdAt,
      validFrom: null,
      validTo: null,
      resolution: "Business level",
    },
  ];
  if (history.source) {
    sources.push({ name: REVENUE_WEATHER_SOURCE, attribution: history.source, licence: "Copernicus Climate Change Service (ERA5); Open-Meteo CC BY 4.0", retrievedAt: input.climateMonthsRetrievedAt ?? null, validFrom: history.window.from, validTo: history.window.to, resolution: "About 25 km" });
  }
  const gaps: DataGap[] = [...business.gaps];
  for (const slot of input.model.result.score.evidenceSlots.filter((item) => !item.available)) {
    gaps.push({ area: "Evidence", missing: slot.label, effect: slot.requiredForComplete ? "The assessment is incomplete without it." : "Shown as unavailable; not treated as safe." });
  }
  return {
    engineVersion: ENGINE_VERSION,
    createdAt: now.toISOString(),
    assessment: {
      ...input.assessment,
      methodology: input.model.result.methodologyVersion,
      vulnerabilityScore: input.model.result.score.score,
      vulnerabilityBand: input.model.result.score.band,
      evidenceCompleteness: input.model.result.score.evidenceCompleteness,
      components: input.model.result.score.components.map((item) => ({ id: item.id, label: item.label, score: item.score, weight: item.effectiveWeight, included: item.included })),
    },
    site: { label: input.model.site.label, latitude: input.model.site.latitude, longitude: input.model.site.longitude, precision: input.model.site.precision },
    business,
    climate,
    exposure,
    finance,
    history,
    risk,
    resilience,
    adaptation,
    supply,
    operations,
    recommendations: input.model.result.recommendations,
    limitations: input.model.result.limitations,
    narrative: input.model.narrative,
    sources,
    gaps,
  };
}

export type AnalysisPackage = ReturnType<typeof buildAnalysisPackage>;

export function snapshotHash(pkg: AnalysisPackage): string {
  // Revenue-month weather is re-downloaded on every run; identical data must not create a new snapshot.
  const sources = pkg.sources.map((item) => (item.name === REVENUE_WEATHER_SOURCE ? { ...item, retrievedAt: null } : item));
  return createHash("sha256").update(stableStringify({ ...pkg, createdAt: null, sources })).digest("hex");
}
