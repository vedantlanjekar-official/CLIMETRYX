import { LEVEL_SCORE } from "../exposure";
import type { AnalysisPackage } from "../snapshot";
import { HAZARD_LABEL, metric, type Hazard, type Metric } from "../types";
import { section, type ChartSpec, type ReportAction, type ReportSection, type TableSpec } from "./document";
import { humanize, LEVEL_TEXT, measureLabel, money, monthNames, quantity } from "./format";

type Pkg = AnalysisPackage;

const cur = (pkg: Pkg) => pkg.business.finance.currency;
const assessed = (pkg: Pkg) => `assessment of ${pkg.assessment.createdAt.slice(0, 10)}`;

// Key metrics ----------------------------------------------------------------------

export function vulnerabilityMetric(pkg: Pkg): Metric {
  return metric({ id: "vulnerability", label: "Climate-disruption vulnerability", value: pkg.assessment.vulnerabilityScore, unit: "/100", kind: "derived", source: `Assessment methodology ${pkg.assessment.methodology}`, note: pkg.assessment.vulnerabilityBand ?? "not scored" });
}

export function riskMetric(pkg: Pkg): Metric {
  return metric({ id: "climate_adjusted_risk", label: "Climate-adjusted risk indicator", value: pkg.risk.score, unit: "/100", kind: "derived", source: pkg.risk.version, note: pkg.risk.band ?? "not enough data" });
}

export function resilienceMetric(pkg: Pkg): Metric {
  return metric({ id: "resilience", label: "Resilience score", value: pkg.resilience.score, unit: "/100", kind: "derived", source: pkg.resilience.version, note: pkg.resilience.band ?? "not enough data" });
}

export function worstScenario(pkg: Pkg) {
  return pkg.finance.scenarios.find((item) => item.id === pkg.finance.worstScenarioId) ?? null;
}

export function worstScenarioMetric(pkg: Pkg): Metric {
  const worst = worstScenario(pkg);
  return metric({ id: "worst_scenario_impact", label: worst ? `Largest scenario impact (${worst.label})` : "Largest scenario impact", value: worst?.cashImpact ?? null, unit: cur(pkg), kind: "hypothetical", source: pkg.finance.version, formula: pkg.finance.formula });
}

export function runwayMetric(pkg: Pkg): Metric {
  return metric({ id: "runway", label: "Liquidity runway", value: pkg.finance.baseline.runwayDays, unit: "days", kind: "derived", source: "Cash reserves ÷ daily fixed costs", formula: "cash reserves ÷ (monthly fixed costs ÷ 30)" });
}

export function dscrMetric(pkg: Pkg): Metric {
  return metric({ id: "dscr", label: "Debt-service coverage", value: pkg.finance.baseline.debtServiceCoverage, unit: "×", kind: "derived", source: "Business-reported figures", formula: "(revenue − fixed − variable costs) ÷ loan repayments, monthly" });
}

export function dailyRevenueMetric(pkg: Pkg): Metric {
  return metric({ id: "daily_revenue", label: "Average daily revenue", value: pkg.finance.baseline.dailyRevenue, unit: cur(pkg), kind: "derived", source: "Monthly revenue ÷ 30" });
}

export function highExposureCount(pkg: Pkg) {
  return pkg.exposure.filter((item) => item.combined === "high").length;
}

// Charts ---------------------------------------------------------------------------

