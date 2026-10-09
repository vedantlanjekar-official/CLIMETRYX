import type { ReportType } from "../catalogue";
import { EXPOSURE_RULES_VERSION } from "../exposure";
import { MIN_MONTHS_FOR_COMPARISON } from "../history";
import { RISK_STATEMENT } from "../risk";
import type { AnalysisPackage } from "../snapshot";
import { HAZARDS, metric, type Metric } from "../types";
import {
  actionsFromPlan, businessSection, dailyRevenueMetric, dataQualitySection, dimensionTable, downtimeChart, dscrMetric, exposureChart, exposureTable,
  financialBaselineSection, financialVulnerabilities, forecastChart, hazardSection, highExposureCount, historyChart, liquidityChart, parameterTable,
  projectionChart, resilienceChart, resilienceMetric, riskDimensionChart, riskMetric, runwayMetric, scenarioChart, scenarioTable, supplierChart,
  topThreats, vulnerabilityMetric, worstScenario, worstScenarioMetric,
} from "./blocks";
import { section, type ReportAction, type ReportFinding, type ReportSection } from "./document";
import { humanize, LEVEL_TEXT, measureLabel, money, monthNames, quantity } from "./format";

type Pkg = AnalysisPackage;

export interface ReportDraft {
  headline: string;
  executiveSummary: string[];
  keyFindings: ReportFinding[];
  keyMetrics: Metric[];
  sections: ReportSection[];
  recommendations: ReportAction[];
  methodology: string[];
  assumptions: string[];
  limitations: string[];
  /** What the AI writer should emphasise for this report family. */
  focus: string;
}

const cur = (pkg: Pkg) => pkg.business.finance.currency;
const finding = (text: string): ReportFinding => ({ text, evidence: [] });
const present = <T,>(items: Array<T | null | undefined | false>): T[] => items.filter((item): item is T => Boolean(item));

const COMMON_METHOD = [
  "All figures are computed by deterministic engines from the saved assessment, the business questionnaire and public climate sources. AI, where used, only writes the narrative and is checked against these figures.",
  `Hazard exposure uses ${EXPOSURE_RULES_VERSION}: climate signal (forecast screen, regional context, past incidents) combined with business-reported sensitivity.`,
];

function baseLimitations(pkg: Pkg): string[] {
  return [...new Set(pkg.limitations)].slice(0, 12);
}

function climateHeadline(pkg: Pkg): string {
  const high = highExposureCount(pkg);
  return high ? `${high} hazard${high === 1 ? "" : "s"} with high combined exposure` : "No hazard currently shows high combined exposure";
}

// 1. MSME 360° -----------------------------------------------------------------------
function msme360(pkg: Pkg): ReportDraft {
  const worst = worstScenario(pkg);
  const threats = topThreats(pkg);
  return {
    headline: `${pkg.business.name}: ${climateHeadline(pkg).toLowerCase()}; resilience ${pkg.resilience.band?.toLowerCase() ?? "not scored"}`,
    executiveSummary: present([
      `${pkg.business.name} is a ${humanize(pkg.business.sizeBand)} ${pkg.business.activityLabel.toLowerCase()} business assessed at ${pkg.site.label}.`,
      pkg.assessment.vulnerabilityScore !== null ? `Its climate-disruption vulnerability indicator is ${pkg.assessment.vulnerabilityScore} of 100 (${pkg.assessment.vulnerabilityBand}).` : "There was not enough evidence to show a vulnerability indicator.",
      threats[0] ? `The leading threat is ${threats[0].charAt(0).toLowerCase()}${threats[0].slice(1)}` : "No hazard shows medium or high combined exposure.",
      worst ? `The largest hypothetical disruption, ${worst.label.toLowerCase()}, would cost about ${money(worst.cashImpact, cur(pkg))}.` : null,
    ]),
    keyFindings: [...threats.map(finding), ...financialVulnerabilities(pkg).slice(0, 2).map(finding)],
    keyMetrics: [vulnerabilityMetric(pkg), riskMetric(pkg), resilienceMetric(pkg), worstScenarioMetric(pkg), runwayMetric(pkg)],
    sections: [
      businessSection(pkg),
      section("indicators", "Indicators", {
        metrics: [vulnerabilityMetric(pkg), riskMetric(pkg), resilienceMetric(pkg)],
        tables: [dimensionTable("assessment_components", "Vulnerability indicator components", pkg.assessment.components.map((item) => ({ label: item.label, score: item.score, effectiveWeight: item.weight, basis: item.included ? "Included" : "Excluded: no data" })))],
        paragraphs: [RISK_STATEMENT],
      }),
      section("climate_overview", "Climate exposure overview", { charts: [exposureChart(pkg)], tables: [exposureTable(pkg)] }),
      financialBaselineSection(pkg),
      section("stress_overview", "Stress-test overview", { charts: present([scenarioChart(pkg)]), bullets: financialVulnerabilities(pkg) }),
      section("resilience_overview", "Resilience overview", { charts: [resilienceChart(pkg)], tables: [dimensionTable("resilience_dimensions", "Resilience dimensions", pkg.resilience.dimensions)] }),
      dataQualitySection(pkg),
    ],
    recommendations: actionsFromPlan(pkg, 6),
    methodology: [...COMMON_METHOD, `Climate-adjusted risk weights ${pkg.risk.version}; resilience ${pkg.resilience.version}.`],
    assumptions: ["Scenario parameters are listed in the stress-test report; platform assumptions are fixed settings, not estimates for this business."],
    limitations: baseLimitations(pkg),
    focus: "A balanced baseline for both the owner and a lender: who the business is, what threatens it, how much a disruption would cost, how prepared it is, and what to do first.",
  };
}

