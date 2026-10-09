export const METHODOLOGY_VERSION = "fin05-vulnerability-1.2.0";

/** Higher means higher estimated climate-disruption vulnerability. Not a credit score. */
export const SCORE_DIRECTION =
  "0–100 climate-disruption vulnerability indicator. Higher means greater estimated vulnerability to disruption. This is not a probability of default, a calibrated credit score, or a lending decision.";

export type EvidenceKind =
  | "measured"
  | "modelled"
  | "reanalysis"
  | "forecast"
  | "self_reported"
  | "hypothetical"
  | "missing";

export type IndicatorStatus = "available" | "partial" | "not_available";

export type TriState = "yes" | "no" | "unknown";

export type ComponentId =
  | "hazard"
  | "operational_sensitivity"
  | "adaptive_capacity_gap"
  | "supply_chain"
  | "financial_sensitivity";

export interface ComponentDefinition {
  id: ComponentId;
  label: string;
  baselineWeight: number;
  rationale: string;
}

export const COMPONENT_DEFINITIONS: ComponentDefinition[] = [
  {
    id: "hazard",
    label: "Hazard context",
    baselineWeight: 0.3,
    rationale:
      "Near-term forecast screening for heat, heavy rainfall, wind, and meteorological dryness. Weights are modelling assumptions, not calibrated facts.",
  },
  {
    id: "operational_sensitivity",
    label: "Operational sensitivity",
    baselineWeight: 0.25,
    rationale:
      "Owner-reported dependence on electricity, water, cooling, perishable stock, outdoor work, and downtime tolerance.",
  },
  {
    id: "adaptive_capacity_gap",
    label: "Adaptive-capacity gap",
    baselineWeight: 0.2,
    rationale:
      "Gap where the business reports that a resilience measure is absent. Unknown answers are excluded rather than treated as protection.",
  },
  {
    id: "supply_chain",
    label: "Supply-chain vulnerability",
    baselineWeight: 0.15,
    rationale:
      "Concentration, single-source dependence, thin inventory, and slow substitution for critical suppliers. Geographic exposure is not an interruption.",
  },
  {
    id: "financial_sensitivity",
    label: "Financial sensitivity",
    baselineWeight: 0.1,
    rationale:
      "Cash coverage of fixed operating costs when the business supplies those figures. Missing finance data is excluded.",
  },
];

export interface ScoreComponentInput {
  id: ComponentId;
  /** 0–100 vulnerability contribution. Null means the component is unavailable. */
  value: number | null;
  evidenceKind: EvidenceKind;
  source: string;
  retrievedAt?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
  normalization: string;
  stale?: boolean;
  notes: string[];
}

export interface ComponentScore {
  id: ComponentId;
  label: string;
  score: number | null;
  baselineWeight: number;
  effectiveWeight: number | null;
  included: boolean;
  evidenceKind: EvidenceKind;
  source: string;
  normalization: string;
  notes: string[];
  reasonExcluded?: string;
}

export type AssessmentCompleteness = "complete" | "partial" | "incomplete";

export interface EvidenceSlot {
  id: string;
  label: string;
  available: boolean;
  requiredForComplete: boolean;
}

export interface VulnerabilityScore {
  methodologyVersion: string;
  direction: string;
  status: AssessmentCompleteness;
  /** Null when there is not enough included evidence to show a number. */
  score: number | null;
  band: string | null;
  evidenceCompleteness: number;
  evidenceSlots: EvidenceSlot[];
  components: ComponentScore[];
  renormalized: boolean;
  limitations: string[];
  explanation: string[];
}

export interface ScoreChange {
  previousScore: number | null;
  nextScore: number | null;
  delta: number | null;
  componentDeltas: Array<{
    id: ComponentId;
    previous: number | null;
    next: number | null;
    delta: number | null;
  }>;
  reasons: string[];
}
