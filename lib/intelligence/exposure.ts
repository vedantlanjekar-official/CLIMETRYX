import type { ClimateSummary } from "./climate";
import type { BusinessProfile, Incident } from "./normalize";
import { HAZARDS, HAZARD_LABEL, round, type Hazard, type Level } from "./types";

export const EXPOSURE_RULES_VERSION = "exposure-rules-1.0";

const RANK: Record<Level, number> = { unknown: 0, low: 1, medium: 2, high: 3 };
const fromRank = (rank: number): Level => (rank >= 3 ? "high" : rank === 2 ? "medium" : rank === 1 ? "low" : "unknown");
const worst = (levels: Level[]): Level => fromRank(Math.max(0, ...levels.map((level) => RANK[level])));

export interface Factor {
  label: string;
  level: Level;
  basis: string;
}

export interface ImpactPathway {
  hazard: Hazard;
  pathway: string;
  relevance: Level;
  basis: string;
}

export interface HazardExposure {
  hazard: Hazard;
  label: string;
  climate: { nearTerm: Level; regional: Level; history: Level; overall: Level; factors: Factor[] };
  sensitivity: { level: Level; factors: Factor[] };
  preparedness: { inPlace: string[]; gaps: string[]; unknown: string[]; level: Level };
  incidents: { count: number; medianRecoveryDays: number | null; totalLossReported: number | null; currency: string | null };
  combined: Level;
  pathways: ImpactPathway[];
}

export const HAZARD_MEASURES: Record<Hazard, string[]> = {
  flood: ["drainage", "floodProtection", "inventoryProtection", "backupSite"],
  heat: ["cooling", "workerSafety", "backupPower"],
  drought: ["waterStorage", "alternateSuppliers"],
  storm: ["emergencyProcedures", "backupPower", "inventoryProtection"],
};

const INCIDENT_HAZARD: Record<Hazard, string[]> = { flood: ["flood"], heat: ["heat"], drought: ["drought"], storm: ["storm"] };