// 2. Climate exposure ----------------------------------------------------------------
function climateExposure(pkg: Pkg): ReportDraft {
  const stats = pkg.climate.forecastStats;
  const c = pkg.climate;
  return {
    headline: climateHeadline(pkg),
    executiveSummary: present([
      `Four hazards were assessed at ${pkg.site.label}, combining the forecast, regional flood, river and projection context, past incidents and the business's own sensitivity answers.`,
      topThreats(pkg, 2).join(" ") || "No hazard shows medium or high combined exposure.",
      c.alerts.active ? `${c.alerts.active} official warning(s) apply to the site.` : "No official warning applied to the site when the assessment ran.",
    ]),
    keyFindings: [
      ...pkg.exposure.map((item) => finding(`${item.label}: combined exposure ${LEVEL_TEXT[item.combined].toLowerCase()}.`)),
    ],
    keyMetrics: [
      metric({ id: "max_tmax", label: "Highest forecast temperature", value: stats.maxTmaxC, unit: "°C", kind: "forecast", source: "Open-Meteo forecast" }),
      metric({ id: "max_rain", label: "Wettest forecast day", value: stats.maxDailyRainMm, unit: "mm", kind: "forecast", source: "Open-Meteo forecast" }),
      metric({ id: "flood_share", label: "Nearby residents in modelled flood zone", value: c.floodExposure.shareAtLeastModerate, unit: "%", kind: "observed", source: "World Bank 1-in-100-year flood exposure" }),
      metric({ id: "alerts", label: "Official warnings in force", value: c.alerts.active, unit: "", kind: "observed", source: "SACHET CAP feed" }),
      metric({ id: "high_exposure", label: "Hazards with high combined exposure", value: highExposureCount(pkg), unit: "of 4", kind: "derived", source: EXPOSURE_RULES_VERSION }),
    ],
    sections: [
      section("hazard_overview", "Hazard overview", { charts: [exposureChart(pkg)], tables: [exposureTable(pkg)] }),
      section("forecast_outlook", "Forecast outlook", {
        charts: present([forecastChart(pkg)]),
        metrics: [
          metric({ id: "hot_days", label: "Forecast days at or above 35 °C", value: stats.hotDays35, unit: "days", kind: "forecast", source: "Open-Meteo forecast" }),
          metric({ id: "user_threshold_days", label: "Forecast days at or above your work threshold", value: stats.daysAboveUserThreshold, unit: "days", kind: "forecast", source: "Open-Meteo forecast; your threshold" }),
          metric({ id: "rain_7d", label: "Forecast rain, first 7 days", value: stats.total7DayRainMm, unit: "mm", kind: "forecast", source: "Open-Meteo forecast" }),
          metric({ id: "max_gust", label: "Strongest forecast gust", value: stats.maxGustMps, unit: "m/s", kind: "forecast", source: "Open-Meteo forecast" }),
          metric({ id: "max_wetbulb", label: "Highest forecast wet-bulb temperature", value: stats.maxWetBulbC, unit: "°C", kind: "forecast", source: "Open-Meteo forecast" }),
        ],
      }),
      section("official_warnings", "Official warnings", {
        paragraphs: [c.alerts.detail],
        bullets: c.alerts.matched.map((alert) => `${alert.event}${alert.severity ? ` (${alert.severity})` : ""}${alert.expires ? `, valid to ${alert.expires}` : ""}`),
      }),
      ...HAZARDS.map((hazard) => hazardSection(pkg, hazard)),
      section("regional_context", "Regional context", {
        paragraphs: [c.floodExposure.detail, c.river.detail],
        callouts: [{ tone: "info", text: "Regional context does not change the vulnerability indicator. It describes the surroundings of the site." }],
      }),
      section("long_term", "Long-term climate change", {
        paragraphs: [c.projections.detail],
        charts: present([projectionChart(pkg)]),
        tables: c.projections.changes.length
          ? [{ id: "projection_changes", title: "Projected changes (model median and range)", columns: [{ key: "metric", label: "Metric" }, { key: "baseline", label: "Baseline", align: "right" }, { key: "change", label: "Change", align: "right" }, { key: "range", label: "Model range" }, { key: "agreement", label: "Agreement" }], rows: c.projections.changes.map((item) => ({ metric: `${item.label} (${item.unit})`, baseline: item.baseline, change: item.change, range: `${item.min} to ${item.max}`, agreement: item.agreement })) }]
          : [],
      }),
      dataQualitySection(pkg),
    ],
    recommendations: actionsFromPlan(pkg, 6).filter((item) => item.priority !== "low"),
    methodology: [...COMMON_METHOD, `Forecast screens use ${c.climatology ?? "fixed global screening thresholds"}.`, "Flood exposure counts residents within about 550 m of the pin in each modelled depth class; it is not a property-level flood map."],
    assumptions: ["Business sensitivity comes from questionnaire answers; unknown answers are excluded, not treated as safe."],
    limitations: baseLimitations(pkg),
    focus: "Explain each hazard: what the forecast and regional evidence show, how the business is sensitive to it, and which exposure matters most. Keep forecast, regional context and long-term projections clearly separate.",
  };
}

