import type { AssessmentRequest, AssessmentResult } from "@/lib/assessments/pipeline";
import { FLOOD_CLASSES } from "@/lib/integrations/world-bank-flood/classes";
import { riverOutlook } from "@/lib/integrations/open-meteo/river-stats";

export type EvidenceGroup = "score" | "hazard" | "context" | "business" | "finance" | "action" | "quality";

export interface EvidenceItem {
  id: string;
  group: EvidenceGroup;
  label: string;
  text: string;
  source: string;
  observedAt: string | null;
}

export interface EvidencePack {
  businessName: string;
  siteLabel: string;
  generatedAt: string;
  items: EvidenceItem[];
}

const r1 = (value: number) => Math.round(value * 10) / 10;
const signed = (value: number) => `${value > 0 ? "+" : ""}${value}`;
const money = (value: number | null, currency: string) =>
  value === null ? "not available" : `${currency} ${Math.round(value).toLocaleString("en-IN")}`;

export function buildEvidencePack(request: AssessmentRequest, result: AssessmentResult, now = new Date()): EvidencePack {
  const items: EvidenceItem[] = [];
  const push = (item: EvidenceItem) => items.push(item);
  const { score } = result;

  push({
    id: "score",
    group: "score",
    label: "Climate-disruption vulnerability indicator",
    text:
      score.score === null
        ? `No indicator was shown because too little evidence was included. Evidence completeness ${score.evidenceCompleteness}%.`
        : `${score.score} out of 100 (${score.band}). Evidence completeness ${score.evidenceCompleteness}%. Assessment status: ${result.status.replaceAll("_", " ")}. Higher means more vulnerable to disruption; it is not a probability of default.`,
    source: result.methodologyVersion,
    observedAt: now.toISOString(),
  });

  for (const component of score.components) {
    push({
      id: `component.${component.id}`,
      group: component.id === "hazard" ? "hazard" : component.id === "financial_sensitivity" ? "finance" : "business",
      label: component.label,
      text: component.included
        ? `${component.score} out of 100, carrying ${Math.round((component.effectiveWeight ?? 0) * 100)}% of the indicator. ${component.notes.slice(0, 2).join(" ")}`
        : `Excluded: ${component.reasonExcluded ?? "no usable input"}.`,
      source: component.source,
      observedAt: null,
    });
  }

  for (const indicator of result.hazards.indicators) {
    push({
      id: `hazard.${indicator.hazard}`,
      group: "hazard",
      label: `${indicator.hazard[0]!.toUpperCase()}${indicator.hazard.slice(1)} screening`,
      text: indicator.status === "not_available" ? `Not available. ${indicator.summary}` : `Score ${indicator.score} out of 100 (${indicator.status}). ${indicator.summary}`,
      source: indicator.source,
      observedAt: request.forecastRetrievedAt,
    });
  }

  const { floodExposure, river, projections, alerts } = result.context;
  if (alerts) {
    push({
      id: "context.alerts",
      group: "context",
      label: "Official alerts (NDMA SACHET)",
      text:
        alerts.status !== "available"
          ? alerts.detail
          : alerts.matched.length
            ? alerts.matched.map((alert) => `${alert.event} (${alert.severity}) from ${alert.source}, valid until ${alert.validTo ?? "not stated"}: ${alert.headline ?? ""}`).join(" ")
            : `None of the ${alerts.activeAlerts} active official alerts covers the site. ${alerts.coverage}`,
      source: alerts.provenance.attribution,
      observedAt: alerts.provenance.retrievedAt,
    });
  }
  if (floodExposure?.summary && floodExposure.status === "available") {
    const pin = FLOOD_CLASSES.find(({ key }) => key === floodExposure.summary!.pinClass);
    push({
      id: "context.flood_exposure",
      group: "context",
      label: "Modelled 1-in-100-year flood exposure (World Bank)",
      text: `Within about ${floodExposure.bufferMeters} m, ${floodExposure.summary.shareAtLeastModerate}% of residents live where modelled flood depth exceeds 0.15 m and ${r1(floodExposure.summary.shares.high + floodExposure.summary.shares.very_high)}% where it exceeds 0.5 m. The pin cell is ${pin ? `in the "${pin.label}" class` : "unpopulated, so it has no class"}. Regional context only; not used in the score.`,
      source: floodExposure.provenance.attribution,
      observedAt: null,
    });
  } else if (floodExposure) {
    push({ id: "context.flood_exposure", group: "context", label: "Modelled flood exposure (World Bank)", text: `${floodExposure.detail} This is unknown, not safe.`, source: floodExposure.provenance.attribution, observedAt: null });
  }
  if (river && river.status !== "unavailable") {
    const outlook = riverOutlook(river.forecast, river.statistics);
    const level = {
      above_10yr_level: "at or above the empirical 10-year annual peak",
      above_typical_annual_peak: "above the typical annual peak",
      below_typical_annual_peak: "below the typical annual peak",
      unknown: "not comparable with history",
    }[outlook.level];
    push({
      id: "context.river",
      group: "context",
      label: "River discharge, nearest GloFAS river cell",
      text: `30-day forecast peak ${outlook.peakM3s ?? "not available"} m³/s${outlook.peakDate ? ` on ${outlook.peakDate}` : ""}, ${level}.${river.statistics ? ` Typical annual peak ${river.statistics.annualMaxMedianM3s} m³/s and 10-year level ${river.statistics.annualMax90thM3s} m³/s (${river.statistics.firstYear}–${river.statistics.lastYear}).` : ""} The river cell is on a ~5 km grid and may not be the watercourse nearest the site.`,
      source: river.provenance.attribution,
      observedAt: river.provenance.retrievedAt,
    });
  }
  if (projections?.status === "available") {
    for (const metric of projections.metrics) {
      push({
        id: `context.projection.${metric.key}`,
        group: "context",
        label: `${metric.label}, ${projections.future} vs ${projections.baseline}`,
        text: `Median change ${signed(metric.changeMedian)} ${metric.unit} (models range ${signed(metric.changeMin)} to ${signed(metric.changeMax)}); ${metric.modelsAgreeOnSign} of ${metric.models} models agree on the direction. Baseline ${metric.baselineMedian} ${metric.unit}.`,
        source: projections.provenance.attribution,
        observedAt: null,
      });
    }
  }
  const satellite = result.satellite;
  if (satellite?.status === "available" && satellite.latest) {
    const previous = satellite.previousYear;
    push({
      id: "context.satellite",
      group: "context",
      label: "Sentinel-2 vegetation and water indices",
      text: `Scene of ${satellite.latest.acquisitionTime.slice(0, 10)} (${satellite.latest.localCloudPct}% cloud over the site square): NDVI mean ${satellite.latest.ndvi.mean}, NDWI mean ${satellite.latest.ndwi.mean}.${previous ? ` A year earlier (${previous.acquisitionTime.slice(0, 10)}): NDVI ${previous.ndvi.mean}, NDWI ${previous.ndwi.mean}.` : " No comparable scene a year earlier."} Land-cover context only.`,
      source: "Copernicus Sentinel-2 via Microsoft Planetary Computer",
      observedAt: satellite.latest.acquisitionTime,
    });
  }

  if (result.financials) {
    push({
      id: "finance.runway",
      group: "finance",
      label: "Cash runway",
      text:
        result.financials.runwayDays === null
          ? `Runway not available. ${result.financials.notes[0] ?? ""}`
          : `Cash covers about ${Math.round(result.financials.runwayDays)} days of fixed costs (owner-reported figures).`,
      source: "business financial inputs",
      observedAt: null,
    });
  }
  result.scenarios.forEach((scenario, index) => {
    push({
      id: `finance.scenario.${index + 1}`,
      group: "finance",
      label: `Hypothetical ${scenario.disruptionDays}-day disruption`,
      text: `Revenue at risk ${money(scenario.revenueAtRisk, scenario.currency)}, continuing costs ${money(scenario.continuingCosts, scenario.currency)}, cash after scenario ${money(scenario.cashAfterScenario, scenario.currency)}; cash ${scenario.cashCoversScenario === null ? "coverage unknown" : scenario.cashCoversScenario ? "covers" : "does not cover"} the scenario. Assumption-based, not a forecast.`,
      source: "owner assumptions",
      observedAt: null,
    });
  });

  result.recommendations.forEach((recommendation, index) => {
    push({
      id: `action.${index + 1}`,
      group: "action",
      label: `Recommended action (${recommendation.priority})`,
      text: `${recommendation.action} Why: ${recommendation.evidence} Check: ${recommendation.verificationMetric}. Horizon: ${recommendation.horizon}.`,
      source: "rules engine",
      observedAt: null,
    });
  });

  const missing = score.evidenceSlots.filter((slot) => !slot.available).map((slot) => slot.label);
  push({
    id: "quality.coverage",
    group: "quality",
    label: "Evidence coverage",
    text: `${score.evidenceCompleteness}% of evidence slots are filled.${missing.length ? ` Missing: ${missing.join(", ")}. Missing evidence is unknown, not safe.` : ""}`,
    source: result.methodologyVersion,
    observedAt: null,
  });
  if (request.forecastRetrievedAt) {
    push({ id: "quality.forecast_age", group: "quality", label: "Forecast retrieved", text: `Weather forecast retrieved at ${request.forecastRetrievedAt}.`, source: "Open-Meteo", observedAt: request.forecastRetrievedAt });
  }

  return { businessName: request.businessName, siteLabel: request.location.label, generatedAt: now.toISOString(), items };
}