export function forecastChart(pkg: Pkg): ChartSpec | null {
  const forecast = pkg.climate.forecast;
  if (!forecast.length) return null;
  const threshold = pkg.climate.forecastStats.userThresholdC;
  return {
    id: "forecast",
    kind: "composed",
    title: "Daily forecast at the site",
    unit: "mm rain",
    rightUnit: "°C",
    period: `${pkg.climate.forecastWindow.from} to ${pkg.climate.forecastWindow.to}`,
    source: "Open-Meteo forecast API",
    explanation: "Bars show forecast daily rainfall; the line shows forecast daily maximum temperature. Forecast skill falls after the first week.",
    xKey: "date",
    series: [
      { key: "precipMm", label: "Rainfall (mm)", type: "bar", axis: "left" },
      { key: "tmaxC", label: "Max temperature (°C)", type: "line", axis: "right" },
    ],
    data: forecast.map((day) => ({ date: day.date.slice(5), precipMm: day.precipMm, tmaxC: day.tmaxC })),
    referenceLines: threshold === null ? [{ value: 35, label: "35 °C", axis: "right" }] : [{ value: threshold, label: `Your work threshold ${threshold} °C`, axis: "right" }],
  };
}

export function exposureChart(pkg: Pkg): ChartSpec {
  return {
    id: "exposure_matrix",
    kind: "bar",
    title: "Climate signal, business sensitivity and combined exposure by hazard",
    unit: "level (low 20, medium 50, high 80)",
    period: assessed(pkg),
    source: "Engine E exposure rules",
    explanation: "Each hazard is rated on climate evidence and on how sensitive this business reported it is. Unknown levels are left blank, not shown as low.",
    xKey: "hazard",
    series: [
      { key: "climate", label: "Climate signal", type: "bar" },
      { key: "sensitivity", label: "Business sensitivity", type: "bar" },
      { key: "combined", label: "Combined exposure", type: "bar" },
    ],
    data: pkg.exposure.map((item) => ({ hazard: item.label, climate: LEVEL_SCORE[item.climate.overall], sensitivity: LEVEL_SCORE[item.sensitivity.level], combined: LEVEL_SCORE[item.combined] })),
  };
}

export function scenarioChart(pkg: Pkg): ChartSpec | null {
  const available = pkg.finance.scenarios.filter((item) => item.available);
  if (!available.length) return null;
  return {
    id: "scenario_impacts",
    kind: "horizontalBar",
    title: "Cash impact of each hypothetical scenario",
    unit: cur(pkg),
    period: "Single event, hypothetical",
    source: "Engine F scenario set " + pkg.finance.version,
    explanation: "Margin lost (revenue lost minus variable costs avoided) plus any one-off recovery cost. Scenarios are not predictions.",
    xKey: "scenario",
    series: [
      { key: "marginLost", label: "Margin lost", type: "bar", stack: "impact" },
      { key: "recoveryCost", label: "Recovery cost", type: "bar", stack: "impact" },
    ],
    data: available.map((item) => ({ scenario: item.label, marginLost: item.marginLost, recoveryCost: item.recoveryCost ?? 0 })),
  };
}

export function liquidityChart(pkg: Pkg): ChartSpec | null {
  const base = pkg.finance.baseline;
  const rows = pkg.finance.scenarios.filter((item) => item.available && item.cashAfter !== null);
  if (base.cash === null || !rows.length) return null;
  return {
    id: "cash_after",
    kind: "horizontalBar",
    title: "Cash remaining after each scenario",
    unit: cur(pkg),
    period: "Single event, hypothetical",
    source: "Business-reported cash reserves; Engine F",
    explanation: "Reported cash reserves minus the scenario cash impact, before normal monthly surplus and before any credit line or insurance recovery.",
    xKey: "scenario",
    series: [{ key: "cashAfter", label: "Cash after scenario", type: "bar" }],
    data: [{ scenario: "Today (reported)", cashAfter: base.cash }, ...rows.map((item) => ({ scenario: item.label, cashAfter: item.cashAfter }))],
    referenceLines: [{ value: 0, label: "Zero cash" }],
  };
}

export function resilienceChart(pkg: Pkg): ChartSpec {
  return {
    id: "resilience_dimensions",
    kind: "radar",
    title: "Resilience by dimension",
    unit: "score out of 100 (higher is more resilient)",
    period: assessed(pkg),
    source: pkg.resilience.version,
    explanation: "Dimensions without data are shown at zero on the chart and listed as unknown in the table; they are not counted in the overall score.",
    xKey: "dimension",
    series: [{ key: "score", label: "Score" }],
    data: pkg.resilience.dimensions.map((item) => ({ dimension: item.label, score: item.score })),
  };
}