// 3. Climate-adjusted financial risk -------------------------------------------------
function climateAdjustedFinancial(pkg: Pkg): ReportDraft {
  const base = pkg.finance.baseline;
  const worst = worstScenario(pkg);
  const stressed = pkg.finance.scenarios.filter((item) => item.stressedDebtServiceCoverage !== null);
  return {
    headline: pkg.risk.score === null ? "Climate-adjusted risk could not be indicated with the data supplied" : `Climate-adjusted risk indicator ${pkg.risk.score} of 100 (${pkg.risk.band})`,
    executiveSummary: present([
      "This report follows the chain from climate event to operational disruption, lost revenue, cash flow and debt-service pressure.",
      pkg.risk.score !== null ? `Across ${pkg.risk.dimensions.filter((item) => item.score !== null).length} of ${pkg.risk.dimensions.length} dimensions with data, the climate-adjusted risk indicator is ${pkg.risk.score} of 100 (${pkg.risk.band}).` : null,
      base.runwayDays !== null ? `Reported cash covers ${quantity(base.runwayDays, "days")} of fixed costs.` : "Liquidity runway is unavailable.",
      worst ? `The most severe scenario, ${worst.label.toLowerCase()}, would have a cash impact equal to ${quantity(worst.impactPctMonthlyRevenue, "%", 1)} of a month's revenue.` : null,
      RISK_STATEMENT,
    ]),
    keyFindings: financialVulnerabilities(pkg).map(finding),
    keyMetrics: [riskMetric(pkg), vulnerabilityMetric(pkg), runwayMetric(pkg), dscrMetric(pkg), worstScenarioMetric(pkg)],
    sections: [
      section("risk_chain", "From climate event to credit pressure", {
        bullets: present([
          `Climate event: ${topThreats(pkg, 1)[0] ?? "no hazard with medium or high combined exposure"}`,
          worst ? `Operational disruption: ${worst.days} day(s) at ${Math.round((worst.outputLoss ?? 0) * 100)}% output loss in the ${worst.label.toLowerCase()} scenario.` : "Operational disruption: no scenario could be calculated.",
          worst ? `Revenue loss: ${money(worst.revenueLost, cur(pkg))}; margin lost ${money(worst.marginLost, cur(pkg))}.` : null,
          worst ? `Cash-flow impact: ${money(worst.cashImpact, cur(pkg))}; cash after ${money(worst.cashAfter, cur(pkg))}.` : null,
          worst?.stressedDebtServiceCoverage != null ? `Debt-service pressure: coverage falls to ${worst.stressedDebtServiceCoverage} times in the scenario month.` : "Debt-service pressure: loan repayments were not supplied.",
        ]),
      }),
      section("risk_dimensions", "Risk dimensions", { charts: [riskDimensionChart(pkg)], tables: [dimensionTable("risk_dimension_table", "Dimension scores and weights", pkg.risk.dimensions)], paragraphs: [RISK_STATEMENT] }),
      financialBaselineSection(pkg),
      section("debt_service", "Debt-service pressure", {
        metrics: [dscrMetric(pkg), metric({ id: "debt_service", label: "Monthly loan repayments", value: base.monthlyDebtService, unit: cur(pkg), kind: "reported", source: "Business questionnaire" })],
        tables: stressed.length ? [{ id: "stressed_dscr", title: "Coverage in the scenario month", columns: [{ key: "scenario", label: "Scenario" }, { key: "dscr", label: "Coverage", align: "right" }], rows: stressed.map((item) => ({ scenario: item.label, dscr: item.stressedDebtServiceCoverage })) }] : [],
        callouts: stressed.some((item) => (item.stressedDebtServiceCoverage ?? 2) < 1) ? [{ tone: "risk", text: "In at least one scenario the month's surplus would not cover loan repayments. This is a hypothetical stress, not a default prediction." }] : [],
      }),
      section("insurance_position", "Insurance position", {
        paragraphs: [pkg.finance.scenarios[0]?.insuranceNote ?? "Insurance status unknown."],
        bullets: present([pkg.business.finance.insuranceExclusions ? `Known exclusions: ${pkg.business.finance.insuranceExclusions}` : null]),
      }),
      section("stress_summary", "Stress-test summary", { charts: present([liquidityChart(pkg)]), tables: [scenarioTable(pkg)] }),
      section("monitoring", "Monitoring", {
        bullets: [
          pkg.risk.band === "High" || pkg.risk.band === "Elevated" ? "Suggested review: monthly, and before each monsoon or heat season." : "Suggested review: quarterly, and after any material change in inputs.",
          "Re-run the assessment when the forecast window changes materially or the business reports new figures.",
          "Any lending decision remains with a qualified reviewer.",
        ],
      }),
      section("methodology", "Methodology", { paragraphs: [pkg.finance.formula, ...pkg.risk.dimensions.map((item) => `${item.label}: ${item.basis}`)] }),
    ],
    recommendations: actionsFromPlan(pkg, 6),
    methodology: [...COMMON_METHOD, `Weights ${pkg.risk.version}: ${pkg.risk.dimensions.map((item) => `${item.label} ${Math.round(item.weight * 100)}%`).join(", ")}.`],
    assumptions: pkg.finance.baseline.notes,
    limitations: [...baseLimitations(pkg), "No probability of default, exposure at default or loss given default is calculated."],
    focus: "For a lender or risk team: trace climate event → disruption → revenue → cash → debt service, name the weakest financial dimensions, and stay explicit that this is decision support, not a credit decision.",
  };
}

