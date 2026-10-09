import { runAssessment, type AssessmentRequest } from "@/lib/assessments/pipeline";
import type { DailyWeather } from "@/lib/hazards/types";

const days: DailyWeather[] = [0, 1, 2].map((offset) => ({
  date: `2026-10-${String(9 + offset).padStart(2, "0")}`,
  temperatureMaxC: 34,
  temperatureMinC: 24,
  precipitationMm: offset === 0 ? 62 : 30,
  precipitationProbabilityPct: 70,
  windGustMps: 8,
  windSpeedMps: 3,
  humidityMeanPct: null,
  apparentTemperatureMaxC: null,
  wetBulbMaxC: null,
  et0Mm: null,
  precipitationHours: null,
  capeMaxJkg: null,
  rootZoneSoilMoisture: null,
}));

/** Synthetic teaching case from the research note. Not an observation. */
export function riversideSample() {
  const request: AssessmentRequest = {
    businessName: "Riverside Foods (synthetic)",
    industry: "food retail",
    currency: "INR",
    location: {
      id: "synthetic-location",
      label: "Fictional shop",
      latitude: 18.52,
      longitude: 73.85,
      userConfirmed: true,
      acceptedLowPrecision: false,
      precision: "synthetic_user_confirmed_point",
    },
    operations: {
      electricityCritical: "yes",
      waterCritical: "yes",
      coolingCritical: "yes",
      perishableInventory: "yes",
      outdoorWorkforce: "no",
      maxTolerableDowntimeHours: 24,
    },
    resilience: {
      drainage: "unknown",
      floodProtection: "no",
      inventoryProtection: "no",
      cooling: "yes",
      backupPower: "no",
      waterStorage: "unknown",
      emergencyProcedures: "unknown",
      alternateSuppliers: "no",
      bufferStock: "no",
      backupSite: "no",
      workerSafety: "unknown",
      insurance: "unknown",
      continuityPlan: "no",
    },
    suppliers: [
      {
        name: "Synthetic primary mill",
        critical: true,
        spendShare: 0.7,
        singleSource: "yes",
        alternativeAvailable: "no",
        substitutionDays: 21,
        inventoryBufferDays: 2,
        regionalHazardScore: null,
      },
    ],
    financials: {
      currency: "INR",
      period: "monthly",
      revenue: 300000,
      fixedCosts: 120000,
      variableCosts: 80000,
      cashReserves: 32000,
      recoveryCost: 10000,
    },
    stressAssumptions: [
      {
        disruptionDays: 3,
        lostRevenueFraction: 1,
        continuingFixedFraction: 1,
        continuingVariableFraction: 0.2,
      },
    ],
    forecastDays: days,
    forecastRetrievedAt: null,
    historical: null,
    officialWarnings: [],
    populationExposure: {
      source: "World Bank Global Flood Exposure (not loaded)",
      summary: "No raster extract is loaded, so population exposure is not calculated for this sample.",
      resolution: "3 arcseconds when a real extract is imported",
    },
    waterStress: null,
    satellite: {
      status: "not_available",
      reason: "Illustrative sample does not include a processed satellite indicator.",
      catalog: null,
      formula: "(B08 - B04) / (B08 + B04)",
      bufferMeters: 500,
      limitations: ["Synthetic case."],
    },
    utilityOrigin: "business_reported",
  };
  return { request, result: runAssessment(request), synthetic: true as const };
}
