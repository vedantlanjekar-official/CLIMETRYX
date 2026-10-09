import type { HazardIndicator } from "@/lib/hazards/types";
import type { VulnerabilityScore } from "@/lib/scoring/types";

export interface Recommendation {
  action: string;
  evidence: string;
  dependency: string;
  priority: "high" | "medium" | "low";
  benefit: string;
  costStatus: "not estimated" | "user supplied";
  horizon: string;
  verificationMetric: string;
}

export function recommend(input: {
  score: VulnerabilityScore;
  hazards: HazardIndicator[];
  runwayDays: number | null;
  backupPower: "yes" | "no" | "unknown";
  perishable: "yes" | "no" | "unknown";
}): Recommendation[] {
  const actions: Recommendation[] = [];
  const hazard = (name: HazardIndicator["hazard"]) => input.hazards.find((item) => item.hazard === name);

  const flood = hazard("flood");
  if (flood && flood.score !== null && flood.score >= 60) {
    actions.push({
      action: "Check drainage, move vulnerable stock, and confirm the official local warning rather than relying on the rainfall screening result.",
      evidence: flood.summary,
      dependency: "site access, inventory, drainage",
      priority: "high",
      benefit: "Reduces the chance that a short rainfall event becomes stock damage or a closure. Benefit is qualitative.",
      costStatus: "not estimated",
      horizon: "before the forecast window",
      verificationMetric: "Owner confirms drains checked and stock relocated, or records why that was not needed.",
    });
  }
  const heat = hazard("heat");
  if (heat && heat.score !== null && heat.score >= 50) {
    actions.push({
      action: "Review cooling capacity, opening hours, and worker exposure for the forecast hot days. Do not treat the temperature threshold as a medical heat-stress limit.",
      evidence: heat.summary,
      dependency: "cooling, workforce, cold chain",
      priority: "high",
      benefit: "Prepares operations for forecast heat. It does not predict productivity loss.",
      costStatus: "not estimated",
      horizon: "24–72 hours where the forecast supports it",
      verificationMetric: "Cooling equipment checked and a hot-weather work plan recorded.",
    });
  }
  const drought = hazard("drought");
  if (drought && drought.score !== null && drought.score >= 45) {
    actions.push({
      action: "Review water use and alternate supply options. A rainfall deficit is not evidence that the utility has failed.",
      evidence: drought.summary,
      dependency: "water",
      priority: "medium",
      benefit: "Identifies water-dependent steps that may need a backup plan.",
      costStatus: "not estimated",
      horizon: "seasonal planning",
      verificationMetric: "Water-dependent processes listed and an alternate supply either confirmed or marked unknown.",
    });
  }
  const storm = hazard("storm");
  if (storm && storm.score !== null && storm.score >= 70) {
    actions.push({
      action: "Secure lightweight assets and confirm whether an official meteorological service has issued a wind or storm warning.",
      evidence: storm.summary,
      dependency: "structures, power, access",
      priority: "high",
      benefit: "Connects the forecast gust screening to a practical check.",
      costStatus: "not estimated",
      horizon: "forecast horizon",
      verificationMetric: "Official warning status recorded separately from the forecast gust.",
    });
  }
  const supply = input.score.components.find((component) => component.id === "supply_chain");
  if (supply && supply.score !== null && supply.score >= 50) {
    actions.push({
      action: "Contact the critical supplier, confirm lead time, and identify a substitute. Regional exposure is not a confirmed delivery failure.",
      evidence: supply.notes.join(" "),
      dependency: "critical inputs",
      priority: "high",
      benefit: "Shortens the time required to respond if a supplier is later disrupted.",
      costStatus: "not estimated",
      horizon: "this operating cycle",
      verificationMetric: "Named alternate supplier or an explicit statement that none is known.",
    });
  }
  if (input.runwayDays !== null && input.runwayDays < 14) {
    actions.push({
      action: "Discuss a hypothetical cash-flow case for a short closure with the owner or an authorized financial reviewer. This is not a default prediction.",
      evidence: `Reported cash covers about ${Math.round(input.runwayDays)} days of fixed costs under the stated convention.`,
      dependency: "liquidity",
      priority: "high",
      benefit: "Makes a short disruption discussable before it is assumed to be a credit event.",
      costStatus: "not estimated",
      horizon: "next review",
      verificationMetric: "Scenario assumptions saved with currency, period, and owner confirmation.",
    });
  }
  if (input.backupPower === "no" && input.perishable === "yes") {
    actions.push({
      action: "Test what happens to perishable stock if mains power stops. Do not infer that an outage has occurred.",
      evidence: "The business reports perishable inventory and no backup power.",
      dependency: "electricity, inventory",
      priority: "medium",
      benefit: "Identifies a dependency that can turn a grid interruption into stock loss.",
      costStatus: "not estimated",
      horizon: "preparedness",
      verificationMetric: "Backup method recorded, or the gap left explicit.",
    });
  }
  if (input.score.status !== "complete") {
    actions.push({
      action: "Treat the assessment as incomplete and collect the missing evidence before using it in a financial review.",
      evidence: input.score.limitations.join(" "),
      dependency: "evidence",
      priority: "high",
      benefit: "Stops a partial result from being read as a complete risk rating.",
      costStatus: "not estimated",
      horizon: "before any credit discussion",
      verificationMetric: "Each missing required slot is either filled or explicitly accepted as a limitation.",
    });
  }
  actions.push({
      action: "Keep a person responsible for the review. This indicator must not approve, reject, or reprice a loan by itself.",
    evidence: input.score.direction,
    dependency: "governance",
    priority: "medium",
    benefit: "Preserves human accountability for any lending or support decision.",
    costStatus: "not estimated",
    horizon: "every use of the report",
    verificationMetric: "Reviewer name and decision recorded outside the automated score.",
  });
  return actions;
}
