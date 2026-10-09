import type { TriState } from "@/lib/scoring/types";

export interface OperationsInput {
  electricityCritical: TriState;
  waterCritical: TriState;
  coolingCritical: TriState;
  perishableInventory: TriState;
  outdoorWorkforce: TriState;
  maxTolerableDowntimeHours: number | null;
}

export interface ResilienceInput {
  drainage: TriState;
  floodProtection: TriState;
  inventoryProtection: TriState;
  cooling: TriState;
  backupPower: TriState;
  waterStorage: TriState;
  emergencyProcedures: TriState;
  alternateSuppliers: TriState;
  bufferStock: TriState;
  backupSite: TriState;
  workerSafety: TriState;
  insurance: TriState;
  continuityPlan: TriState;
}

export interface SupplierInput {
  name: string;
  critical: boolean;
  spendShare: number | null;
  singleSource: TriState;
  alternativeAvailable: TriState;
  substitutionDays: number | null;
  inventoryBufferDays: number | null;
  /** Regional hazard score at the supplier, if a real source produced one. */
  regionalHazardScore: number | null;
}

interface Normalized {
  score: number | null;
  notes: string[];
  normalization: string;
}

function pushTri(
  items: Array<{ points: number; max: number }>,
  notes: string[],
  label: string,
  value: TriState,
  pointsIfYes: number,
): void {
  if (value === "unknown") {
    notes.push(`${label} is unknown and is excluded.`);
    return;
  }
  items.push({ points: value === "yes" ? pointsIfYes : 0, max: pointsIfYes });
}

export function operationalSensitivity(input: OperationsInput): Normalized {
  const items: Array<{ points: number; max: number }> = [];
  const notes: string[] = [];
  pushTri(items, notes, "Electricity-critical operations", input.electricityCritical, 20);
  pushTri(items, notes, "Water-critical operations", input.waterCritical, 15);
  pushTri(items, notes, "Cooling-critical operations", input.coolingCritical, 10);
  pushTri(items, notes, "Perishable inventory", input.perishableInventory, 15);
  pushTri(items, notes, "Outdoor workforce", input.outdoorWorkforce, 10);
  if (input.maxTolerableDowntimeHours === null) {
    notes.push("Maximum tolerable downtime is unknown and is excluded.");
  } else if (input.maxTolerableDowntimeHours < 0) {
    notes.push("Negative downtime was rejected.");
  } else {
    const points = input.maxTolerableDowntimeHours < 24 ? 20 : input.maxTolerableDowntimeHours < 72 ? 10 : 0;
    items.push({ points, max: 20 });
  }
  if (items.length === 0) {
    return {
      score: null,
      notes,
      normalization: "No answered operational questions, so sensitivity is not scored.",
    };
  }
  const score = Math.round((items.reduce((sum, item) => sum + item.points, 0) / items.reduce((sum, item) => sum + item.max, 0)) * 1000) / 10;
  return {
    score,
    notes,
    normalization:
      "Answered operational factors are summed and divided by their available maximum. Unknown answers are omitted.",
  };
}

export function adaptiveCapacityGap(input: ResilienceInput): Normalized {
  const entries = Object.entries(input) as Array<[string, TriState]>;
  const known = entries.filter(([, value]) => value !== "unknown");
  const notes = entries
    .filter(([, value]) => value === "unknown")
    .map(([key]) => `${key} is unknown and is not treated as protection or as a gap.`);
  if (known.length === 0) {
    return {
      score: null,
      notes,
      normalization: "No resilience answers were yes or no, so the adaptive-capacity gap is excluded.",
    };
  }
  const gaps = known.filter(([, value]) => value === "no").length;
  const score = Math.round((gaps / known.length) * 1000) / 10;
  return {
    score,
    notes,
    normalization:
      "Gap score is the share of answered measures reported as absent. Yes means the gap for that measure is closed. Unknown is excluded.",
  };
}

export function supplyChainVulnerability(suppliers: SupplierInput[]): Normalized {
  const critical = suppliers.filter((supplier) => supplier.critical);
  if (critical.length === 0) {
    return {
      score: null,
      notes: ["No critical supplier was entered. Supply-chain vulnerability is excluded rather than set to zero."],
      normalization: "Maximum score across critical suppliers. Non-critical suppliers do not set the component.",
    };
  }
  const scores = critical.map((supplier) => {
    let points = 0;
    const notes: string[] = [];
    if (supplier.spendShare !== null && supplier.spendShare >= 0.5) {
      points += 25;
      notes.push("spend share at least 50%");
    }
    if (supplier.singleSource === "yes") {
      points += 30;
      notes.push("single source");
    }
    if (supplier.alternativeAvailable === "no") {
      points += 20;
      notes.push("no alternative reported");
    }
    if (supplier.inventoryBufferDays !== null && supplier.inventoryBufferDays < 3) {
      points += 15;
      notes.push("inventory buffer under 3 days");
    }
    if (supplier.substitutionDays !== null && supplier.substitutionDays > 14) {
      points += 10;
      notes.push("substitution longer than 14 days");
    }
    if (supplier.regionalHazardScore !== null && supplier.regionalHazardScore >= 60) {
      points += 15;
      notes.push("supplier location has elevated regional hazard context; this is exposure, not a confirmed interruption");
    }
    return { name: supplier.name, points: Math.min(100, points), notes };
  });
  const score = Math.max(...scores.map((item) => item.points));
  return {
    score,
    notes: scores.map((item) => `${item.name}: supplier concentration ${item.points}/100 (${item.notes.join(", ") || "no concentration flags"}).`),
    normalization:
      "The component uses the highest critical-supplier score, capped at 100. Unknown supplier fields add no points and are not treated as safe diversification.",
  };
}
