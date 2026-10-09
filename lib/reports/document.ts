import { UTILITY_ORIGIN_LABEL, type AssessmentRequest, type AssessmentResult } from "@/lib/assessments/pipeline";

export interface ReportSection {
  id: string;
  title: string;
  paragraphs: string[];
}

export interface ReportDocument {
  title: string;
  generatedAt: string;
  sections: ReportSection[];
}

export function buildReport(request: AssessmentRequest, result: AssessmentResult, generatedAt = new Date()): ReportDocument {
  const scoreText =
    result.score.score === null
      ? "No composite number is shown because the available evidence is not sufficient."
      : `${result.score.score} / 100 — ${result.score.band}. Status: ${result.score.status}. Evidence completeness: ${result.score.evidenceCompleteness}%.`;
  return {
    title: `CLIMETRYX assessment — ${request.businessName}`,
    generatedAt: generatedAt.toISOString(),
    sections: [
      {
        id: "executive",
        title: "A. Executive summary",
        paragraphs: [
          scoreText,
          result.score.direction,
          `Limitations: ${result.limitations.join(" ")}`,
          "This report supports human review. It does not approve, reject, or reprice a loan.",
        ],
      },
      {
        id: "profile",
        title: "B. Business profile",
        paragraphs: [
          `${request.businessName} · ${request.industry || "industry not supplied"} · ${request.currency}`,
          `Location ${request.location.label} at ${request.location.latitude}, ${request.location.longitude}. Precision: ${request.location.precision}.`,
        ],
      },
      {
        id: "map",
        title: "C. Map",
        paragraphs: [
          "The interactive map shows confirmed coordinates only. Hazard layers are drawn only when a source-backed layer is loaded. No flood raster is bundled with this application.",
        ],
      },
      {
        id: "forecast",
        title: "D. Forecast analysis",
        paragraphs: result.hazards.indicators
          .filter((item) => item.evidenceKind === "forecast" || item.hazard === "heat" || item.hazard === "storm" || item.hazard === "flood")
          .map((item) => `${item.hazard}: ${item.summary}`),
      },
      {
        id: "history",
        title: "E. Historical context",
        paragraphs: [
          result.hazards.indicators.find((item) => item.hazard === "drought")?.summary ??
            "Historical rainfall baseline was not available.",
        ],
      },
      {
        id: "projections",
        title: "F. Long-term projections",
        paragraphs: [
          "Long-term projections are shown only from a CCKP response whose time coverage matches the requested period. They are not forecasts.",
        ],
      },
      {
        id: "flood",
        title: "G. Flood assessment",
        paragraphs: [result.hazards.indicators.find((item) => item.hazard === "flood")?.summary ?? "Flood evidence was not scored."],
      },
      {
        id: "heat-drought",
        title: "H. Heat, drought, and water risk",
        paragraphs: ["heat", "drought"].map(
          (name) => result.hazards.indicators.find((item) => item.hazard === name)?.summary ?? `${name} was not scored.`,
        ),
      },
      {
        id: "satellite",
        title: "I. Satellite and land surface",
        paragraphs: [
          result.satellite
            ? `${result.satellite.status}: ${result.satellite.reason} Formula ${result.satellite.formula}. ${result.satellite.limitations.join(" ")}`
            : "Satellite indicator was not requested.",
        ],
      },
      {
        id: "utilities",
        title: "J. Utilities and infrastructure",
        paragraphs: [UTILITY_ORIGIN_LABEL[request.utilityOrigin]],
      },
      {
        id: "supply",
        title: "K. Supply chain",
        paragraphs: result.score.components.find((item) => item.id === "supply_chain")?.notes ?? ["No supplier component."],
      },
      {
        id: "finance",
        title: "L. Financial resilience",
        paragraphs: result.financials
          ? [
              `Runway days: ${result.financials.runwayDays ?? "not calculated"}.`,
              ...result.financials.notes,
            ]
          : ["Financial inputs were not supplied or were not consented."],
      },
      {
        id: "stress",
        title: "M. Stress testing",
        paragraphs:
          result.scenarios.length === 0
            ? ["No stress scenario was calculated."]
            : result.scenarios.map(
                (scenario) =>
                  `${scenario.label} (${scenario.currency}): revenue at risk ${scenario.revenueAtRisk ?? "unavailable"}; cash after scenario ${scenario.cashAfterScenario ?? "unavailable"}. ${scenario.formula}`,
              ),
      },
      {
        id: "feasibility",
        title: "N. Feasibility and location comparison",
        paragraphs: [
          "Candidate sites are compared on named criteria. Missing costs stay missing. Climate data does not establish market demand, regulatory approval, or construction permission.",
        ],
      },
      {
        id: "costs",
        title: "O. Land, property, and operating costs",
        paragraphs: ["Monetary totals are summed only for supplied amounts that share a currency. No market price is invented."],
      },
      {
        id: "roadmap",
        title: "P. Resilience roadmap",
        paragraphs: result.recommendations.map(
          (item) => `${item.priority}: ${item.action} Evidence: ${item.evidence} Check: ${item.verificationMetric}`,
        ),
      },
      {
        id: "methodology",
        title: "Q. Methodology, quality, and sources",
        paragraphs: [result.methodologyVersion, ...result.score.explanation],
      },
    ],
  };
}