export function riskDimensionChart(pkg: Pkg): ChartSpec {
  return {
    id: "risk_dimensions",
    kind: "horizontalBar",
    title: "Climate-adjusted risk by dimension",
    unit: "score out of 100 (higher is more risk)",
    period: assessed(pkg),
    source: pkg.risk.version,
    explanation: "Each dimension is computed separately. Missing dimensions are excluded and the weights of the rest are renormalised.",
    xKey: "dimension",
    series: [{ key: "score", label: "Risk score" }],
    data: pkg.risk.dimensions.map((item) => ({ dimension: item.label, score: item.score })),
  };
}

export function historyChart(pkg: Pkg): ChartSpec | null {
  const series = pkg.history.series;
  if (!series.length) return null;
  const hasWeather = series.some((item) => item.precipMm !== null);
  return {
    id: "revenue_history",
    kind: "composed",
    title: hasWeather ? "Monthly revenue and observed rainfall" : "Monthly revenue",
    unit: "% of period average revenue",
    rightUnit: hasWeather ? "mm rain" : undefined,
    period: `${pkg.history.window.from} to ${pkg.history.window.to}`,
    source: hasWeather ? "Business-reported revenue; ERA5 reanalysis via Open-Meteo" : "Business-reported revenue",
    explanation: "Revenue is shown as a percentage of the average month in the period so different scales can be compared. Rainfall is the observed monthly total at the site grid cell.",
    xKey: "month",
    series: [
      ...(hasWeather ? [{ key: "precipMm", label: "Rainfall (mm)", type: "bar" as const, axis: "right" as const }] : []),
      { key: "revenueIndex", label: "Revenue index (%)", type: "line", axis: "left" },
    ],
    data: series.map((item) => ({ month: item.month, revenueIndex: item.revenueIndex, precipMm: item.precipMm })),
    referenceLines: [{ value: 100, label: "Period average", axis: "left" }],
  };
}

export function projectionChart(pkg: Pkg): ChartSpec | null {
  const changes = pkg.climate.projections.changes.filter((item) => item.key === "hotDaysPerYear" || item.key === "heavyRainDaysPerYear");
  if (!changes.length) return null;
  return {
    id: "projections",
    kind: "bar",
    title: "Projected change in hot and heavy-rain days",
    unit: "days per year",
    period: `${pkg.climate.projections.baseline} versus ${pkg.climate.projections.future}`,
    source: `CMIP6 HighResMIP via Open-Meteo (${pkg.climate.projections.models.join(", ")})`,
    explanation: "Median of the models for the baseline and the future period. A plausible future climate under a high-emissions pathway, not a forecast for a given year.",
    xKey: "metric",
    series: [
      { key: "baseline", label: "Baseline", type: "bar" },
      { key: "future", label: "Future", type: "bar" },
    ],
    data: changes.map((item) => ({ metric: item.label, baseline: item.baseline, future: Math.round((item.baseline + item.change) * 10) / 10 })),
  };
}

export function supplierChart(pkg: Pkg): ChartSpec | null {
  const rows = pkg.supply.suppliers.filter((item) => item.substitutionDays !== null || item.bufferDays !== null);
  if (!rows.length) return null;
  return {
    id: "supplier_buffers",
    kind: "horizontalBar",
    title: "Buffer stock against time to switch supplier",
    unit: "days",
    period: assessed(pkg),
    source: "Business-reported supplier register",
    explanation: "Where switching takes longer than the buffer lasts, the gap is the number of days without that input.",
    xKey: "supplier",
    series: [
      { key: "bufferDays", label: "Buffer stock (days)", type: "bar" },
      { key: "substitutionDays", label: "Time to switch (days)", type: "bar" },
    ],
    data: rows.map((item) => ({ supplier: item.name, bufferDays: item.bufferDays, substitutionDays: item.substitutionDays })),
  };
}