// 4. Revenue at risk -----------------------------------------------------------------
function revenueAtRisk(pkg: Pkg): ReportDraft {
  const base = pkg.finance.baseline;
  const h = pkg.history;
  const c = cur(pkg);
  const available = pkg.finance.scenarios.filter((item) => item.available);
  const peak = pkg.business.peakMonths;
  const overlapWet = peak.filter((month) => h.wettestMonths.includes(month));
  const overlapHot = peak.filter((month) => h.hottestMonths.includes(month));
  return {
    headline: available.length ? `Up to ${money(Math.max(...available.map((item) => item.revenueLost ?? 0)), c)} of revenue at risk in a single hypothetical event` : "Revenue at risk cannot be calculated without revenue figures",
    executiveSummary: present([
      base.dailyRevenue !== null ? `Average daily revenue is about ${money(base.dailyRevenue, c)}; each full stoppage day puts about ${money(base.dailyGrossMarginAtRisk, c)} of margin at risk.` : "Revenue was not supplied.",
      base.toleranceCost !== null ? `Within the reported downtime tolerance of ${base.toleranceDays} days, about ${money(base.toleranceCost, c)} of margin is at risk.` : null,
      h.status === "analysed" ? `Revenue was compared with observed weather over ${h.months} months.` : h.notes[0],
    ]),
    keyFindings: present([
      ...available.slice(0, 4).map((item) => finding(`${item.label}: ${money(item.revenueLost, c)} revenue lost, ${money(item.marginLost, c)} margin lost.`)),
      ...h.associations.filter((item) => item.strength === "moderate" || item.strength === "strong").map((item) => finding(`${item.label} shows a ${item.strength} association (r = ${item.r}, ${item.n} months) with ${item.direction}.`)),
    ]),
    keyMetrics: [dailyRevenueMetric(pkg), metric({ id: "daily_margin", label: "Margin at risk per stoppage day", value: base.dailyGrossMarginAtRisk, unit: c, kind: "derived", source: "(daily revenue − daily variable costs) × output lost" }), worstScenarioMetric(pkg), metric({ id: "history_months", label: "Months of revenue history", value: h.months, unit: "months", kind: "reported", source: "Business questionnaire" })],
    sections: [
      section("revenue_baseline", "Revenue baseline", {
        metrics: [
          metric({ id: "monthly_revenue", label: "Monthly revenue", value: base.monthlyRevenue, unit: c, kind: "reported", source: "Business questionnaire" }),
          dailyRevenueMetric(pkg),
          metric({ id: "contribution_margin", label: "Contribution margin", value: base.contributionMarginPct, unit: "%", kind: "derived", source: "(Revenue − variable costs) ÷ revenue" }),
          metric({ id: "tolerance_cost", label: "Margin at risk within downtime tolerance", value: base.toleranceCost, unit: c, kind: "derived", source: "Daily margin at risk × tolerated days" }),
        ],
        bullets: [`Main customers: ${pkg.business.customerTypes.join(", ") || "not answered"}.`],
      }),
      section("revenue_scenarios", "Revenue at risk by scenario", {
        charts: present([available.length ? {
          id: "revenue_lost",
          kind: "horizontalBar" as const,
          title: "Revenue and margin lost per scenario",
          unit: c,
          period: "Single event, hypothetical",
          source: `Engine F ${pkg.finance.version}`,
          explanation: "Revenue lost is gross; margin lost subtracts variable costs that would not be incurred while output is down.",
          xKey: "scenario",
          series: [{ key: "revenueLost", label: "Revenue lost", type: "bar" as const }, { key: "marginLost", label: "Margin lost", type: "bar" as const }],
          data: available.map((item) => ({ scenario: item.label, revenueLost: item.revenueLost, marginLost: item.marginLost })),
        } : null]),
        tables: [scenarioTable(pkg)],
      }),
      section("seasonality", "Seasonality", {
        bullets: present([
          `Reported seasonality: ${humanize(pkg.business.seasonality)}${peak.length ? `, peak months ${monthNames(peak)}` : ""}.`,
          h.wettestMonths.length ? `Wettest months at the site in the revenue period: ${monthNames(h.wettestMonths)}.` : null,
          h.hottestMonths.length ? `Hottest months: ${monthNames(h.hottestMonths)}.` : null,
          overlapWet.length ? `Peak trading overlaps the wettest months (${monthNames(overlapWet)}), so a flood disruption then would cost more than an average month.` : null,
          overlapHot.length ? `Peak trading overlaps the hottest months (${monthNames(overlapHot)}).` : null,
        ]),
      }),
      section("history", "Revenue and weather history", {
        charts: present([historyChart(pkg)]),
        tables: present([
          h.associations.length ? { id: "associations", title: "Association between revenue and weather", columns: [{ key: "variable", label: "Weather variable" }, { key: "r", label: "Correlation (r)", align: "right" as const }, { key: "n", label: "Months", align: "right" as const }, { key: "strength", label: "Strength" }, { key: "direction", label: "Direction" }], rows: h.associations.map((item) => ({ variable: item.label, r: item.r, n: item.n, strength: humanize(item.strength), direction: item.direction })) } : null,
          h.events.length ? { id: "event_months", title: "Revenue in weather-event months", columns: [{ key: "event", label: "Months" }, { key: "count", label: "Count", align: "right" as const }, { key: "event_index", label: "Avg revenue index", align: "right" as const }, { key: "other_index", label: "Other months", align: "right" as const }, { key: "diff", label: "Difference %", align: "right" as const }], rows: h.events.map((item) => ({ event: item.label, count: item.eventMonths.length, event_index: item.meanIndexEvent, other_index: item.meanIndexOther, diff: item.differencePct })) } : null,
        ]),
        bullets: h.notes,
        callouts: h.status !== "analysed" ? [{ tone: "info", text: `Add at least ${MIN_MONTHS_FOR_COMPARISON} months of actual revenue on the financial step to compare revenue with past weather.` }] : [],
      }),
    ],
    recommendations: actionsFromPlan(pkg, 5),
    methodology: [...COMMON_METHOD, pkg.finance.formula, "Revenue history comparison uses Pearson correlation of a revenue index against ERA5 monthly weather at the site; association, not causation."],
    assumptions: [...base.notes, pkg.business.finance.lostRevenueShare === null ? "Output lost on a full stoppage day is assumed to be 100% because no share was reported." : "Output lost on a stoppage day uses the business's reported share."],
    limitations: [...baseLimitations(pkg), "No revenue forecast is produced; no validated forecasting model is available."],
    focus: "Quantify revenue and margin at risk per scenario, explain the downtime tolerance and seasonality, and describe any revenue–weather association carefully as association, not causation.",
  };
}