function screenLevel(score: number | null): Level {
  if (score === null) return "unknown";
  return score >= 60 ? "high" : score >= 40 ? "medium" : "low";
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

function incidentStats(incidents: Incident[], currency: string) {
  const recovery = incidents.map((item) => item.recoveryDays).filter((value): value is number => value !== null);
  const losses = incidents.filter((item) => item.estimatedLoss !== null && (item.lossCurrency ?? currency) === currency);
  return {
    count: incidents.length,
    medianRecoveryDays: median(recovery),
    totalLossReported: losses.length ? losses.reduce((sum, item) => sum + item.estimatedLoss!, 0) : null,
    currency: losses.length ? currency : null,
  };
}

const dependencyLevel = (value: string | null): Level =>
  value === "critical" || value === "high" ? "high" : value === "moderate" ? "medium" : value === "low" || value === "none" ? "low" : "unknown";

function sensitivityFactors(hazard: Hazard, business: BusinessProfile): Factor[] {
  const answers = business.hazardSensitivity[hazard];
  const ops = business.operations;
  const factors: Factor[] = [];
  if (hazard === "flood") {
    const entry = answers.water_entry;
    if (typeof entry === "string" && entry !== "unknown") {
      factors.push({ label: "Water entering the premises", level: entry === "frequent" || entry === "occasional" ? "high" : entry === "rare" ? "medium" : "low", basis: `Reported frequency: ${entry}.` });
    }
    if (answers.access_cut === "yes" || answers.access_cut === "no") factors.push({ label: "Road access cut by heavy rain", level: answers.access_cut === "yes" ? "high" : "low", basis: `Reported: ${answers.access_cut}.` });
    if (typeof answers.stock_height_cm === "number") factors.push({ label: "Stock height above floor", level: answers.stock_height_cm < 15 ? "high" : answers.stock_height_cm < 50 ? "medium" : "low", basis: `${answers.stock_height_cm} cm reported.` });
    if (ops.transport) factors.push({ label: "Dependence on road transport", level: dependencyLevel(ops.transport), basis: `Reported dependency: ${ops.transport}.` });
  }
  if (hazard === "heat") {
    const cooling = answers.cooling;
    if (typeof cooling === "string") factors.push({ label: "Indoor cooling", level: cooling === "none" ? "high" : cooling === "fans" ? "medium" : "low", basis: `Reported cooling: ${cooling}.` });
    if (answers.sensitive_processes === "yes" || answers.sensitive_processes === "no") factors.push({ label: "Heat-sensitive processes or products", level: answers.sensitive_processes === "yes" ? "high" : "low", basis: `Reported: ${answers.sensitive_processes}.` });
    if (ops.outdoorWork === "yes" || ops.outdoorWork === "no") factors.push({ label: "Outdoor or unconditioned work", level: ops.outdoorWork === "yes" ? "high" : "low", basis: `Reported: ${ops.outdoorWork}.` });
    if (ops.cooling) factors.push({ label: "Dependence on cooling or refrigeration", level: dependencyLevel(ops.cooling), basis: `Reported dependency: ${ops.cooling}.` });
  }
  if (hazard === "drought") {
    const effect = answers.effect;
    if (typeof effect === "string" && effect !== "unknown") factors.push({ label: "Effect of a week-long water shortage", level: effect === "stops" ? "high" : effect === "reduces" ? "medium" : "low", basis: `Reported effect: ${effect}.` });
    if (answers.rainfall_dependent === "yes" || answers.rainfall_dependent === "no") factors.push({ label: "Revenue depends on local rainfall", level: answers.rainfall_dependent === "yes" ? "high" : "low", basis: `Reported: ${answers.rainfall_dependent}.` });
    if (ops.water) factors.push({ label: "Dependence on water supply", level: dependencyLevel(ops.water), basis: `Reported dependency: ${ops.water}.` });
  }
  if (hazard === "storm") {
    const roof = answers.roof;
    if (typeof roof === "string") factors.push({ label: "Roof construction", level: roof === "temporary" || roof === "metal_sheet" ? "high" : roof === "rcc" ? "low" : "medium", basis: `Reported roof: ${roof}.` });
    if (answers.outdoor_assets === "yes" || answers.outdoor_assets === "no") factors.push({ label: "Assets stored outside", level: answers.outdoor_assets === "yes" ? "medium" : "low", basis: `Reported: ${answers.outdoor_assets}.` });
    if (ops.electricity) factors.push({ label: "Dependence on electricity", level: dependencyLevel(ops.electricity), basis: `Reported dependency: ${ops.electricity}.` });
  }
  return factors;
}

function regionalFactors(hazard: Hazard, climate: ClimateSummary): Factor[] {
  const factors: Factor[] = [];
  const change = (key: string) => climate.projections.changes.find((item) => item.key === key);
  if (hazard === "flood") {
    const share = climate.floodExposure.shareAtLeastModerate;
    if (share !== null) factors.push({ label: "Modelled 1-in-100-year flood exposure nearby", level: share >= 25 ? "high" : share >= 5 ? "medium" : "low", basis: `${share}% of nearby residents live where modelled depth exceeds 0.15 m.` });
    const river = climate.river;
    if (river.peakForecastM3s !== null && river.annualMaxMedianM3s !== null) {
      const level: Level = river.annualMax90thM3s !== null && river.peakForecastM3s >= river.annualMax90thM3s ? "high" : river.peakForecastM3s >= river.annualMaxMedianM3s ? "medium" : "low";
      factors.push({ label: "Forecast river discharge", level, basis: `Forecast peak ${river.peakForecastM3s} m³/s against a median annual maximum of ${river.annualMaxMedianM3s} m³/s.` });
    }
    const heavy = change("heavyRainDaysPerYear");
    if (heavy) factors.push({ label: "Projected change in heavy-rain days", level: heavy.change > 1 ? "medium" : "low", basis: `${heavy.change > 0 ? "+" : ""}${heavy.change} ${heavy.unit} (${climate.projections.future} vs ${climate.projections.baseline}); ${heavy.agreement}.` });
  }
  if (hazard === "heat") {
    const hot = change("hotDaysPerYear");
    if (hot) factors.push({ label: "Projected change in days at or above 35 °C", level: hot.change >= 20 ? "high" : hot.change >= 5 ? "medium" : "low", basis: `${hot.change > 0 ? "+" : ""}${hot.change} ${hot.unit} (${climate.projections.future} vs ${climate.projections.baseline}); ${hot.agreement}.` });
  }
  if (hazard === "drought") {
    const rain = change("annualPrecipMm");
    if (rain) factors.push({ label: "Projected change in annual rainfall", level: rain.change < -100 ? "medium" : "low", basis: `${rain.change > 0 ? "+" : ""}${rain.change} ${rain.unit}; ${rain.agreement}.` });
  }
  if (climate.alerts.active > 0) {
    const pattern = hazard === "flood" ? /rain|flood|inundat|cloudburst|cyclone/i : hazard === "storm" ? /storm|wind|cyclone|squall|gust|thunder/i : hazard === "heat" ? /heat|hot/i : /drought|dry/i;
    const matched = climate.alerts.matched.filter((alert) => pattern.test(alert.event));
    if (matched.length) factors.push({ label: "Official warnings in force", level: "high", basis: matched.map((alert) => alert.event).join("; ") });
  }
  return factors;
}

function pathwaysFor(hazard: Hazard, business: BusinessProfile, sensitivity: Factor[]): ImpactPathway[] {
  const ops = business.operations;
  const answers = business.hazardSensitivity[hazard];
  const level = (label: string) => sensitivity.find((factor) => factor.label === label)?.level ?? "unknown";
  const pathways: ImpactPathway[] = [];
  const add = (pathway: string, relevance: Level, basis: string) => pathways.push({ hazard, pathway, relevance, basis });
  const retailLike = ["retail", "hospitality"].includes(business.sector);
  if (hazard === "heat") {
    add("Workforce productivity and heat safety", worst([level("Outdoor or unconditioned work"), level("Indoor cooling")]), "Outdoor or poorly cooled work exposes staff to heat; the platform does not estimate a productivity loss rate.");
    if (ops.cooling || ops.perishable) add("Cooling and refrigeration load", worst([dependencyLevel(ops.cooling), ops.perishable === "yes" ? "high" : ops.perishable === "no" ? "low" : "unknown"]), "Hot days raise cooling demand; perishable stock depends on it.");
    if (business.sector === "manufacturing" || answers.sensitive_processes === "yes") add("Equipment and process limits", level("Heat-sensitive processes or products"), "Processes reported as failing in high heat.");
    if (retailLike) add("Customer footfall on hot days", "unknown", "Footfall effects are not measured; revenue history comparison is the only evidence used.");
  }
  if (hazard === "flood") {
    add("Site access for staff and deliveries", worst([level("Road access cut by heavy rain"), level("Dependence on road transport")]), "Heavy rain that cuts roads stops deliveries and attendance even without site flooding.");
    add("Stock and equipment damage", worst([level("Water entering the premises"), level("Stock height above floor")]), "Water entry and low stock storage determine damage potential.");
    if (ops.electricity) add("Power interruption", dependencyLevel(ops.electricity), "Flooding can interrupt local power supply; outages are not inferred from rainfall.");
  }
  if (hazard === "drought") {
    add("Process and cleaning water", worst([level("Effect of a week-long water shortage"), level("Dependence on water supply")]), "Water shortages reduce output where processes depend on water.");
    if (answers.rainfall_dependent === "yes" || business.sector === "agriculture") add("Rain-dependent customer demand", level("Revenue depends on local rainfall"), "Revenue tied to farm incomes or rainfall-dependent customers.");
  }
  if (hazard === "storm") {
    add("Roof and structure damage", level("Roof construction"), "Light roofs are more easily damaged by high winds.");
    add("Outdoor assets and signage", level("Assets stored outside"), "Unsecured outdoor items are exposed to wind.");
    if (ops.electricity || ops.telecom) add("Power and telecom loss", worst([dependencyLevel(ops.electricity), dependencyLevel(ops.telecom)]), "Storms commonly interrupt lines; outages are not inferred from forecasts.");
  }
  return pathways;
}

export function combineLevels(climate: Level, sensitivity: Level): Level {
  if (climate === "unknown" || sensitivity === "unknown") return climate === "high" || sensitivity === "high" ? "medium" : "unknown";
  const product = RANK[climate] * RANK[sensitivity];
  return product >= 6 ? "high" : product >= 3 ? "medium" : "low";
}

/** Engine E: per hazard, the climate signal and how this particular business would feel it. */
export function assessExposure(business: BusinessProfile, climate: ClimateSummary): HazardExposure[] {
  return HAZARDS.map((hazard) => {
    const screen = climate.screens.find((item) => item.hazard === hazard)!;
    const regional = regionalFactors(hazard, climate);
    const incidents = business.incidents.filter((item) => INCIDENT_HAZARD[hazard].includes(item.hazard));
    const stats = incidentStats(incidents, business.finance.currency);
    const historyLevel: Level = stats.count >= 2 ? "high" : stats.count === 1 ? "medium" : business.incidents.length || business.gaps.every((gap) => gap.area !== "History") ? "low" : "unknown";
    const nearTerm = screenLevel(screen.score);
    const regionalLevel = worst(regional.map((factor) => factor.level));
    const climateFactors: Factor[] = [
      { label: "Forecast screening (next days)", level: nearTerm, basis: screen.summary },
      ...regional,
      { label: "Past incidents reported", level: historyLevel, basis: stats.count ? `${stats.count} ${hazard} incident${stats.count === 1 ? "" : "s"} reported.` : "No incident of this type reported." },
    ];
    const sensitivity = sensitivityFactors(hazard, business);
    const sensitivityLevel = worst(sensitivity.map((factor) => factor.level));
    const relevant = HAZARD_MEASURES[hazard];
    const status = (key: string) => business.measures[key] ?? "unknown";
    const inPlace = relevant.filter((key) => status(key) === "implemented");
    const gaps = relevant.filter((key) => ["partial", "planned", "not_in_place"].includes(status(key)));
    const unknown = relevant.filter((key) => ["unknown"].includes(status(key)));
    const answered = inPlace.length + gaps.length;
    const preparedness: Level = answered === 0 ? "unknown" : inPlace.length / answered >= 0.67 ? "high" : inPlace.length / answered >= 0.34 ? "medium" : "low";
    const overall = worst([nearTerm, regionalLevel, historyLevel]);
    return {
      hazard,
      label: HAZARD_LABEL[hazard],
      climate: { nearTerm, regional: regionalLevel, history: historyLevel, overall, factors: climateFactors },
      sensitivity: { level: sensitivityLevel, factors: sensitivity },
      preparedness: { inPlace, gaps, unknown, level: preparedness },
      incidents: { ...stats, medianRecoveryDays: stats.medianRecoveryDays === null ? null : round(stats.medianRecoveryDays, 1) },
      combined: combineLevels(overall, sensitivityLevel),
      pathways: pathwaysFor(hazard, business, sensitivity),
    };
  });
}

export const LEVEL_SCORE: Record<Level, number | null> = { high: 80, medium: 50, low: 20, unknown: null };