export function downtimeChart(pkg: Pkg): ChartSpec | null {
  const rows = pkg.operations.scenarioDays;
  if (!rows.length) return null;
  const tolerance = pkg.operations.toleranceDays;
  return {
    id: "downtime",
    kind: "horizontalBar",
    title: "Scenario disruption length against downtime the business can absorb",
    unit: "days",
    period: "Hypothetical scenarios",
    source: "Engine F scenarios; business-reported tolerance",
    explanation: tolerance === null ? "Maximum tolerable downtime was not reported, so no tolerance line is drawn." : `The line marks the reported maximum tolerable downtime of ${tolerance} days.`,
    xKey: "scenario",
    series: [{ key: "days", label: "Disruption days", type: "bar" }],
    data: rows.map((item) => ({ scenario: item.label, days: item.days })),
    referenceLines: tolerance === null ? [] : [{ value: tolerance, label: "Tolerance" }],
  };
}

// Tables ---------------------------------------------------------------------------

export function scenarioTable(pkg: Pkg): TableSpec {
  const c = cur(pkg);
  return {
    id: "scenarios",
    title: "Scenario results",
    columns: [
      { key: "scenario", label: "Scenario" },
      { key: "days", label: "Days", align: "right" },
      { key: "loss", label: "Output lost", align: "right" },
      { key: "revenue", label: `Revenue lost (${c})`, align: "right" },
      { key: "impact", label: `Cash impact (${c})`, align: "right" },
      { key: "pct", label: "Cash impact, % of monthly revenue", align: "right" },
      { key: "cashAfter", label: `Cash after (${c})`, align: "right" },
      { key: "dscr", label: "Stressed coverage", align: "right" },
    ],
    rows: pkg.finance.scenarios.map((item) => ({
      scenario: item.label,
      days: item.days === null ? "—" : item.days,
      loss: item.outputLoss === null ? "—" : `${Math.round(item.outputLoss * 100)}%`,
      revenue: item.available ? item.revenueLost : item.unavailableReason,
      impact: item.cashImpact,
      pct: item.impactPctMonthlyRevenue,
      cashAfter: item.cashAfter,
      dscr: item.stressedDebtServiceCoverage,
    })),
    note: pkg.finance.formula,
  };
}

export function parameterTable(pkg: Pkg): TableSpec {
  return {
    id: "scenario_parameters",
    title: "Scenario parameters and where they come from",
    columns: [
      { key: "scenario", label: "Scenario" },
      { key: "parameter", label: "Parameter" },
      { key: "value", label: "Value" },
      { key: "origin", label: "Origin" },
    ],
    rows: pkg.finance.scenarios.flatMap((item) => item.parameters.map((parameter) => ({ scenario: item.label, parameter: parameter.name, value: parameter.value, origin: humanize(parameter.origin) }))),
    note: "Platform assumptions are fixed, documented scenario settings, not estimates for this business. Business-reported values come from the questionnaire.",
  };
}

export function exposureTable(pkg: Pkg): TableSpec {
  return {
    id: "exposure",
    title: "Hazard exposure summary",
    columns: [
      { key: "hazard", label: "Hazard" },
      { key: "nearTerm", label: "Forecast screen" },
      { key: "regional", label: "Regional context" },
      { key: "history", label: "Past incidents" },
      { key: "sensitivity", label: "Business sensitivity" },
      { key: "preparedness", label: "Preparedness" },
      { key: "combined", label: "Combined exposure" },
    ],
    rows: pkg.exposure.map((item) => ({
      hazard: item.label,
      nearTerm: LEVEL_TEXT[item.climate.nearTerm],
      regional: LEVEL_TEXT[item.climate.regional],
      history: LEVEL_TEXT[item.climate.history],
      sensitivity: LEVEL_TEXT[item.sensitivity.level],
      preparedness: LEVEL_TEXT[item.preparedness.level],
      combined: LEVEL_TEXT[item.combined],
    })),
    note: "Combined exposure multiplies the climate level by the sensitivity level (low 1, medium 2, high 3): 6 or more is high, 3 or more medium. If either is unknown the result is unknown, unless the other is high, which gives medium.",
  };
}

