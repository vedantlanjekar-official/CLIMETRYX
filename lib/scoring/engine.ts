import {
  COMPONENT_DEFINITIONS,
  METHODOLOGY_VERSION,
  SCORE_DIRECTION,
  type AssessmentCompleteness,
  type ComponentId,
  type ComponentScore,
  type EvidenceSlot,
  type ScoreChange,
  type ScoreComponentInput,
  type VulnerabilityScore,
} from "@/lib/scoring/types";

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function vulnerabilityBand(score: number): string {
  if (score < 25) return "Lower estimated disruption vulnerability";
  if (score < 50) return "Moderate estimated disruption vulnerability";
  if (score < 75) return "Elevated estimated disruption vulnerability";
  return "High estimated disruption vulnerability";
}

export function scoreVulnerability(
  inputs: ScoreComponentInput[],
  evidenceSlots: EvidenceSlot[],
): VulnerabilityScore {
  const byId = new Map(inputs.map((input) => [input.id, input]));
  const limitations: string[] = [];
  const explanation: string[] = [
    SCORE_DIRECTION,
    `Methodology ${METHODOLOGY_VERSION}. Baseline weights are explicit assumptions and are not statistically calibrated.`,
  ];

  const components: ComponentScore[] = COMPONENT_DEFINITIONS.map((definition) => {
    const input = byId.get(definition.id);
    if (!input || input.value === null || Number.isNaN(input.value)) {
      return {
        id: definition.id,
        label: definition.label,
        score: null,
        baselineWeight: definition.baselineWeight,
        effectiveWeight: null,
        included: false,
        evidenceKind: input?.evidenceKind ?? "missing",
        source: input?.source ?? "not provided",
        normalization: input?.normalization ?? "Excluded because the value is missing.",
        notes: input?.notes ?? [],
        reasonExcluded: "Missing values are excluded. They are not treated as zero vulnerability.",
      };
    }
    if (input.value < 0 || input.value > 100) {
      limitations.push(`${definition.label} was outside 0–100 and was excluded.`);
      return {
        id: definition.id,
        label: definition.label,
        score: null,
        baselineWeight: definition.baselineWeight,
        effectiveWeight: null,
        included: false,
        evidenceKind: input.evidenceKind,
        source: input.source,
        normalization: input.normalization,
        notes: input.notes,
        reasonExcluded: "Value outside the documented 0–100 range.",
      };
    }
    return {
      id: definition.id,
      label: definition.label,
      score: round1(input.value),
      baselineWeight: definition.baselineWeight,
      effectiveWeight: null,
      included: true,
      evidenceKind: input.evidenceKind,
      source: input.source,
      normalization: input.normalization,
      notes: [...input.notes, ...(input.stale ? ["Source is marked stale."] : [])],
    };
  });

  const included = components.filter((component) => component.included && component.score !== null);
  const baselineIncluded = included.reduce((sum, component) => sum + component.baselineWeight, 0);
  const renormalized = included.length > 0 && Math.abs(baselineIncluded - 1) > 0.0001;

  if (renormalized) {
    explanation.push(
      `Included baseline weights sum to ${round1(baselineIncluded * 100)}%, so they were renormalized to 100% of the included components. Excluded components were not imputed.`,
    );
  }

  for (const component of included) {
    const effective = baselineIncluded === 0 ? 0 : component.baselineWeight / baselineIncluded;
    component.effectiveWeight = round1(effective * 1000) / 1000;
    explanation.push(
      `${component.label}: ${component.score} contributed with effective weight ${round1(effective * 100)}% (${component.evidenceKind}, ${component.source}). ${component.normalization}`,
    );
  }

  for (const component of components.filter((item) => !item.included)) {
    explanation.push(`${component.label}: excluded. ${component.reasonExcluded}`);
  }

  const hazard = components.find((component) => component.id === "hazard");
  const availableSlots = evidenceSlots.filter((slot) => slot.available).length;
  const evidenceCompleteness =
    evidenceSlots.length === 0 ? 0 : round1((availableSlots / evidenceSlots.length) * 100);

  let status: AssessmentCompleteness = "complete";
  let score: number | null = null;

  if (included.length === 0) {
    status = "incomplete";
    limitations.push("No component had usable evidence, so no vulnerability number is shown.");
  } else {
    score = round1(
      included.reduce(
        (sum, component) => sum + (component.score ?? 0) * (component.effectiveWeight ?? 0),
        0,
      ),
    );
    if (!hazard?.included) {
      status = "partial";
      limitations.push(
        "Environmental hazard evidence is missing. The number uses only the remaining business-reported components and is not a low-risk finding.",
      );
    }
    if (included.length < COMPONENT_DEFINITIONS.length) {
      status = status === "complete" ? "partial" : status;
      limitations.push("One or more components were unavailable and were left out of the weighted average.");
    }
    const missingRequired = evidenceSlots.filter((slot) => slot.requiredForComplete && !slot.available);
    if (missingRequired.length > 0) {
      status = "partial";
      limitations.push(
        `Required evidence still missing: ${missingRequired.map((slot) => slot.label).join(", ")}.`,
      );
    }
  }

  if (hazard && !hazard.included && score !== null && score < 25) {
    limitations.push(
      "A low business-reported score cannot be read as low climate vulnerability while hazard evidence is missing.",
    );
  }

  return {
    methodologyVersion: METHODOLOGY_VERSION,
    direction: SCORE_DIRECTION,
    status,
    score,
    band: score === null ? null : vulnerabilityBand(score),
    evidenceCompleteness,
    evidenceSlots,
    components,
    renormalized,
    limitations,
    explanation,
  };
}

export function explainScoreChange(
  previous: VulnerabilityScore | null,
  next: VulnerabilityScore,
): ScoreChange {
  const previousById = new Map(
    (previous?.components ?? []).map((component) => [component.id, component.score]),
  );
  const componentDeltas = next.components.map((component) => {
    const prior = previous ? (previousById.get(component.id) ?? null) : null;
    const delta =
      prior === null || component.score === null ? null : round1(component.score - prior);
    return { id: component.id as ComponentId, previous: prior, next: component.score, delta };
  });
  const reasons: string[] = [];
  if (!previous) {
    reasons.push("No previous assessment exists for this business.");
  } else {
    if (previous.methodologyVersion !== next.methodologyVersion) {
      reasons.push(
        `Methodology changed from ${previous.methodologyVersion} to ${next.methodologyVersion}.`,
      );
    }
    for (const delta of componentDeltas) {
      if (delta.delta === null) {
        if (delta.previous !== delta.next) {
          reasons.push(`${delta.id} availability changed.`);
        }
      } else if (Math.abs(delta.delta) >= 0.5) {
        reasons.push(`${delta.id} changed by ${delta.delta}.`);
      }
    }
    if (reasons.length === 0) reasons.push("No component moved by 0.5 points or more.");
  }
  const delta =
    previous?.score === null || previous?.score === undefined || next.score === null
      ? null
      : round1(next.score - previous.score);
  return {
    previousScore: previous?.score ?? null,
    nextScore: next.score,
    delta,
    componentDeltas,
    reasons,
  };
}
