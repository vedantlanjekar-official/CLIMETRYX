import type { FinancialImpact } from "./financial";
import type { BusinessProfile } from "./normalize";
import { round, type Level } from "./types";

export function supplyChainProfile(business: BusinessProfile) {
  const suppliers = business.suppliers.map((supplier) => {
    const gap = supplier.substitutionDays === null ? null : Math.max(0, supplier.substitutionDays - (supplier.bufferDays ?? 0));
    const flags = [
      supplier.singleSource === "yes" ? "single source" : null,
      supplier.alternative === "no" ? "no alternative identified" : null,
      supplier.spendShare !== null && supplier.spendShare >= 0.5 ? "half or more of purchases" : null,
      supplier.bufferDays !== null && supplier.bufferDays < 3 ? "under 3 days of buffer stock" : null,
      gap !== null && gap > 7 ? `${gap} days without input before a substitute arrives` : null,
    ].filter((flag): flag is string => flag !== null);
    const level: Level = supplier.criticality !== "critical" ? "low" : flags.length >= 3 ? "high" : flags.length >= 1 ? "medium" : "low";
    return { ...supplier, gapDays: gap, flags, level };
  });
  const shares = suppliers.map((item) => item.spendShare).filter((value): value is number => value !== null);
  const hhi = shares.length ? round(shares.reduce((sum, share) => sum + (share * 100) ** 2, 0)) : null;
  return {
    suppliers,
    criticalCount: suppliers.filter((item) => item.criticality === "critical").length,
    singleSourceCount: suppliers.filter((item) => item.singleSource === "yes").length,
    concentrationIndex: hhi,
    concentrationNote: hhi === null
      ? "Spend shares were not supplied, so concentration is not calculated."
      : `Herfindahl index over the ${shares.length} supplier(s) with a spend share (0–10,000; above 2,500 is usually read as concentrated). This index is ${hhi.toLocaleString("en-IN")}, ${hhi > 2500 ? "above" : "at or below"} that level. Suppliers not entered are not included.`,
    regionalHazardNote: "Supplier locations are recorded as text and are not geocoded, so climate hazard at supplier sites is not assessed.",
  };
}

const OUTAGE_ORDER = ["none", "yearly", "monthly", "weekly", "daily"];

export function operationalProfile(business: BusinessProfile, finance: FinancialImpact) {
  const ops = business.operations;
  const dependencies = [
    { name: "Electricity", level: ops.electricity },
    { name: "Water", level: ops.water },
    { name: "Cooling or refrigeration", level: ops.cooling },
    { name: "Telecoms and internet", level: ops.telecom },
    { name: "Road access and transport", level: ops.transport },
  ];
  const utilities = (["electricity", "water", "telecom"] as const).map((name) => {
    const record = business.utilities[name];
    const rank = record.outages ? OUTAGE_ORDER.indexOf(record.outages) : -1;
    return { utility: name, ...record, frequent: rank >= 2 };
  });
  const tolerance = finance.baseline.toleranceDays;
  const scenarioDays = finance.scenarios
    .filter((item) => item.days !== null)
    .map((item) => ({ id: item.id, label: item.label, days: item.days!, exceedsTolerance: tolerance === null ? null : item.days! > tolerance }));
  const impacts = new Map<string, number>();
  for (const incident of business.incidents) for (const impact of incident.impacts) impacts.set(impact, (impacts.get(impact) ?? 0) + 1);
  return {
    dependencies,
    utilities,
    toleranceDays: tolerance,
    scenarioDays,
    perishable: ops.perishable,
    outdoorWork: ops.outdoorWork,
    inventoryDays: ops.inventoryDays,
    commute: ops.commute,
    criticalEquipment: ops.criticalEquipment,
    shiftPattern: business.shiftPattern,
    operatingDays: business.operatingDays,
    incidentImpacts: [...impacts.entries()].map(([impact, count]) => ({ impact, count })).sort((a, b) => b.count - a.count),
  };
}