export function dimensionTable(id: string, title: string, dimensions: Array<{ label: string; score: number | null; effectiveWeight: number | null; basis: string }>): TableSpec {
  return {
    id,
    title,
    columns: [
      { key: "dimension", label: "Dimension" },
      { key: "score", label: "Score", align: "right" },
      { key: "weight", label: "Weight used", align: "right" },
      { key: "basis", label: "Basis" },
    ],
    rows: dimensions.map((item) => ({ dimension: item.label, score: item.score ?? "unknown", weight: item.effectiveWeight === null ? "excluded" : `${Math.round(item.effectiveWeight * 100)}%`, basis: item.basis })),
  };
}

// Sections -------------------------------------------------------------------------

export function businessSection(pkg: Pkg): ReportSection {
  const b = pkg.business;
  return section("business_profile", "Business profile", {
    tables: [{
      id: "profile",
      title: "Business at a glance",
      columns: [{ key: "field", label: "Field" }, { key: "value", label: "Value" }],
      rows: [
        { field: "Business", value: b.name },
        { field: "Activity", value: `${b.activityLabel}${b.isicSection ? ` (ISIC ${b.isicSection})` : ""}` },
        { field: "Enterprise size", value: humanize(b.sizeBand) },
        { field: "Employees", value: b.employees ?? b.employeeBand ?? "not answered" },
        { field: "Main customers", value: b.customerTypes.join(", ") || "not answered" },
        { field: "Operating days and shifts", value: `${b.operatingDays ? `${b.operatingDays} days a week` : "not answered"}${b.shiftPattern ? `, ${humanize(b.shiftPattern)} shift` : ""}` },
        { field: "Seasonality", value: `${humanize(b.seasonality)}${b.peakMonths.length ? ` (peaks: ${monthNames(b.peakMonths)})` : ""}` },
        { field: "Assessed site", value: `${pkg.site.label} (${pkg.site.latitude.toFixed(4)}, ${pkg.site.longitude.toFixed(4)}; ${humanize(pkg.site.precision)})` },
        { field: "Financial figures", value: b.finance.shared ? `Shared, ${b.finance.currency}, ${b.finance.period} basis, ${humanize(b.finance.basis)}` : "Not shared" },
      ],
    }],
  });
}

export function financialBaselineSection(pkg: Pkg): ReportSection {
  const base = pkg.finance.baseline;
  const c = cur(pkg);
  if (!pkg.business.finance.shared) {
    return section("financial_baseline", "Financial baseline", { callouts: [{ tone: "warning", text: "Financial figures were not shared, so revenue, liquidity and debt-service figures are not shown. Nothing has been estimated in their place." }] });
  }
  return section("financial_baseline", "Financial baseline", {
    metrics: [
      metric({ id: "monthly_revenue", label: "Monthly revenue", value: base.monthlyRevenue, unit: c, kind: "reported", source: "Business questionnaire" }),
      metric({ id: "monthly_fixed", label: "Monthly fixed costs", value: base.monthlyFixed, unit: c, kind: "reported", source: "Business questionnaire" }),
      metric({ id: "monthly_variable", label: "Monthly variable costs", value: base.monthlyVariable, unit: c, kind: "reported", source: "Business questionnaire" }),
      metric({ id: "monthly_surplus", label: "Monthly operating surplus", value: base.monthlySurplus, unit: c, kind: "derived", source: "Revenue − fixed − variable costs" }),
      metric({ id: "operating_margin", label: "Operating margin", value: base.operatingMarginPct, unit: "%", kind: "derived", source: "Surplus ÷ revenue" }),
      metric({ id: "cash", label: "Cash reserves", value: base.cash, unit: c, kind: "reported", source: "Business questionnaire" }),
      runwayMetric(pkg),
      metric({ id: "runway_credit", label: "Runway including undrawn credit", value: base.runwayWithCreditDays, unit: "days", kind: "derived", source: "(Cash + undrawn credit) ÷ daily fixed costs" }),
      dscrMetric(pkg),
      metric({ id: "working_capital", label: "Net working capital", value: base.workingCapital, unit: c, kind: "derived", source: "Receivables + inventory − payables" }),
      metric({ id: "receivable_days", label: "Receivable days", value: base.receivableDays, unit: "days", kind: "derived", source: "Receivables ÷ daily revenue" }),
    ],
    bullets: base.notes,
  });
}

