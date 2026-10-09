export const TEMPLATE_KEY = "climetryx-business-assessment";
export const TEMPLATE_VERSION = "2026.10.1";
export const CONSENT_VERSION = "climetryx-consent-2";

export type Scalar = string | number | boolean | null;
export type AnswerValue = Scalar | string[];

export interface RepeatRow {
  id: string;
  values: Record<string, AnswerValue>;
}

export interface AssessmentAnswers {
  values: Record<string, AnswerValue>;
  groups: Record<string, RepeatRow[]>;
}

export type QuestionType =
  | "text"
  | "textarea"
  | "number"
  | "currency"
  | "percentage"
  | "select"
  | "combobox"
  | "multiselect"
  | "radio"
  | "tristate"
  | "date"
  | "boolean"
  | "geopoint"
  | "site_ref";

/** Who or what the answer comes from. Drives evidence-quality reporting. */
export type SourceCategory = "business_reported" | "document_supported" | "user_assumption" | "derived";

export type Sensitivity = "internal" | "confidential" | "restricted_financial";

export type RiskDimension =
  | "hazard_exposure"
  | "operational_sensitivity"
  | "adaptive_capacity"
  | "supply_chain"
  | "financial_sensitivity"
  | "site_feasibility"
  | "context"
  | "monitoring"
  | "governance";

/** Level A is the initial screening set. Level B adds advanced detail. */
export type Level = "A" | "B";

export type IndustryBranch =
  | "agriculture"
  | "manufacturing"
  | "food_cold_chain"
  | "retail"
  | "it_services"
  | "water_intensive"
  | "outdoor_work"
  | "hospitality"
  | "logistics"
  | "construction"
  | "healthcare"
  | "new_site"
  | "financial";

export interface Option {
  value: string;
  label: string;
  help?: string;
}

/**
 * Field references starting with "." resolve against the current repeat row,
 * all others against the top-level answers.
 */
export type Condition =
  | { field: string; equals: Scalar }
  | { field: string; in: string[] }
  | { field: string; includes: string }
  | { field: string; answered: boolean }
  | { field: string; gt: number }
  | { branch: IndustryBranch }
  | { level: Level }
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition };

export interface Validation {
  min?: number;
  max?: number;
  integer?: boolean;
  maxLength?: number;
  pattern?: { regex: string; message: string };
  notFuture?: boolean;
  minItems?: number;
}

export interface Persistence {
  table: string;
  column: string;
  note?: string;
}

export interface QuestionDefinition {
  key: string;
  label: string;
  help?: string;
  type: QuestionType;
  unit?: string;
  placeholder?: string;
  required: boolean;
  level: Level;
  validation?: Validation;
  visibleWhen?: Condition;
  /** Shortcut for visibility: shown only when one of these branches is active. */
  industries?: IndustryBranch[];
  source: SourceCategory;
  sensitivity: Sensitivity;
  dimensions: RiskDimension[];
  options?: Option[];
  version: number;
  order: number;
  persistence: Persistence;
  /** A change to this answer marks the latest completed assessment as stale. */
  material: boolean;
  width: "half" | "full";
}

export interface GroupDefinition {
  key: string;
  label: string;
  itemLabel: string;
  description?: string;
  minItems: number;
  maxItems: number;
  visibleWhen?: Condition;
  level: Level;
  questions: QuestionDefinition[];
  persistenceTable: string;
  /** Rows are created by another flow (for example uploads), not by an "Add" button. */
  managed?: boolean;
}

export interface SectionDefinition {
  key: string;
  title: string;
  description?: string;
  visibleWhen?: Condition;
  industries?: IndustryBranch[];
  questions?: QuestionDefinition[];
  group?: GroupDefinition;
}

export interface StepDefinition {
  id: string;
  number: number;
  title: string;
  short: string;
  summary: string;
  why: string;
  dimensions: RiskDimension[];
  external: string[];
  optional: boolean;
  sections: SectionDefinition[];
}

export const DIMENSION_LABELS: Record<RiskDimension, string> = {
  hazard_exposure: "Hazard exposure",
  operational_sensitivity: "Operational sensitivity",
  adaptive_capacity: "Adaptive capacity",
  supply_chain: "Supply chain",
  financial_sensitivity: "Financial sensitivity",
  site_feasibility: "Site feasibility",
  context: "Business context",
  monitoring: "Monitoring",
  governance: "Consent and governance",
};

export function emptyAnswers(): AssessmentAnswers {
  return { values: {}, groups: {} };
}