// 5. Operational vulnerability -------------------------------------------------------
function operationalVulnerability(pkg: Pkg): ReportDraft {
  const ops = pkg.operations;
  const pathways = pkg.exposure.flatMap((item) => item.pathways.map((pathway) => ({ ...pathway, hazardLabel: item.label })));
  const highPathways = pathways.filter((item) => item.relevance === "high");
  const opScore = pkg.assessment.components.find((item) => item.id === "operational_sensitivity")?.score ?? null;
  return {
    headline: `${highPathways.length} high-relevance operational impact pathway${highPathways.length === 1 ? "" : "s"}${ops.toleranceDays !== null ? `; tolerance ${ops.toleranceDays} days of downtime` : ""}`,
    executiveSummary: present([
      opScore !== null ? `Operational sensitivity is ${opScore} of 100, from reported dependencies and downtime tolerance.` : "Operational sensitivity could not be scored.",
      highPathways.length ? `The most relevant pathways are ${highPathways.slice(0, 3).map((item) => item.pathway.toLowerCase()).join(", ")}.` : "No impact pathway is rated high.",
      ops.scenarioDays.some((item) => item.exceedsTolerance) ? `${ops.scenarioDays.filter((item) => item.exceedsTolerance).length} scenario(s) last longer than the business says it can absorb.` : null,
    ]),
    keyFindings: highPathways.slice(0, 5).map((item) => finding(`${item.hazardLabel}: ${item.pathway} (${item.basis})`)),
    keyMetrics: [
      metric({ id: "operational_sensitivity", label: "Operational sensitivity", value: opScore, unit: "/100", kind: "derived", source: "Assessment component" }),
      metric({ id: "tolerance", label: "Maximum tolerable downtime", value: ops.toleranceDays, unit: "days", kind: "reported", source: "Business questionnaire" }),
      metric({ id: "inventory_days", label: "Stock normally held", value: ops.inventoryDays, unit: "days", kind: "reported", source: "Business questionnaire" }),
      metric({ id: "incidents", label: "Past incidents reported", value: pkg.business.incidents.length, unit: "", kind: "reported", source: "Business questionnaire" }),
    ],
    sections: [
      section("dependencies", "Operating pattern and dependencies", {
        tables: [{ id: "dependency_table", title: "Reported dependencies", columns: [{ key: "dependency", label: "Dependency" }, { key: "level", label: "Level" }], rows: ops.dependencies.map((item) => ({ dependency: item.name, level: humanize(item.level) })) }],
        bullets: present([
          `Perishable or temperature-sensitive stock: ${humanize(ops.perishable)}.`,
          `Outdoor or unconditioned work: ${humanize(ops.outdoorWork)}.`,
          ops.criticalEquipment ? `Critical equipment: ${ops.criticalEquipment}` : null,
          `Operating pattern: ${ops.operatingDays ? `${ops.operatingDays} days a week` : "not answered"}${ops.shiftPattern ? `, ${humanize(ops.shiftPattern)} shift` : ""}.`,
        ]),
      }),
      section("utilities", "Utility reliability", {
        tables: [{ id: "utility_table", title: "Business-reported utility reliability", columns: [{ key: "utility", label: "Utility" }, { key: "outages", label: "Interruptions" }, { key: "duration", label: "Typical length (h)", align: "right" }, { key: "backup", label: "Backup" }, { key: "backupHours", label: "Backup runtime (h)", align: "right" }], rows: ops.utilities.map((item) => ({ utility: humanize(item.utility), outages: humanize(item.outages), duration: item.durationHours, backup: humanize(item.backup), backupHours: item.backupHours })) }],
        callouts: [{ tone: "info", text: "No public outage feed is integrated. Reliability is business-reported, and heat or rain is never treated as proof that a utility failed." }],
      }),
      section("pathways", "Impact pathways", {
        tables: [{ id: "pathway_table", title: "How each hazard reaches operations", columns: [{ key: "hazard", label: "Hazard" }, { key: "pathway", label: "Pathway" }, { key: "relevance", label: "Relevance" }, { key: "basis", label: "Why" }], rows: pathways.map((item) => ({ hazard: item.hazardLabel, pathway: item.pathway, relevance: LEVEL_TEXT[item.relevance], basis: item.basis })) }],
      }),
      section("workforce", "Workforce exposure", {
        bullets: present([
          `Outdoor or unconditioned work: ${humanize(ops.outdoorWork)}.`,
          `Heat and safety protocols: ${humanize(pkg.business.measures.workerSafety)}.`,
          ops.commute ? `Staff commute: ${humanize(ops.commute)} (heavy rain that cuts roads affects attendance).` : null,
          pkg.climate.forecastStats.maxWetBulbC !== null ? `Highest forecast wet-bulb temperature: ${pkg.climate.forecastStats.maxWetBulbC} °C. This is a shade value, not WBGT, and not a medical limit.` : null,
          "No productivity-loss rate is estimated; production or attendance records would be needed.",
        ]),
      }),
      section("downtime", "Downtime tolerance", { charts: present([downtimeChart(pkg)]) }),
      section("incidents", "Past incidents", {
        tables: present([
          pkg.business.incidents.length ? { id: "incident_table", title: "Reported incidents", columns: [{ key: "date", label: "Date" }, { key: "cause", label: "Cause" }, { key: "hours", label: "Disruption (h)", align: "right" as const }, { key: "recovery", label: "Recovery (days)", align: "right" as const }, { key: "impacts", label: "Effects" }], rows: pkg.business.incidents.map((item) => ({ date: item.occurredOn, cause: humanize(item.hazard), hours: item.durationHours, recovery: item.recoveryDays, impacts: item.impacts.map(humanize).join(", ") })) } : null,
          ops.incidentImpacts.length ? { id: "impact_counts", title: "Most common effects", columns: [{ key: "impact", label: "Effect" }, { key: "count", label: "Incidents", align: "right" as const }], rows: ops.incidentImpacts.map((item) => ({ impact: humanize(item.impact), count: item.count })) } : null,
        ]),
        paragraphs: pkg.business.incidents.length ? [] : ["No past incidents were reported."],
      }),
    ],
    recommendations: actionsFromPlan(pkg, 6),
    methodology: [...COMMON_METHOD, "Impact pathways are rule-based and depend on reported dependencies and sensitivity answers. Relevance is the worst of the answered factors behind each pathway."],
    assumptions: [],
    limitations: baseLimitations(pkg),
    focus: "For the owner: which operations break first under each hazard, how long the business can absorb a stoppage, and what past incidents show about recovery.",
  };
}