export function hazardSection(pkg: Pkg, hazard: Hazard): ReportSection {
  const item = pkg.exposure.find((entry) => entry.hazard === hazard)!;
  const screen = pkg.climate.screens.find((entry) => entry.hazard === hazard)!;
  const c = cur(pkg);
  return section(`hazard_${hazard}`, HAZARD_LABEL[hazard], {
    paragraphs: [screen.summary],
    tables: [
      {
        id: `${hazard}_factors`,
        title: "Evidence considered",
        columns: [{ key: "type", label: "Type" }, { key: "factor", label: "Factor" }, { key: "level", label: "Level" }, { key: "basis", label: "Basis" }],
        rows: [
          ...item.climate.factors.map((factor) => ({ type: "Climate", factor: factor.label, level: LEVEL_TEXT[factor.level], basis: factor.basis })),
          ...item.sensitivity.factors.map((factor) => ({ type: "Business", factor: factor.label, level: LEVEL_TEXT[factor.level], basis: factor.basis })),
        ],
      },
      ...(item.pathways.length
        ? [{
            id: `${hazard}_pathways`,
            title: "How this hazard would reach the business",
            columns: [{ key: "pathway", label: "Impact pathway" }, { key: "relevance", label: "Relevance" }, { key: "basis", label: "Why" }],
            rows: item.pathways.map((pathway) => ({ pathway: pathway.pathway, relevance: LEVEL_TEXT[pathway.relevance], basis: pathway.basis })),
          }]
        : []),
    ],
    bullets: [
      `Combined exposure: ${LEVEL_TEXT[item.combined]} (climate ${LEVEL_TEXT[item.climate.overall].toLowerCase()}, sensitivity ${LEVEL_TEXT[item.sensitivity.level].toLowerCase()}).`,
      item.incidents.count ? `${item.incidents.count} past incident(s)${item.incidents.medianRecoveryDays !== null ? `, median recovery ${item.incidents.medianRecoveryDays} days` : ""}${item.incidents.totalLossReported !== null ? `, reported losses ${money(item.incidents.totalLossReported, c)}` : ""}.` : "No past incident of this type was reported.",
      `Measures in place: ${item.preparedness.inPlace.map(measureLabel).join(", ") || "none reported"}. Gaps: ${item.preparedness.gaps.map(measureLabel).join(", ") || "none reported"}${item.preparedness.unknown.length ? `. Unknown: ${item.preparedness.unknown.map(measureLabel).join(", ")}` : ""}.`,
    ],
    callouts: screen.status === "not_available" ? [{ tone: "warning", text: "The forecast screen for this hazard was not available. Missing evidence is shown as unknown, not as safe." }] : [],
  });
}

