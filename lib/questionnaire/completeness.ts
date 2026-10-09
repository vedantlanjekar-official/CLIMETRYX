import { contextFor, isAnswered, isSectionVisible, questionAnswered, visibleStepItems } from "@/lib/questionnaire/engine";
import { STEPS } from "@/lib/questionnaire/registry";
import type { ValidationIssue } from "@/lib/questionnaire/validation";
import type { AnswerValue, AssessmentAnswers, QuestionDefinition, RiskDimension } from "@/lib/questionnaire/types";

export type StepState = "not_started" | "in_progress" | "complete" | "attention" | "optional";

export interface StepProgress {
  stepId: string;
  required: number;
  answered: number;
  issues: number;
  state: StepState;
}

function isUnknown(question: QuestionDefinition, value: AnswerValue | undefined): boolean {
  return (question.type === "tristate" || question.type === "select" || question.type === "radio") && value === "unknown";
}

export function stepProgress(answers: AssessmentAnswers, issues: ValidationIssue[]): StepProgress[] {
  const context = contextFor(answers);
  return STEPS.map((step) => {
    const items = visibleStepItems(step, context);
    const required = items.filter((item) => item.question.required);
    const answered = required.filter((item) => questionAnswered(item.question, item.values)).length;
    const touched = items.some((item) => questionAnswered(item.question, item.values));
    const missingGroups = step.sections.filter(
      (section) => section.group && isSectionVisible(section, context) && (answers.groups[section.group.key]?.length ?? 0) < section.group.minItems,
    ).length;
    const stepIssues = issues.filter((issue) => issue.stepId === step.id).length;
    let state: StepState;
    const satisfied = answered === required.length && missingGroups === 0;
    if (stepIssues > 0) state = "attention";
    else if (satisfied && touched) state = "complete";
    else if (satisfied && required.length === 0) state = "optional";
    else if (touched) state = "in_progress";
    else state = "not_started";
    return { stepId: step.id, required: required.length + missingGroups, answered, issues: stepIssues, state };
  });
}

export const SCORED_DIMENSIONS: RiskDimension[] = [
  "hazard_exposure",
  "operational_sensitivity",
  "adaptive_capacity",
  "supply_chain",
  "financial_sensitivity",
];

export interface DimensionCoverage {
  dimension: RiskDimension;
  applicable: number;
  answered: number;
  unknown: number;
  coverage: "well_covered" | "partly_covered" | "limited" | "not_applicable";
}

export function dimensionCoverage(answers: AssessmentAnswers): DimensionCoverage[] {
  const context = contextFor(answers);
  const items = STEPS.flatMap((step) => visibleStepItems(step, context));
  return SCORED_DIMENSIONS.map((dimension) => {
    const relevant = items.filter((item) => item.question.dimensions.includes(dimension) && item.question.type !== "boolean");
    const answered = relevant.filter((item) => questionAnswered(item.question, item.values));
    const unknown = answered.filter((item) => isUnknown(item.question, item.values[item.question.key])).length;
    const known = answered.length - unknown;
    const share = relevant.length ? known / relevant.length : 0;
    const coverage: DimensionCoverage["coverage"] =
      dimension === "financial_sensitivity" && answers.values["fin.include"] === "no"
        ? "not_applicable"
        : relevant.length === 0
          ? "limited"
          : share >= 0.75
            ? "well_covered"
            : share >= 0.4
              ? "partly_covered"
              : "limited";
    return { dimension, applicable: relevant.length, answered: answered.length, unknown, coverage };
  });
}

export interface EvidenceSummary {
  documentSupported: number;
  businessReported: number;
  assumptions: number;
  documents: number;
  label: "document_supported" | "mixed" | "self_reported";
}

const DOCUMENTED = new Set(["records", "bills_or_invoices", "insurance_claim", "photos", "utility_records", "own_logs", "audited", "management", "tax_return", "quotation", "published_rate", "invoice", "insurance_valuation"]);

export function evidenceSummary(answers: AssessmentAnswers): EvidenceSummary {
  const context = contextFor(answers);
  let documentSupported = 0;
  let businessReported = 0;
  let assumptions = 0;
  for (const step of STEPS) {
    for (const item of visibleStepItems(step, context)) {
      if (!questionAnswered(item.question, item.values)) continue;
      const value = item.values[item.question.key];
      const isEvidenceField = /evidence|basis|estimate_type|value_basis/.test(item.question.key);
      if (isEvidenceField && typeof value === "string") {
        if (DOCUMENTED.has(value)) documentSupported += 1;
        else businessReported += 1;
      } else if (item.question.source === "user_assumption") assumptions += 1;
    }
  }
  const documents = answers.groups.documents?.length ?? 0;
  const total = documentSupported + businessReported;
  const label: EvidenceSummary["label"] =
    total > 0 && documentSupported / total >= 0.6 && documents > 0 ? "document_supported" : documentSupported > 0 || documents > 0 ? "mixed" : "self_reported";
  return { documentSupported, businessReported, assumptions, documents, label };
}

export interface MissingItem {
  stepId: string;
  key: string;
  label: string;
  groupKey: string | null;
  rowId: string | null;
  dimension: RiskDimension;
  reason: "unanswered" | "unknown";
}

/** Visible required questions left blank, and any answer given as "not sure". */
export function missingData(answers: AssessmentAnswers): MissingItem[] {
  const context = contextFor(answers);
  const items: MissingItem[] = [];
  for (const step of STEPS) {
    for (const item of visibleStepItems(step, context)) {
      const dimension = item.question.dimensions[0] ?? "context";
      const value = item.values[item.question.key];
      if (item.question.required && !questionAnswered(item.question, item.values) && item.question.type !== "boolean") {
        items.push({ stepId: step.id, key: item.question.key, label: item.question.label, groupKey: item.groupKey, rowId: item.rowId, dimension, reason: "unanswered" });
      } else if (isAnswered(value) && isUnknown(item.question, value)) {
        items.push({ stepId: step.id, key: item.question.key, label: item.question.label, groupKey: item.groupKey, rowId: item.rowId, dimension, reason: "unknown" });
      }
    }
  }
  return items;
}