// 6. Supply chain --------------------------------------------------------------------
function supplyChain(pkg: Pkg): ReportDraft {
  const s = pkg.supply;
  const scenario = pkg.finance.scenarios.find((item) => item.id === "supply_disruption")!;
  const supplyScore = pkg.assessment.components.find((item) => item.id === "supply_chain")?.score ?? null;
  const high = s.suppliers.filter((item) => item.level === "high");
  return {
    headline: s.suppliers.length ? `${s.criticalCount} critical supplier${s.criticalCount === 1 ? "" : "s"}, ${s.singleSourceCount} single-sourced` : "No critical supplier was entered",
    executiveSummary: present([
      s.suppliers.length ? `${s.suppliers.length} supplier(s) were entered; ${high.length} show three or more concentration flags.` : "Supply-chain risk cannot be assessed until critical suppliers are entered.",
      scenario.available ? `If the most exposed critical supplier stopped, the business would be without that input for ${scenario.days} day(s), costing about ${money(scenario.cashImpact, cur(pkg))}.` : scenario.unavailableReason,
      s.regionalHazardNote,
    ]),
    keyFindings: s.suppliers.filter((item) => item.flags.length).slice(0, 5).map((item) => finding(`${item.name}: ${item.flags.join(", ")}.`)),
    keyMetrics: [
      metric({ id: "supply_score", label: "Supply-chain vulnerability", value: supplyScore, unit: "/100", kind: "derived", source: "Assessment component" }),
      metric({ id: "critical_suppliers", label: "Critical suppliers", value: s.criticalCount, unit: "", kind: "reported", source: "Business questionnaire" }),
      metric({ id: "single_source", label: "Single-sourced suppliers", value: s.singleSourceCount, unit: "", kind: "reported", source: "Business questionnaire" }),
      metric({ id: "hhi", label: "Spend concentration (HHI)", value: s.concentrationIndex, unit: "", kind: "derived", source: "Σ (spend share %)²" }),
      metric({ id: "supply_impact", label: "Supplier disruption impact", value: scenario.cashImpact, unit: cur(pkg), kind: "hypothetical", source: pkg.finance.version }),
    ],
    sections: [
      section("supplier_register", "Supplier register", {
        tables: s.suppliers.length ? [{ id: "suppliers", title: "Suppliers and risk flags", columns: [{ key: "name", label: "Supplier" }, { key: "product", label: "Supplies" }, { key: "criticality", label: "Criticality" }, { key: "share", label: "Spend share", align: "right" }, { key: "region", label: "Location" }, { key: "level", label: "Risk level" }, { key: "flags", label: "Flags" }], rows: s.suppliers.map((item) => ({ name: item.name, product: item.product, criticality: humanize(item.criticality), share: item.spendShare === null ? null : `${Math.round(item.spendShare * 100)}%`, region: item.region, level: LEVEL_TEXT[item.level], flags: item.flags.join("; ") || "none" })) }] : [],
        callouts: s.suppliers.length ? [] : [{ tone: "warning", text: "No critical supplier was entered. Supply-chain risk is shown as unknown, not as low." }],
      }),
      section("buffers", "Buffers and switching time", {
        charts: present([supplierChart(pkg)]),
        tables: s.suppliers.length ? [{ id: "buffer_table", title: "Days without input before a substitute arrives", columns: [{ key: "name", label: "Supplier" }, { key: "buffer", label: "Buffer (days)", align: "right" }, { key: "switch", label: "Switch time (days)", align: "right" }, { key: "gap", label: "Gap (days)", align: "right" }, { key: "lead", label: "Lead time (days)", align: "right" }, { key: "mode", label: "Transport" }], rows: s.suppliers.map((item) => ({ name: item.name, buffer: item.bufferDays, switch: item.substitutionDays, gap: item.gapDays, lead: item.leadTimeDays, mode: humanize(item.transportMode) })) }] : [],
      }),
      section("concentration", "Concentration", { paragraphs: [s.concentrationNote] }),
      section("supply_scenario", "Supplier disruption scenario", {
        paragraphs: [scenario.description],
        bullets: scenario.available ? [`Revenue lost: ${money(scenario.revenueLost, cur(pkg))}.`, `Cash impact: ${money(scenario.cashImpact, cur(pkg))}.`, `Cash after: ${money(scenario.cashAfter, cur(pkg))}.`] : [scenario.unavailableReason ?? "Not available."],
      }),
      section("supply_actions", "Actions", {
        bullets: present([
          s.suppliers.some((item) => item.alternative === "no") ? "Identify and qualify an alternative for each critical supplier with none." : null,
          s.suppliers.some((item) => (item.gapDays ?? 0) > 7) ? "Raise buffer stock or shorten switching time where the gap exceeds a week." : null,
          s.suppliers.some((item) => item.singleSource === "yes") ? `Split volume across two sources for single-sourced ${s.suppliers.some((item) => item.singleSource === "yes" && item.criticality === "critical") ? "critical " : ""}inputs where feasible.` : null,
          "Record supplier city and region precisely so supplier-site hazards can be assessed in future.",
        ]),
      }),
    ],
    recommendations: actionsFromPlan(pkg, 5).filter((item) => /supplier|stock|buffer/i.test(item.action + item.rationale)).concat(actionsFromPlan(pkg, 3)).slice(0, 5),
    methodology: [...COMMON_METHOD, "A supplier is rated high with three or more flags (single source, no alternative, ≥50% of spend, <3 days buffer, >7-day input gap), medium with one or two."],
    assumptions: ["The supplier-disruption scenario assumes output stops once the buffer runs out until a substitute arrives."],
    limitations: [...baseLimitations(pkg), s.regionalHazardNote],
    focus: "Which suppliers would stop the business, how long buffers last against switching time, the cost of a supplier outage, and practical diversification steps.",
  };
}

// 7. Stress test ---------------------------------------------------------------------
function stressTest(pkg: Pkg): ReportDraft {
  const worst = worstScenario(pkg);
  const c = cur(pkg);
  const negative = pkg.finance.scenarios.filter((item) => item.cashAfter !== null && item.cashAfter < 0);
  const breach = pkg.finance.scenarios.filter((item) => (item.stressedDebtServiceCoverage ?? 9) < 1);
  return {
    headline: worst ? `Worst scenario: ${worst.label}, ${money(worst.cashImpact, c)} cash impact` : "Stress test needs financial figures",
    executiveSummary: present([
      `${pkg.finance.scenarios.filter((item) => item.available).length} of ${pkg.finance.scenarios.length} hypothetical scenarios could be calculated.`,
      worst ? `The most severe is ${worst.label.toLowerCase()}: ${worst.days} day(s), ${money(worst.cashImpact, c)} cash impact, ${quantity(worst.impactPctMonthlyRevenue, "%", 1)} of a month's revenue.` : null,
      negative.length ? `Reported cash would be exhausted in ${negative.length} scenario(s).` : pkg.finance.baseline.cash !== null ? "Reported cash absorbs every calculated scenario." : "Cash reserves were not supplied, so cash after each scenario is unknown.",
      breach.length ? `Monthly surplus would not cover loan repayments in ${breach.length} scenario(s).` : null,
    ]),
    keyFindings: pkg.finance.scenarios.filter((item) => item.available).map((item) => finding(`${item.label}: ${money(item.cashImpact, c)} impact; cash after ${money(item.cashAfter, c)}.`)),
    keyMetrics: [worstScenarioMetric(pkg), runwayMetric(pkg), dscrMetric(pkg), metric({ id: "scenarios_negative", label: "Scenarios exhausting cash", value: negative.length, unit: `of ${pkg.finance.scenarios.length}`, kind: "hypothetical", source: pkg.finance.version })],
    sections: [
      section("scenario_results", "Scenario results", { charts: present([scenarioChart(pkg)]), tables: [scenarioTable(pkg)] }),
      section("liquidity", "Liquidity under stress", {
        charts: present([liquidityChart(pkg)]),
        tables: [{ id: "runway_after", title: "Runway after each scenario", columns: [{ key: "scenario", label: "Scenario" }, { key: "runway", label: "Runway after (days)", align: "right" }, { key: "tolerance", label: "Longer than tolerated downtime?" }], rows: pkg.finance.scenarios.map((item) => ({ scenario: item.label, runway: item.runwayAfterDays, tolerance: item.exceedsTolerance === null ? "unknown" : item.exceedsTolerance ? "yes" : "no" })) }],
      }),
      section("parameters", "Scenario parameters", { tables: [parameterTable(pkg)], bullets: pkg.finance.scenarios.map((item) => `${item.label}: ${item.description}`) }),
      section("insurance", "Insurance", { paragraphs: [pkg.finance.scenarios[0]?.insuranceNote ?? ""] }),
    ],
    recommendations: actionsFromPlan(pkg, 5),
    methodology: [...COMMON_METHOD, pkg.finance.formula, "Stressed coverage spreads the cash impact over the months the scenario lasts (at least one) and subtracts it from monthly surplus."],
    assumptions: ["Heatwave durations and output losses are fixed platform settings for comparison, not forecasts or estimates for this business.", ...pkg.finance.baseline.notes],
    limitations: [...baseLimitations(pkg), "Scenarios are single events; their frequency is not estimated, so no expected annual loss is shown."],
    focus: "For a lender: what each scenario does to cash, runway and debt-service coverage, which scenarios break liquidity, and how sensitive results are to the stated parameters.",
  };
}