export function dataQualitySection(pkg: Pkg): ReportSection {
  return section("data_quality", "Data quality and coverage", {
    metrics: [
      metric({ id: "evidence_completeness", label: "Evidence completeness", value: Math.round(pkg.assessment.evidenceCompleteness * 100), unit: "%", kind: "derived", source: "Assessment evidence slots" }),
      metric({ id: "risk_coverage", label: "Risk dimensions with data", value: Math.round(pkg.risk.coverage * 100), unit: "% of weight", kind: "derived", source: pkg.risk.version }),
    ],
    tables: pkg.gaps.length
      ? [{ id: "gaps", title: "Missing information and its effect", columns: [{ key: "area", label: "Area" }, { key: "missing", label: "Missing" }, { key: "effect", label: "Effect on this report" }], rows: pkg.gaps.map((gap) => ({ ...gap })) }]
      : [],
    callouts: pkg.assessment.stale ? [{ tone: "warning", text: `The underlying assessment is out of date: ${pkg.assessment.staleReason ?? "inputs changed since it ran"}. Refresh the analysis before relying on this report.` }] : [],
  });
}

export function actionsFromPlan(pkg: Pkg, limit = 8): ReportAction[] {
  const fromPlan: ReportAction[] = pkg.adaptation.actions.map((action) => ({
    priority: action.priority,
    horizon: action.horizon,
    action: `${action.label}${action.cost ? ` (business estimate ${money(action.cost.amount, action.cost.currency ?? cur(pkg))})` : ""}`,
    rationale: action.why,
    evidence: [],
  }));
  const horizonOf = (text: string): ReportAction["horizon"] => (/before|now|24|72|forecast/i.test(text) ? "now" : /cycle|month/i.test(text) ? "30_days" : /season|quarter/i.test(text) ? "90_days" : "12_months");
  const fromAssessment: ReportAction[] = pkg.recommendations.map((item) => ({ priority: item.priority, horizon: horizonOf(item.horizon), action: item.action, rationale: `Vulnerability assessment evidence: ${item.evidence}`, evidence: [] }));
  const seen = new Set<string>();
  return [...fromAssessment.filter((item) => item.horizon === "now"), ...fromPlan, ...fromAssessment.filter((item) => item.horizon !== "now")]
    .filter((item) => (seen.has(item.action) ? false : (seen.add(item.action), true)))
    .sort((a, b) => ["high", "medium", "low"].indexOf(a.priority) - ["high", "medium", "low"].indexOf(b.priority))
    .slice(0, limit);
}

export function topThreats(pkg: Pkg, limit = 3): string[] {
  const order = { high: 0, medium: 1, low: 2, unknown: 3 } as const;
  return [...pkg.exposure]
    .sort((a, b) => order[a.combined] - order[b.combined])
    .filter((item) => item.combined === "high" || item.combined === "medium")
    .slice(0, limit)
    .map((item) => `${item.label}: ${LEVEL_TEXT[item.combined].toLowerCase()} combined exposure — climate ${LEVEL_TEXT[item.climate.overall].toLowerCase()}, sensitivity ${LEVEL_TEXT[item.sensitivity.level].toLowerCase()}.`);
}

export function financialVulnerabilities(pkg: Pkg): string[] {
  const base = pkg.finance.baseline;
  const c = cur(pkg);
  const lines: string[] = [];
  if (base.runwayDays !== null) lines.push(`Cash covers ${quantity(base.runwayDays, "days")} of fixed costs.`);
  if (base.debtServiceCoverage !== null) lines.push(`Monthly surplus covers loan repayments ${quantity(base.debtServiceCoverage, "times", 2)}.`);
  const worst = worstScenario(pkg);
  if (worst) lines.push(`Largest hypothetical impact: ${worst.label}, ${money(worst.cashImpact, c)} (${quantity(worst.impactPctMonthlyRevenue, "%", 1)} of a month's revenue).`);
  const negative = pkg.finance.scenarios.filter((item) => item.cashAfter !== null && item.cashAfter < 0);
  if (negative.length) lines.push(`Cash would run out in ${negative.length} scenario(s): ${negative.map((item) => item.label).join(", ")}.`);
  if (!lines.length) lines.push("Financial vulnerability cannot be described because figures were not shared.");
  return lines;
}