// 8. Resilience ----------------------------------------------------------------------
function resilience(pkg: Pkg): ReportDraft {
  const r = pkg.resilience;
  const known = r.dimensions.filter((item) => item.score !== null);
  const weakest = [...known].sort((a, b) => a.score! - b.score!).slice(0, 2);
  const strongest = [...known].sort((a, b) => b.score! - a.score!).slice(0, 2);
  return {
    headline: r.score === null ? "Resilience could not be scored" : `Resilience ${r.score} of 100 (${r.band})`,
    executiveSummary: present([
      r.score !== null ? `Across ${known.length} of ${r.dimensions.length} dimensions with data, overall resilience is ${r.score} of 100 (${r.band}).` : null,
      weakest.length ? `Weakest: ${weakest.map((item) => `${item.label.toLowerCase()} (${item.score})`).join(" and ")}.` : null,
      strongest.length ? `Strongest: ${strongest.map((item) => `${item.label.toLowerCase()} (${item.score})`).join(" and ")}.` : null,
    ]),
    keyFindings: r.dimensions.map((item) => finding(`${item.label}: ${item.score ?? "unknown"} — ${item.basis}`)),
    keyMetrics: [resilienceMetric(pkg), ...r.dimensions.slice(0, 4).map((item) => metric({ id: `res_${item.id}`, label: item.label, value: item.score, unit: "/100", kind: "derived", source: r.version }))],
    sections: [
      section("resilience_dimensions", "Resilience dimensions", { charts: [resilienceChart(pkg)], tables: [dimensionTable("res_table", "Scores and basis", r.dimensions)] }),
      section("measures", "Measures in place", {
        tables: [{ id: "measure_table", title: "Continuity and adaptation measures", columns: [{ key: "measure", label: "Measure" }, { key: "status", label: "Status" }], rows: Object.entries(pkg.business.measures).map(([key, status]) => ({ measure: measureLabel(key), status: humanize(status) })) }],
        callouts: [{ tone: "info", text: "Only measures in place count. Partly in place and planned count as gaps; unknown is excluded." }],
      }),
      section("hazard_preparedness", "Preparedness by hazard", {
        tables: [{ id: "prep_table", title: "Hazard-relevant measures", columns: [{ key: "hazard", label: "Hazard" }, { key: "level", label: "Preparedness" }, { key: "inPlace", label: "In place" }, { key: "gaps", label: "Gaps" }], rows: pkg.exposure.map((item) => ({ hazard: item.label, level: LEVEL_TEXT[item.preparedness.level], inPlace: item.preparedness.inPlace.map(measureLabel).join(", ") || "none", gaps: item.preparedness.gaps.map(measureLabel).join(", ") || "none" })) }],
      }),
    ],
    recommendations: actionsFromPlan(pkg, 6),
    methodology: [...COMMON_METHOD, `Resilience ${r.version}: equal-weight mean of available dimensions; bands strong ≥70, moderate ≥45, otherwise weak. Each dimension's scoring rule is shown in its basis.`],
    assumptions: [],
    limitations: baseLimitations(pkg),
    focus: "For the owner: how prepared the business is, which dimensions are weakest and why, and which measures would raise resilience most for the exposed hazards.",
  };
}

// 9. Adaptation plan -----------------------------------------------------------------
function adaptationPlan(pkg: Pkg): ReportDraft {
  const plan = pkg.adaptation;
  const c = plan.currency ?? cur(pkg);
  const byHorizon = (horizon: string) => plan.actions.filter((item) => item.horizon === horizon);
  return {
    headline: `${plan.actions.length} prioritised measure${plan.actions.length === 1 ? "" : "s"}${plan.totalCostedCapex !== null ? `, ${money(plan.totalCostedCapex, c)} of business-estimated investment` : ""}`,
    executiveSummary: present([
      plan.actions.length ? `${plan.actions.filter((item) => item.priority === "high").length} high-priority measure(s) target hazards where this business has high combined exposure.` : "No adaptation gap was found for hazards with medium or high exposure.",
      plan.totalCostedCapex !== null ? `Costed measures total ${money(plan.totalCostedCapex, c)} from the business's own quotations or estimates; ${plan.uncosted} measure(s) are not costed.` : "No measure has a business-supplied cost yet.",
      "Payback and avoided losses are not calculated because no measure-effectiveness data is available.",
    ]),
    keyFindings: plan.actions.slice(0, 5).map((item) => finding(`${item.label} (${item.priority} priority): ${item.why}`)),
    keyMetrics: [
      metric({ id: "actions", label: "Prioritised measures", value: plan.actions.length, unit: "", kind: "derived", source: "Adaptation engine" }),
      metric({ id: "high_priority", label: "High-priority measures", value: plan.actions.filter((item) => item.priority === "high").length, unit: "", kind: "derived", source: "Adaptation engine" }),
      metric({ id: "costed_capex", label: "Business-estimated investment", value: plan.totalCostedCapex, unit: c, kind: "reported", source: "Costs step of the questionnaire" }),
      resilienceMetric(pkg),
    ],
    sections: [
      section("prioritised_measures", "Prioritised measures", {
        tables: [{ id: "plan_table", title: "Adaptation measures", columns: [{ key: "measure", label: "Measure" }, { key: "priority", label: "Priority" }, { key: "hazards", label: "Hazards" }, { key: "status", label: "Current status" }, { key: "cost", label: "Cost" }, { key: "scenario", label: "Scenario targeted" }], rows: plan.actions.map((item) => ({ measure: item.label, priority: item.priority, hazards: item.hazards.join(", ") || "cross-hazard", status: humanize(item.currentStatus), cost: item.cost ? money(item.cost.amount, item.cost.currency ?? c) : "not estimated", scenario: item.scenarioAddressed ? `${item.scenarioAddressed.label} (${money(item.scenarioAddressed.cashImpact, cur(pkg))})` : "—" })) }],
        bullets: plan.notes,
      }),
      section("timeline", "Action timeline", {
        bullets: present([
          byHorizon("now").length ? `Now: ${byHorizon("now").map((item) => item.label).join(", ")}.` : null,
          byHorizon("30_days").length ? `Within 30 days: ${byHorizon("30_days").map((item) => item.label).join(", ")}.` : null,
          byHorizon("90_days").length ? `Within 90 days: ${byHorizon("90_days").map((item) => item.label).join(", ")}.` : null,
          byHorizon("12_months").length ? `Within 12 months: ${byHorizon("12_months").map((item) => item.label).join(", ")}.` : null,
          ...plan.assessmentActions.filter((item) => item.priority === "high").slice(0, 3).map((item) => `Assessment action (${item.horizon}): ${item.action}`),
        ]),
      }),
      section("investment", "Investment summary", {
        tables: present([
          plan.actions.some((item) => item.cost) ? { id: "cost_table", title: "Business-supplied costs", columns: [{ key: "measure", label: "Measure" }, { key: "amount", label: "Amount", align: "right" as const }, { key: "basis", label: "Basis" }, { key: "source", label: "Source" }], rows: plan.actions.filter((item) => item.cost).map((item) => ({ measure: item.label, amount: money(item.cost!.amount, item.cost!.currency ?? c), basis: item.cost!.basis, source: item.cost!.source })) } : null,
        ]),
        callouts: [{ tone: "info", text: "Add quotations on the costs step (backup power, cooling, water storage, drainage, insurance premium) to cost more measures. No benchmark prices are used." }],
      }),
    ],
    recommendations: plan.actions.slice(0, 8).map((item) => ({ priority: item.priority, horizon: item.horizon, action: item.label, rationale: item.why, evidence: [] })),
    methodology: [...COMMON_METHOD, "Measures are proposed for hazards with medium or high combined exposure where the relevant measure is not in place. Priority follows the combined exposure level."],
    assumptions: plan.notes,
    limitations: [...baseLimitations(pkg), "Measure effectiveness, avoided losses and payback periods are not estimated."],
    focus: "For the owner: what to do first and why, linked to the exposed hazards, with costs only where the business supplied them, and honest about what is not costed.",
  };
}

// 10. Executive one-page -------------------------------------------------------------
function executiveOnePage(pkg: Pkg): ReportDraft {
  const threats = topThreats(pkg);
  const worst = worstScenario(pkg);
  return {
    headline: `${pkg.business.name}: ${pkg.risk.band ? `${pkg.risk.band.toLowerCase()} climate-adjusted risk` : "risk not fully indicated"}, ${pkg.resilience.band?.toLowerCase() ?? "unscored"} resilience`,
    executiveSummary: present([
      `${pkg.business.activityLabel}, ${humanize(pkg.business.sizeBand)}, at ${pkg.site.label}.`,
      threats[0] ?? "No hazard shows medium or high combined exposure.",
      worst ? `Largest hypothetical disruption: ${worst.label.toLowerCase()}, ${money(worst.cashImpact, cur(pkg))}.` : null,
    ]),
    keyFindings: [...threats, ...financialVulnerabilities(pkg).slice(0, 3)].map(finding),
    keyMetrics: [vulnerabilityMetric(pkg), riskMetric(pkg), resilienceMetric(pkg), worstScenarioMetric(pkg), runwayMetric(pkg)],
    sections: [
      section("profile", "Profile", { bullets: [`${pkg.business.activityLabel}${pkg.business.isicSection ? ` (ISIC ${pkg.business.isicSection})` : ""}`, `Size: ${humanize(pkg.business.sizeBand)}; employees: ${pkg.business.employees ?? pkg.business.employeeBand ?? "not answered"}`, `Site: ${pkg.site.label}`] }),
      section("key_threats", "Key climate threats", { bullets: threats.length ? threats : ["No hazard shows medium or high combined exposure."] }),
      section("financial_vulnerabilities", "Key financial vulnerabilities", { bullets: financialVulnerabilities(pkg) }),
      section("top_actions", "Top actions", { bullets: actionsFromPlan(pkg, 5).map((item) => `[${item.priority}] ${item.action}`) }),
      section("trend", "Current risk trend", {
        paragraphs: [pkg.assessment.stale ? `The assessment is out of date: ${pkg.assessment.staleReason ?? "inputs changed"}.` : `Based on the assessment of ${pkg.assessment.createdAt.slice(0, 10)}. Trends need at least two assessments; compare report versions in the viewer.`],
      }),
    ],
    recommendations: actionsFromPlan(pkg, 5),
    methodology: COMMON_METHOD,
    assumptions: [],
    limitations: baseLimitations(pkg).slice(0, 5),
    focus: "One page for a manager or lender: the three indicators, the top threats and financial vulnerabilities, and the five actions that matter most. Very concise.",
  };
}

export const TEMPLATES: Record<ReportType, (pkg: Pkg) => ReportDraft> = {
  msme_360: msme360,
  climate_exposure: climateExposure,
  climate_adjusted_financial_risk: climateAdjustedFinancial,
  revenue_at_risk: revenueAtRisk,
  operational_vulnerability: operationalVulnerability,
  supply_chain: supplyChain,
  stress_test: stressTest,
  resilience,
  adaptation_plan: adaptationPlan,
  executive_one_page: executiveOnePage,
};

/** What each report can say with the data available. Reports always generate; missing inputs are listed. */
export function reportReadiness(type: ReportType, pkg: Pkg): { ready: boolean; missing: string[] } {
  const missing: string[] = [];
  const finance = pkg.business.finance;
  const needsFinance: ReportType[] = ["climate_adjusted_financial_risk", "revenue_at_risk", "stress_test"];
  if (needsFinance.includes(type) && !finance.shared) missing.push("Financial figures (revenue, fixed costs, cash reserves)");
  if (needsFinance.includes(type) && finance.shared && finance.monthly.revenue === null) missing.push("Revenue");
  if (type === "revenue_at_risk" && pkg.business.revenueHistory.length < MIN_MONTHS_FOR_COMPARISON) missing.push(`At least ${MIN_MONTHS_FOR_COMPARISON} months of revenue history (for the weather comparison)`);
  if (type === "supply_chain" && !pkg.business.suppliers.length) missing.push("Critical suppliers");
  if (type === "climate_adjusted_financial_risk" && finance.shared && finance.monthly.debtService === null) missing.push("Loan repayments (for debt-service coverage)");
  if (type === "adaptation_plan" && !pkg.business.costs.length) missing.push("Cost quotations (to cost measures)");
  if (!pkg.climate.forecast.length && ["climate_exposure", "msme_360"].includes(type)) missing.push("Weather forecast");
  return { ready: missing.length === 0, missing };
}
